import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireApiAuth } from '@/lib/api-auth'

export const dynamic = 'force-dynamic'

// Precios y disponibilidad por sede: catálogo único con precio propio opcional por sede.
export async function GET(req: Request) {
  const guard = await requireApiAuth(['SUPERVISOR'])
  if (guard) return guard
  const sedeId = new URL(req.url).searchParams.get('sedeId')
  if (!sedeId) return NextResponse.json({ error: 'sedeId requerido' }, { status: 400 })

  const [tratamientos, productos, tratSede, prodSede] = await Promise.all([
    prisma.tratamiento.findMany({ where: { activo: true }, orderBy: { nombre: 'asc' }, select: { id: true, nombre: true, categoria: true, precio: true } }),
    prisma.producto.findMany({ orderBy: { nombre: 'asc' }, select: { id: true, nombre: true, precioVenta: true } }),
    prisma.tratamientoSede.findMany({ where: { sedeId } }),
    prisma.productoSede.findMany({ where: { sedeId } }),
  ])
  const t = new Map(tratSede.map((f) => [f.tratamientoId, f]))
  const p = new Map(prodSede.map((f) => [f.productoId, f]))
  return NextResponse.json({
    tratamientos: tratamientos.map((x) => ({ ...x, precioSede: t.get(x.id)?.precio ?? null, activoSede: t.get(x.id)?.activo ?? true })),
    productos: productos.map((x) => ({ ...x, precioSede: p.get(x.id)?.precioVenta ?? null })),
  })
}

function precioOpcional(valor: unknown): number | null {
  if (valor === null || valor === '' || valor === undefined) return null
  const n = Number(valor)
  return Number.isFinite(n) && n >= 0 ? n : null
}

// Body: { sedeId, tipo: 'tratamiento' | 'producto', id, precio: number | null, activo?: boolean }
export async function PUT(req: Request) {
  const guard = await requireApiAuth(['SUPERVISOR'])
  if (guard) return guard
  const body = await req.json()
  if (!body.sedeId || !body.id) return NextResponse.json({ error: 'sedeId e id requeridos' }, { status: 400 })
  const precio = precioOpcional(body.precio)

  if (body.tipo === 'producto') {
    const fila = await prisma.productoSede.upsert({
      where: { productoId_sedeId: { productoId: body.id, sedeId: body.sedeId } },
      update: { precioVenta: precio },
      create: { productoId: body.id, sedeId: body.sedeId, precioVenta: precio },
    })
    return NextResponse.json(fila)
  }

  const fila = await prisma.tratamientoSede.upsert({
    where: { tratamientoId_sedeId: { tratamientoId: body.id, sedeId: body.sedeId } },
    update: { precio, ...(typeof body.activo === 'boolean' ? { activo: body.activo } : {}) },
    create: { tratamientoId: body.id, sedeId: body.sedeId, precio, activo: typeof body.activo === 'boolean' ? body.activo : true },
  })
  return NextResponse.json(fila)
}
