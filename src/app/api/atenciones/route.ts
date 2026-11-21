import { Prisma } from '@/generated/prisma/client'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireApiAuth } from '@/lib/api-auth'
import { auth } from '@/lib/auth'
import { cambiarEstadoConsultorio } from '@/lib/consultorios'
import { rangoDiaPeru } from '@/lib/fechas'
import { urlFirmada } from '@/lib/storage'

export const dynamic = 'force-dynamic'

const include = {
  atencion: {
    select: {
      id: true,
      horaInicio: true,
      consultorio: { select: { id: true, nombre: true } },
      paciente: { select: { id: true, nombre: true } },
      cita: { select: { id: true, fecha: true } },
      fotos: { orderBy: { creadoAt: 'asc' as const } },
    },
  },
  tratamiento: { select: { id: true, nombre: true, duracionMin: true, precio: true } },
  odontologo: { select: { id: true, name: true } },
} satisfies Prisma.AtencionTratamientoInclude

type LineaConAtencion = Prisma.AtencionTratamientoGetPayload<{ include: typeof include }>

async function aplanar(linea: LineaConAtencion) {
  const { atencion, ...resto } = linea
  // El bucket es privado: se devuelve una URL firmada por foto en lugar de la key de S3.
  const fotos = await Promise.all(atencion.fotos.map(async ({ key, ...foto }) => ({ ...foto, url: await urlFirmada(key) })))
  // resto.id (línea de tratamiento) debe prevalecer sobre atencion.id (la visita).
  // Las líneas PENDIENTES (p. ej. sesiones de plan) aún no tienen horaInicio: se muestra la fecha de la visita.
  return { ...atencion, fotos, ...resto, horaInicio: resto.horaInicio ?? atencion.horaInicio, atencionId: atencion.id }
}

const PAGE_SIZE_DEFAULT = 15
const PAGE_SIZE_MAX = 100

