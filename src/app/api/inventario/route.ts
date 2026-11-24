import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireApiAuth } from '@/lib/api-auth'
import { conStock, filaStock, getSedeCtx, mapaStock } from '@/lib/sede'
import { presignarProducto, presignarProductos } from '@/lib/storage'

export const dynamic = 'force-dynamic'

export async function GET() {
  const guard = await requireApiAuth()
  if (guard) return guard
  const productos = await prisma.producto.findMany({
    orderBy: { creadoAt: 'desc' },
  })

  const ctx = await getSedeCtx()
  // Stock de la sede elegida (o la suma de todas para el gerente con "Todas las sedes").
  return NextResponse.json(conStock(await presignarProductos(productos), await mapaStock(ctx?.sedeLectura ?? null)))
}

export async function PUT(req: Request) {
  const guard = await requireApiAuth(['SUPERVISOR'])
  if (guard) return guard
  const body = await req.json()

  if (!body.id) {
    return NextResponse.json({ error: 'ID requerido' }, { status: 400 })
  }

  const ctx = await getSedeCtx()
  if (!ctx?.sedeLectura) {
    return NextResponse.json({ error: 'Elige una sede en el selector para modificar su stock' }, { status: 400 })
  }

  try {
    await filaStock(prisma, body.id, ctx.sedeLectura)
    if (body.stock !== undefined || body.alertaStock !== undefined) {
      await prisma.productoSede.update({
        where: { productoId_sedeId: { productoId: body.id, sedeId: ctx.sedeLectura } },
        data: {
          stock: body.stock !== undefined ? Number(body.stock) : undefined,
          alertaStock: body.alertaStock !== undefined ? Number(body.alertaStock) : undefined,
        },
      })
    }
    const updated = await prisma.producto.update({
      where: { id: body.id },
      data: { codigoBarras: body.codigoBarras !== undefined ? body.codigoBarras || null : undefined },
    })
    const stocks = await mapaStock(ctx.sedeLectura)

    return NextResponse.json({ ...(await presignarProducto(updated)), stock: stocks.get(updated.id)?.stock ?? 0, alertaStock: stocks.get(updated.id)?.alertaStock ?? 5 })
  } catch (error) {
    if (error instanceof Error && 'code' in error && (error as { code?: string }).code === 'P2002') {
      return NextResponse.json({ error: 'Ese código de barras ya está asignado a otro producto' }, { status: 409 })
    }
    throw error
  }
}
