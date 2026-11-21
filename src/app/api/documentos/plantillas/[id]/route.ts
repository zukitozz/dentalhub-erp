import { NextResponse } from 'next/server'
import type { Prisma } from '@/generated/prisma/client'
import { prisma } from '@/lib/prisma'
import { requireApiAuth } from '@/lib/api-auth'
import { normalizarCampos } from '@/lib/documentos'

export const dynamic = 'force-dynamic'

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const guard = await requireApiAuth()
  if (guard) return guard

  const body = await req.json()
  const data: Prisma.DocumentoPlantillaUpdateInput = {}
  if (typeof body.nombre === 'string' && body.nombre.trim()) data.nombre = body.nombre.trim()
  if (typeof body.contenido === 'string' && body.contenido.trim()) data.contenido = body.contenido.trim()
  if (body.campos !== undefined) data.campos = normalizarCampos(body.campos) as unknown as Prisma.InputJsonValue
  if (typeof body.activo === 'boolean') data.activo = body.activo

  const existe = await prisma.documentoPlantilla.findUnique({ where: { id } })
  if (!existe) return NextResponse.json({ error: 'Plantilla no encontrada' }, { status: 404 })
  return NextResponse.json(await prisma.documentoPlantilla.update({ where: { id }, data }))
}

// Las plantillas ya usadas se desactivan (los documentos emitidos conservan su contenido); las nuevas se borran.
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const guard = await requireApiAuth(['ADMIN', 'SUPERVISOR'])
  if (guard) return guard

  const usos = await prisma.documento.count({ where: { plantillaId: id } })
  if (usos > 0) {
    await prisma.documentoPlantilla.update({ where: { id }, data: { activo: false } })
    return NextResponse.json({ success: true, desactivada: true })
  }
  await prisma.documentoPlantilla.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
