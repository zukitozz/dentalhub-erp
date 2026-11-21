import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireApiAuth } from '@/lib/api-auth'
import { NOMBRE_TIPO } from '@/lib/documentos'
import { CONDICION_POR_CODIGO } from '@/lib/odontograma'

export const dynamic = 'force-dynamic'

export interface EventoExpediente {
  id: string
  tipo: 'ATENCION' | 'EVOLUCION' | 'DOCUMENTO' | 'CITA' | 'PLAN' | 'PAGO'
  fecha: string
  titulo: string
  detalle: string | null
  autor: string | null
  /** Enlace interno para abrir el registro. */
  href: string | null
  meta?: Record<string, string | number | null>
}

// Expediente clínico completo: datos del paciente, indicadores y línea de tiempo unificada
// (atenciones con sus tratamientos, evoluciones, documentos, citas, planes y pagos).
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const guard = await requireApiAuth()
  if (guard) return guard

  const paciente = await prisma.paciente.findUnique({ where: { id } })
  if (!paciente) return NextResponse.json({ error: 'Paciente no encontrado' }, { status: 404 })

  const [atenciones, evoluciones, documentos, citas, planes, pagos, hallazgos, fotosTotal, historia] = await Promise.all([
    prisma.atencion.findMany({
      where: { pacienteId: id },
      include: {
        consultorio: { select: { nombre: true } },
        tratamientos: { include: { tratamiento: { select: { nombre: true } }, odontologo: { select: { name: true } } }, orderBy: { orden: 'asc' } },
        productos: { include: { producto: { select: { nombre: true } } } },
        _count: { select: { fotos: true } },
      },
      orderBy: { horaInicio: 'desc' },
    }),
    prisma.evolucion.findMany({ where: { pacienteId: id }, include: { odontologo: { select: { name: true } } }, orderBy: { fecha: 'desc' } }),
    prisma.documento.findMany({ where: { pacienteId: id, estado: { not: 'ANULADO' } }, include: { odontologo: { select: { name: true } } }, orderBy: { creadoAt: 'desc' } }),
    prisma.cita.findMany({ where: { pacienteId: id }, include: { odontologo: { select: { name: true } } }, orderBy: { fecha: 'desc' } }),
    prisma.plan.findMany({ where: { pacienteId: id, activo: true }, include: { items: true, facturas: { where: { tipo: 'NOTA_VENTA', activo: true } } }, orderBy: { creadoAt: 'desc' } }),
    prisma.factura.findMany({ where: { pacienteId: id, activo: true, tipo: { not: 'NOTA_VENTA' } }, orderBy: { creadoAt: 'desc' } }),
    prisma.odontogramaHallazgo.findMany({ where: { pacienteId: id, activo: true } }),
    prisma.atencionFoto.count({ where: { pacienteId: id } }),
    prisma.historiaClinica.findUnique({ where: { pacienteId: id }, select: { actualizadoAt: true } }),
  ])

  const eventos: EventoExpediente[] = []

  for (const a of atenciones) {
    const lineas = a.tratamientos.map((t) => `${t.tratamiento.nombre}${t.pieza ? ` (pieza ${t.pieza})` : ''}`)
    const total = a.tratamientos.reduce((acc, t) => acc + (t.precio ?? 0), 0) + a.productos.reduce((acc, p) => acc + p.cantidad * p.precioUnit, 0)
    eventos.push({
      id: a.id,
      tipo: 'ATENCION',
      fecha: a.horaInicio.toISOString(),
      titulo: lineas.length > 0 ? lineas.join(' · ') : 'Atención',
      detalle: a.notas,
      autor: [...new Set(a.tratamientos.map((t) => t.odontologo.name))].join(', ') || null,
      href: `/atenciones?pacienteId=${id}`,
      meta: { total, fotos: a._count.fotos, consultorio: a.consultorio?.nombre ?? null, productos: a.productos.length },
    })
  }
  for (const e of evoluciones) {
    eventos.push({
      id: e.id,
      tipo: 'EVOLUCION',
      fecha: e.fecha.toISOString(),
      titulo: e.diagnostico ? `Evolución · ${e.diagnostico}` : 'Evolución clínica',
      detalle: e.procedimiento,
      autor: e.odontologo.name,
      href: null,
      meta: { piezas: e.piezas },
    })
  }
  for (const d of documentos) {
    eventos.push({
      id: d.id,
      tipo: 'DOCUMENTO',
      fecha: d.creadoAt.toISOString(),
      titulo: `${NOMBRE_TIPO[d.tipo] ?? d.tipo} · ${d.numero}`,
      detalle: d.titulo,
      autor: d.odontologo?.name ?? null,
      href: `/documentos/${d.id}`,
      meta: { estado: d.estado, total: d.total },
    })
  }
  for (const c of citas.filter((x) => ['PENDIENTE', 'CONFIRMADA'].includes(x.estado))) {
    eventos.push({
      id: c.id,
      tipo: 'CITA',
      fecha: c.fecha.toISOString(),
      titulo: `Cita · ${c.tratamiento}`,
      detalle: c.descripcion,
      autor: c.odontologo?.name ?? null,
      href: '/citas',
      meta: { estado: c.estado },
    })
  }
  for (const p of planes) {
    const hechos = p.items.filter((i) => i.realizado).length
    eventos.push({
      id: p.id,
      tipo: 'PLAN',
      fecha: p.creadoAt.toISOString(),
      titulo: `Plan de tratamiento · ${p.nombre}`,
      detalle: p.items.length > 0 ? `${hechos} de ${p.items.length} líneas realizadas` : null,
      autor: null,
      href: '/planes',
      meta: { total: p.precioTotal, estado: p.estado },
    })
  }
  for (const f of pagos) {
    eventos.push({
      id: f.id,
      tipo: 'PAGO',
      fecha: f.creadoAt.toISOString(),
      titulo: `${f.tipo === 'BOLETA' ? 'Boleta' : 'Factura'} ${f.numeracionComprobante ?? ''}`.trim(),
      detalle: f.metodoPago,
      autor: null,
      href: '/facturacion',
      meta: { total: f.total },
    })
  }
  eventos.sort((a, b) => b.fecha.localeCompare(a.fecha))

  const pendientes = hallazgos.filter((h) => h.estado === 'PLANIFICADO')
  const saldoPlanes = planes
    .filter((p) => p.estado === 'ABIERTO')
    .reduce((acc, p) => acc + Math.max(0, p.precioTotal - p.facturas.reduce((s, f) => s + f.total, 0)), 0)

  return NextResponse.json({
    paciente,
    indicadores: {
      atenciones: atenciones.length,
      ultimaAtencion: atenciones[0]?.horaInicio ?? null,
      proximaCita: citas.filter((c) => ['PENDIENTE', 'CONFIRMADA'].includes(c.estado) && c.fecha >= new Date()).sort((a, b) => a.fecha.getTime() - b.fecha.getTime())[0] ?? null,
      hallazgosPendientes: pendientes.map((h) => ({ pieza: h.pieza, condicion: CONDICION_POR_CODIGO[h.condicion]?.nombre ?? h.condicion })),
      fotos: fotosTotal,
      documentos: documentos.length,
      saldoPlanes,
      historiaActualizada: historia?.actualizadoAt ?? null,
    },
    eventos,
  })
}
