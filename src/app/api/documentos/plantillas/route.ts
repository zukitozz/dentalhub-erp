import { NextResponse } from 'next/server'
import type { Prisma } from '@/generated/prisma/client'
import { prisma } from '@/lib/prisma'
import { requireApiAuth } from '@/lib/api-auth'
import { asegurarPlantillasBase } from '@/lib/documentosDb'
import { normalizarCampos, TIPOS_DOCUMENTO } from '@/lib/documentos'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const guard = await requireApiAuth()
  if (guard) return guard

  await asegurarPlantillasBase()
  const todas = new URL(req.url).searchParams.get('todas') === 'true'
  const plantillas = await prisma.documentoPlantilla.findMany({
    where: todas ? {} : { activo: true },
    orderBy: [{ tipo: 'asc' }, { nombre: 'asc' }],
  })
  return NextResponse.json(plantillas)
}

export async function POST(req: Request) {
  const guard = await requireApiAuth(['ADMIN', 'SUPERVISOR', 'ODONTOLOGO'])
  if (guard) return guard

  const body = await req.json()
  const nombre = typeof body.nombre === 'string' ? body.nombre.trim() : ''
  const contenido = typeof body.contenido === 'string' ? body.contenido.trim() : ''
  const tipo = TIPOS_DOCUMENTO.find((t) => t.codigo === body.tipo)
  if (!tipo || !nombre || !contenido) return NextResponse.json({ error: 'Tipo, nombre y contenido son requeridos' }, { status: 400 })

  const plantilla = await prisma.documentoPlantilla.create({
    data: { tipo: tipo.codigo, nombre, contenido, campos: normalizarCampos(body.campos) as unknown as Prisma.InputJsonValue },
  })
  return NextResponse.json(plantilla, { status: 201 })
}
