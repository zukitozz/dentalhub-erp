import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireApiAuth } from '@/lib/api-auth'
import { getSedeCtx, precioTratamiento } from '@/lib/sede'
import { auth } from '@/lib/auth'
import { parseComision, registrarGastoComision } from '@/lib/comisiones'

export const dynamic = 'force-dynamic'

const include = {
  tratamiento: { select: { id: true, nombre: true, diasProximoTratamiento: true } },
  odontologo: { select: { id: true, name: true } },
}

function piezaDe(valor: unknown) {
  const n = Number(valor)
  return Number.isInteger(n) && n > 0 ? n : null
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const params = await ctx.params
  const guard = await requireApiAuth(['ADMIN', 'SUPERVISOR', 'ODONTOLOGO'])
  if (guard) return guard

  const body = await req.json()
  if (typeof body.tratamientoId !== 'string' || typeof body.odontologoId !== 'string') {
    return NextResponse.json({ error: 'tratamientoId y odontologoId son requeridos' }, { status: 400 })
  }

  const atencion = await prisma.atencion.findUnique({
    where: { id: params.id },
    include: { tratamientos: { select: { estado: true, orden: true } } },
  })
  if (!atencion) {
    return NextResponse.json({ error: 'Atención no encontrada' }, { status: 404 })
  }
  const abierta = atencion.tratamientos.length === 0 || atencion.tratamientos.some((t) => t.estado === 'PENDIENTE' || t.estado === 'EN_CURSO')
  if (!abierta) {
    return NextResponse.json({ error: 'Esta atención ya está cerrada' }, { status: 409 })
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
  const session = await auth()
  const puedeCambiarPrecio = session?.user?.role === 'ADMIN' || session?.user?.role === 'SUPERVISOR'
  const precioBody = Number(body.precio)
  const sedeCtx = await getSedeCtx()
  const precioSede = await precioTratamiento(tratamiento.id, tratamiento.precio, sedeCtx?.sedeEscritura ?? null)
  const precio = puedeCambiarPrecio && Number.isFinite(precioBody) && precioBody >= 0 ? precioBody : precioSede

  const orden = atencion.tratamientos.reduce((max, t) => Math.max(max, t.orden), -1) + 1

  const comision = parseComision(body.comision)

  const linea = await prisma.$transaction(async (tx) => {
    const creada = await tx.atencionTratamiento.create({
      data: {
        atencionId: atencion.id,
        tratamientoId: body.tratamientoId,
        odontologoId: body.odontologoId,
        orden,
        precio,
        precioCatalogo: precioSede,
        comision,
        pieza: piezaDe(body.pieza),
        superficie: typeof body.superficie === 'string' && body.superficie.trim() ? body.superficie.trim().slice(0, 10) : null,
      },
      include,
    })
    if (comision) {
      await registrarGastoComision(tx, {
        monto: comision,
        odontologoId: body.odontologoId,
        concepto: `Comisión ${odontologo.name} - ${tratamiento.nombre}`,
        usuarioId: session?.user?.id,
        sedeId: sedeCtx?.sedeEscritura,
      })
    }
    return creada
  })

  return NextResponse.json(linea, { status: 201 })
}
