import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireApiAuth } from '@/lib/api-auth'
import { mesActualPeru, rangoMesPeru } from '@/lib/fechas'
import { getSedeCtx } from '@/lib/sede'

export const dynamic = 'force-dynamic'

// Top de recomendadores: lo facturado en el mes por los pacientes que cada persona recomendó (sin porcentaje; el premio al top lo define la clínica).
export async function GET(req: Request) {
  const guard = await requireApiAuth(['SUPERVISOR'])
  if (guard) return guard

  const mes = new URL(req.url).searchParams.get('mes') || mesActualPeru()
  const rango = rangoMesPeru(mes)
  const ctx = await getSedeCtx()

  // Mismo criterio que los ingresos: comprobantes activos y pagados, sin el comprobante final que consolida abonos de un plan.
  const facturas = await prisma.factura.findMany({
    where: {
      ...ctx?.filtro,
      activo: true,
      estado: 'PAGADO',
      cuentaParaCierre: true,
      fechaEmision: rango,
      paciente: { referidoPorId: { not: null } },
    },
    select: { total: true, paciente: { select: { id: true, nombre: true, referidoPor: { select: { id: true, nombre: true, celular: true } } } } },
  })

  const porRecomendador = new Map<string, { id: string; nombre: string; celular: string | null; ventas: number; recomendados: Map<string, { nombre: string; ventas: number }> }>()
  for (const f of facturas) {
    const quien = f.paciente.referidoPor
    if (!quien) continue
    const fila = porRecomendador.get(quien.id) ?? { id: quien.id, nombre: quien.nombre, celular: quien.celular, ventas: 0, recomendados: new Map() }
    fila.ventas += f.total
    const rec = fila.recomendados.get(f.paciente.id) ?? { nombre: f.paciente.nombre, ventas: 0 }
    rec.ventas += f.total
    fila.recomendados.set(f.paciente.id, rec)
    porRecomendador.set(quien.id, fila)
  }

  const round2 = (n: number) => Math.round(n * 100) / 100
  const filas = [...porRecomendador.values()]
    .map((f) => ({
      id: f.id,
      nombre: f.nombre,
      celular: f.celular,
      ventas: round2(f.ventas),
      recomendados: [...f.recomendados.values()].map((r) => ({ nombre: r.nombre, ventas: round2(r.ventas) })).sort((a, b) => b.ventas - a.ventas),
    }))
    .sort((a, b) => b.ventas - a.ventas)

  return NextResponse.json({
    mes,
    totalVentas: round2(filas.reduce((s, f) => s + f.ventas, 0)),
    filas,
  })
}
