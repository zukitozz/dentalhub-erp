import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireApiAuth } from '@/lib/api-auth'

export const dynamic = 'force-dynamic'

// Series de comprobantes por sede (cada sede emite con sus propias series, p. ej. F001 / F002).
export async function GET(req: Request) {
  const guard = await requireApiAuth(['SUPERVISOR'])
  if (guard) return guard
  const sedeId = new URL(req.url).searchParams.get('sedeId')
  const series = await prisma.serie.findMany({ where: sedeId ? { sedeId } : {}, orderBy: [{ tipoComprobante: 'asc' }, { serie: 'asc' }] })
  return NextResponse.json(series)
}

const TIPOS: Record<string, string> = { '01': 'FACTURA', '03': 'BOLETA', '07': 'NOTA_CREDITO', '08': 'NOTA_DEBITO', '50': 'NOTA_DESPACHO', '51': 'NOTA_VENTA' }

export async function POST(req: Request) {
  const guard = await requireApiAuth(['SUPERVISOR'])
  if (guard) return guard
  const body = await req.json()
  const tipo = String(body.tipoComprobante || '')
  const serie = String(body.serie || '').trim()
  if (!body.sedeId || !TIPOS[tipo]) return NextResponse.json({ error: 'Sede y tipo de comprobante válidos requeridos' }, { status: 400 })
  if (!/^\d{3}$/.test(serie)) return NextResponse.json({ error: 'La serie debe tener 3 dígitos (por ejemplo 002)' }, { status: 400 })

  const existe = await prisma.serie.findFirst({ where: { sedeId: body.sedeId, tipoComprobante: tipo, serie } })
  if (existe) return NextResponse.json(await prisma.serie.update({ where: { id: existe.id }, data: { estado: 1 } }))

  const creada = await prisma.serie.create({
    data: { sedeId: body.sedeId, tipoComprobante: tipo, codigoProposito: TIPOS[tipo], serie, estado: 1, descripcion: body.descripcion || null },
  })
  return NextResponse.json(creada, { status: 201 })
}

// Habilita o deshabilita una serie (estado 1 / 0).
export async function PUT(req: Request) {
  const guard = await requireApiAuth(['SUPERVISOR'])
  if (guard) return guard
  const body = await req.json()
  if (!body.id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 })
  const serie = await prisma.serie.update({ where: { id: body.id }, data: { estado: body.estado ? 1 : 0 } })
  return NextResponse.json(serie)
}
