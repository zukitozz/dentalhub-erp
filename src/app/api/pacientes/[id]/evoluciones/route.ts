import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { requireApiAuth } from '@/lib/api-auth'
import { crearEvento } from '@/lib/googleCalendar'

export const dynamic = 'force-dynamic'

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const guard = await requireApiAuth()
  if (guard) return guard

  const evoluciones = await prisma.evolucion.findMany({
    where: { pacienteId: id },
    include: {
      odontologo: { select: { id: true, name: true, colegiatura: true } },
      proximaCita: { select: { id: true, fecha: true, tratamiento: true, estado: true } },
    },
    orderBy: { fecha: 'desc' },
  })
  return NextResponse.json(evoluciones)
}

const texto = (valor: unknown) => (typeof valor === 'string' && valor.trim() ? valor.trim() : null)

// Registra la nota de evolución de una visita. Si trae `proximaCita`, la cita se crea y aparece en la agenda.
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const guard = await requireApiAuth()
  if (guard) return guard
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Usuario autenticado requerido' }, { status: 401 })

  const body = await req.json()
  const procedimiento = texto(body.procedimiento)
  if (!procedimiento) return NextResponse.json({ error: 'Describe el procedimiento realizado' }, { status: 400 })

  const paciente = await prisma.paciente.findUnique({ where: { id }, select: { id: true } })
  if (!paciente) return NextResponse.json({ error: 'Paciente no encontrado' }, { status: 404 })

  // El odontólogo que escribe la nota es quien firma; recepción/gerente deben indicar cuál fue.
  const odontologoId = session.user.role === 'ODONTOLOGO' ? session.user.id : texto(body.odontologoId)
  if (!odontologoId) return NextResponse.json({ error: 'Selecciona el odontólogo que realizó la atención' }, { status: 400 })
  const odontologo = await prisma.user.findFirst({ where: { id: odontologoId, role: 'ODONTOLOGO' }, select: { id: true } })
  if (!odontologo) return NextResponse.json({ error: 'El usuario seleccionado no es un odontólogo' }, { status: 400 })

  let proximaCitaId: string | null = null
  const proxima = body.proximaCita
  if (proxima && typeof proxima === 'object' && proxima.fecha) {
    const fecha = new Date(proxima.fecha)
    if (Number.isNaN(fecha.getTime())) return NextResponse.json({ error: 'Fecha de la próxima cita inválida' }, { status: 400 })
    const cita = await prisma.cita.create({
      data: {
        pacienteId: id,
        fecha,
        tratamiento: texto(proxima.tratamiento) ?? 'Control / seguimiento',
        duracionMin: Number.isFinite(Number(proxima.duracionMin)) && Number(proxima.duracionMin) > 0 ? Number(proxima.duracionMin) : null,
        descripcion: texto(proxima.descripcion),
        odontologoId,
      },
      include: { paciente: true, odontologo: { select: { id: true, name: true } } },
    })
    proximaCitaId = cita.id
    const googleEventId = await crearEvento(cita)
    if (googleEventId) await prisma.cita.update({ where: { id: cita.id }, data: { googleEventId } })
  }

  const evolucion = await prisma.evolucion.create({
    data: {
      pacienteId: id,
      odontologoId,
      atencionId: texto(body.atencionId),
      fecha: body.fecha ? new Date(body.fecha) : new Date(),
      motivo: texto(body.motivo),
      diagnostico: texto(body.diagnostico),
      procedimiento,
      indicaciones: texto(body.indicaciones),
      piezas: texto(body.piezas),
      proximaCitaId,
    },
    include: {
      odontologo: { select: { id: true, name: true, colegiatura: true } },
      proximaCita: { select: { id: true, fecha: true, tratamiento: true, estado: true } },
    },
  })
  return NextResponse.json(evolucion, { status: 201 })
}