export async function GET(req: Request) {
  const guard = await requireApiAuth(['ADMIN', 'SUPERVISOR'])
  if (guard) return guard

  const url = new URL(req.url)
  const pacienteId = url.searchParams.get('pacienteId')
  const tratamientoId = url.searchParams.get('tratamientoId')
  const consultorioId = url.searchParams.get('consultorioId')
  const odontologoId = url.searchParams.get('odontologoId')
  const estado = url.searchParams.get('estado')
  const desde = url.searchParams.get('desde')
  const hasta = url.searchParams.get('hasta')
  const page = Math.max(1, Number(url.searchParams.get('page')) || 1)
  const pageSize = Math.min(PAGE_SIZE_MAX, Math.max(1, Number(url.searchParams.get('pageSize')) || PAGE_SIZE_DEFAULT))

  const where = {
    ...(tratamientoId ? { tratamientoId } : {}),
    ...(odontologoId ? { odontologoId } : {}),
    ...(estado ? { estado: estado as 'PENDIENTE' | 'EN_CURSO' | 'FINALIZADA' | 'CANCELADA' } : {}),
    ...(desde || hasta
      ? {
          horaInicio: {
            ...(desde ? { gte: rangoDiaPeru(desde).gte } : {}),
            ...(hasta ? { lte: rangoDiaPeru(hasta).lte } : {}),
          },
        }
      : {}),
    ...(pacienteId || consultorioId
      ? {
          atencion: {
            ...(pacienteId ? { pacienteId } : {}),
            ...(consultorioId ? { consultorioId } : {}),
          },
        }
      : {}),
  }

  const [atenciones, total] = await Promise.all([
    prisma.atencionTratamiento.findMany({
      where,
      include,
      orderBy: { horaInicio: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.atencionTratamiento.count({ where }),
  ])

  return NextResponse.json({ items: await Promise.all(atenciones.map(aplanar)), total, page, pageSize })
}

export async function POST(req: Request) {
  const guard = await requireApiAuth(['ADMIN', 'SUPERVISOR', 'ODONTOLOGO'])
  if (guard) return guard

  const body = await req.json()
  if (!body.pacienteId || !body.tratamientoId || !body.odontologoId) {
    return NextResponse.json(
      { error: 'pacienteId, tratamientoId y odontologoId son requeridos' },
      { status: 400 }
    )
  }

  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Usuario requerido' }, { status: 401 })
  }

  const odontologo = await prisma.user.findUnique({ where: { id: body.odontologoId } })
  if (odontologo?.role !== 'ODONTOLOGO') {
    return NextResponse.json({ error: 'El usuario seleccionado no es un odontólogo' }, { status: 400 })
  }

  const tratamiento = await prisma.tratamiento.findUnique({ where: { id: body.tratamientoId } })
  if (!tratamiento) {
    return NextResponse.json({ error: 'Tratamiento no encontrado' }, { status: 404 })
  }

  // Solo ADMIN/SUPERVISOR pueden acordar un precio distinto al del catálogo; el odontólogo
  // siempre asigna el tratamiento al precio de catálogo.
  const puedeCambiarPrecio = session.user.role === 'ADMIN' || session.user.role === 'SUPERVISOR'
  const precioBody = Number(body.precio)
  const precio = puedeCambiarPrecio && Number.isFinite(precioBody) && precioBody >= 0 ? precioBody : tratamiento.precio

  try {
    const atencion = await prisma.$transaction(async (tx) => {
      if (body.consultorioId) {
        const consultorio = await tx.consultorio.findUnique({ where: { id: body.consultorioId } })
        if (!consultorio) throw new Error('CONSULTORIO_NO_ENCONTRADA')
        if (consultorio.estado !== 'DISPONIBLE') throw new Error('CONSULTORIO_NO_DISPONIBLE')
      }

      if (body.citaId) {
        const cita = await tx.cita.findUnique({ where: { id: body.citaId } })
        if (!cita || cita.registrado || !['PENDIENTE', 'CONFIRMADA'].includes(cita.estado)) {
          throw new Error('CITA_NO_DISPONIBLE')
        }
        const configuracion = await tx.configuracion.upsert({ where: { id: 'default' }, update: {}, create: { id: 'default' } })
        const limiteExpiracion = new Date(cita.fecha.getTime() + configuracion.horasExpiracionCita * 60 * 60 * 1000)
        if (limiteExpiracion <= new Date()) {
          await tx.cita.update({ where: { id: cita.id }, data: { estado: 'EXPIRADA' } })
          throw new Error('CITA_EXPIRADA')
        }
      }

      const nueva = await tx.atencion.create({
        data: {
          pacienteId: body.pacienteId,
          consultorioId: body.consultorioId || null,
          citaId: body.citaId || null,
          notas: body.notas || null,
          tratamientos: {
            create: {
              tratamientoId: body.tratamientoId,
              odontologoId: body.odontologoId,
              orden: 0,
              precio,
              precioCatalogo: tratamiento.precio,
              pieza: Number.isInteger(Number(body.pieza)) && Number(body.pieza) > 0 ? Number(body.pieza) : null,
            },
          },
        },
        include: {
          paciente: { select: { id: true, nombre: true } },
          consultorio: { select: { id: true, nombre: true } },
          tratamientos: {
            include: {
              tratamiento: { select: { id: true, nombre: true, diasProximoTratamiento: true } },
              odontologo: { select: { id: true, name: true } },
            },
          },
        },
      })

      if (body.consultorioId) {
        await cambiarEstadoConsultorio(tx, {
          consultorioId: body.consultorioId,
          estadoNuevo: 'ATENCION',
          usuarioId: session.user.id,
          atencionId: nueva.id,
        })
      }

      return nueva
    })

    return NextResponse.json(atencion, { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.message === 'CONSULTORIO_NO_DISPONIBLE') {
      return NextResponse.json({ error: 'el consultorio no está disponible' }, { status: 409 })
    }
    if (error instanceof Error && error.message === 'CONSULTORIO_NO_ENCONTRADA') {
      return NextResponse.json({ error: 'Consultorio no encontrada' }, { status: 404 })
    }
    if (error instanceof Error && error.message === 'CITA_EXPIRADA') {
      return NextResponse.json({ error: 'La cita ha expirado y ya no puede registrarse' }, { status: 409 })
    }
    if (error instanceof Error && error.message === 'CITA_NO_DISPONIBLE') {
      return NextResponse.json({ error: 'La cita ya no está disponible' }, { status: 409 })
    }
    throw error
  }
}
