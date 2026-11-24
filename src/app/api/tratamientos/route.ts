import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireApiAuth } from '@/lib/api-auth'
import { getSedeCtx, preciosTratamientoSede } from '@/lib/sede'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const guard = await requireApiAuth()
  if (guard) return guard
  const tratamientos = await prisma.tratamiento.findMany({
    include: { insumos: { include: { producto: true } } },
    orderBy: { creadoAt: 'desc' },
  })

  // Mantenimiento del catálogo (?base=1): precios base. El resto de pantallas ven el precio de su sede
  // y no ven los tratamientos que la sede tiene desactivados.
  if (new URL(req.url).searchParams.get('base') === '1') return NextResponse.json(tratamientos)
  const ctx = await getSedeCtx()
  const porSede = await preciosTratamientoSede(ctx?.sedeEscritura ?? null)
  return NextResponse.json(
    tratamientos
      .filter((t) => porSede.get(t.id)?.activo !== false)
      .map((t) => ({ ...t, precioBase: t.precio, precio: porSede.get(t.id)?.precio ?? t.precio })),
  )
}

export async function POST(req: Request) {
  const guard = await requireApiAuth(['SUPERVISOR'])
  if (guard) return guard
  const body = await req.json()

  const tratamiento = await prisma.tratamiento.create({
    data: {
      nombre: body.nombre,
      descripcion: body.descripcion || '',
      categoria: body.categoria || null,
      precio: Number(body.precio) || 0,
      duracionMin: Number(body.duracionMin) || 0,
      diasProximoTratamiento: normalizeDias(body.diasProximoTratamiento),
      insumos: { create: normalizeInsumos(body.insumos) },
    },
    include: { insumos: { include: { producto: true } } },
  })

  return NextResponse.json(tratamiento, { status: 201 })
}

export async function PUT(req: Request) {
  const guard = await requireApiAuth(['SUPERVISOR'])
  if (guard) return guard
  const body = await req.json()

  if (!body.id) {
    return NextResponse.json({ error: 'ID requerido' }, { status: 400 })
  }

  const updated = await prisma.$transaction(async (tx) => {
    await tx.tratamientoProducto.deleteMany({ where: { tratamientoId: body.id } })
    return tx.tratamiento.update({
    where: { id: body.id },
    data: {
      nombre: body.nombre,
      descripcion: body.descripcion || '',
      categoria: body.categoria || null,
      precio: Number(body.precio) || 0,
      duracionMin: Number(body.duracionMin) || 0,
      activo: body.activo ?? true,
      diasProximoTratamiento: normalizeDias(body.diasProximoTratamiento),
      insumos: { create: normalizeInsumos(body.insumos) },
    },
    include: { insumos: { include: { producto: true } } },
    })
  })

  return NextResponse.json(updated)
}

function normalizeDias(value: unknown): number | null {
  const dias = Number(value)
  return Number.isFinite(dias) && dias > 0 ? Math.round(dias) : null
}

function normalizeInsumos(value: unknown) {
  if (!Array.isArray(value)) return []
  return value
    .filter((item): item is { productoId: string; cantidad?: number; unidad?: string } => Boolean(item && typeof item === 'object' && 'productoId' in item && typeof item.productoId === 'string'))
    .map((item) => ({ productoId: item.productoId, cantidad: Number(item.cantidad) > 0 ? Number(item.cantidad) : 1, unidad: item.unidad || 'unidad' }))
}

export async function DELETE(req: Request) {
  const guard = await requireApiAuth(['SUPERVISOR'])
  if (guard) return guard
  const url = new URL(req.url)
  const id = url.searchParams.get('id')

  if (!id) {
    return NextResponse.json({ error: 'ID requerido' }, { status: 400 })
  }

  await prisma.tratamiento.delete({ where: { id } })

  return NextResponse.json({ success: true })
}
