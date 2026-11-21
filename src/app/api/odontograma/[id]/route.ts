import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireApiAuth } from '@/lib/api-auth'
import { ESTADOS_HALLAZGO } from '@/lib/odontograma'

export const dynamic = 'force-dynamic'

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const guard = await requireApiAuth()
  if (guard) return guard

  const body = await req.json()
  const data: { estado?: 'EXISTENTE' | 'PLANIFICADO' | 'REALIZADO'; notas?: string | null } = {}
  if (typeof body.estado === 'string') {
    if (!ESTADOS_HALLAZGO.some((e) => e.codigo === body.estado)) return NextResponse.json({ error: 'Estado inválido' }, { status: 400 })
    data.estado = body.estado
  }
  if (typeof body.notas === 'string') data.notas = body.notas.trim() || null

  const existe = await prisma.odontogramaHallazgo.findFirst({ where: { id, activo: true } })
  if (!existe) return NextResponse.json({ error: 'Hallazgo no encontrado' }, { status: 404 })
  return NextResponse.json(await prisma.odontogramaHallazgo.update({ where: { id }, data }))
}

// Baja lógica: el hallazgo deja de verse en el odontograma pero se conserva para auditoría.
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const guard = await requireApiAuth()
  if (guard) return guard

  const existe = await prisma.odontogramaHallazgo.findFirst({ where: { id, activo: true } })
  if (!existe) return NextResponse.json({ error: 'Hallazgo no encontrado' }, { status: 404 })
  await prisma.odontogramaHallazgo.update({ where: { id }, data: { activo: false } })
  return NextResponse.json({ success: true })
}
