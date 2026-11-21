import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireApiAuth } from '@/lib/api-auth'
import { auth } from '@/lib/auth'
import { parseComision, registrarGastoComision } from '@/lib/comisiones'

export const dynamic = 'force-dynamic'

const ROLES_ATENCION = ['ADMIN', 'SUPERVISOR'] as const

const include = {
  producto: { select: { id: true, nombre: true } },
}

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const params = await ctx.params
  const guard = await requireApiAuth()
  if (guard) return guard

  const productos = await prisma.atencionProducto.findMany({
    where: { atencionId: params.id },
    include,
    orderBy: { creadoAt: 'asc' },
  })

  return NextResponse.json(productos)
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const params = await ctx.params
  const guard = await requireApiAuth([...ROLES_ATENCION])
  if (guard) return guard

  const atencion = await prisma.atencion.findUnique({
    where: { id: params.id },
    include: { tratamientos: { select: { estado: true } } },
  })
  if (!atencion) {
    return NextResponse.json({ error: 'Atención no encontrada' }, { status: 404 })
  }
  const abierta = atencion.tratamientos.some((t) => t.estado === 'PENDIENTE' || t.estado === 'EN_CURSO')
  if (!abierta) {
    return NextResponse.json({ error: 'La atención ya está cerrada' }, { status: 409 })
  }

  const body = await req.json()
  const cantidad = Number(body.cantidad) || 0
  if (typeof body.productoId !== 'string' || !body.productoId || cantidad <= 0) {
    return NextResponse.json({ error: 'productoId y cantidad (mayor a 0) son requeridos' }, { status: 400 })
  }

  const producto = await prisma.producto.findUnique({ where: { id: body.productoId } })
  if (!producto) {
    return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 })
  }

  // Solo ADMIN/SUPERVISOR pueden acordar un precio distinto al del catálogo; el odontólogo
  // siempre agrega el producto al precio de catálogo.
  const session = await auth()
  const puedeCambiarPrecio = session?.user?.role === 'ADMIN' || session?.user?.role === 'SUPERVISOR'
  const precioUnitBody = Number(body.precioUnit)
  const precioUnit = puedeCambiarPrecio && Number.isFinite(precioUnitBody) && precioUnitBody >= 0 ? precioUnitBody : producto.precioVenta

  const comision = parseComision(body.comision)
  let odontologo: { id: string; name: string } | null = null
  if (comision) {
    odontologo = typeof body.odontologoId === 'string' && body.odontologoId
      ? await prisma.user.findFirst({ where: { id: body.odontologoId, role: 'ODONTOLOGO' }, select: { id: true, name: true } })
      : null
    if (!odontologo) {
      return NextResponse.json({ error: 'Selecciona el odontólogo que recibe la comisión' }, { status: 400 })
    }
  }

  const item = await prisma.$transaction(async (tx) => {
    const creado = await tx.atencionProducto.create({
      data: {
        atencionId: atencion.id,
        productoId: producto.id,
        cantidad,
        precioUnit,
        precioCatalogo: producto.precioVenta,
        comision,
        comisionOdontologoId: odontologo?.id ?? null,
      },
      include,
    })
    if (comision && odontologo) {
      await registrarGastoComision(tx, {
        monto: comision,
        odontologoId: odontologo.id,
        concepto: `Comisión ${odontologo.name} - ${producto.nombre}`,
        usuarioId: session?.user?.id,
      })
    }
    return creado
  })

  return NextResponse.json(item, { status: 201 })
}
