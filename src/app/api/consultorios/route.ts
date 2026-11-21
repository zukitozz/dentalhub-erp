import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireApiAuth } from '@/lib/api-auth'
import { atencionActualInclude, mapConsultorioConAtencion } from '@/lib/consultorios'

export const dynamic = 'force-dynamic'

export async function GET() {
  const guard = await requireApiAuth()
  if (guard) return guard

  const consultorios = await prisma.consultorio.findMany({
    orderBy: { nombre: 'asc' },
    include: atencionActualInclude,
  })

  return NextResponse.json(consultorios.map(mapConsultorioConAtencion))
}

export async function POST(req: Request) {
  const guard = await requireApiAuth(['SUPERVISOR'])
  if (guard) return guard
  const body = await req.json()

  const consultorio = await prisma.consultorio.create({
    data: {
      nombre: body.nombre,
      estado: body.estado || 'DISPONIBLE',
    },
  })

  return NextResponse.json(consultorio, { status: 201 })
}

export async function PUT(req: Request) {
  const guard = await requireApiAuth(['SUPERVISOR'])
  if (guard) return guard
  const body = await req.json()

  if (!body.id) {
    return NextResponse.json({ error: 'ID requerido' }, { status: 400 })
  }

  if (body.estado) {
    return NextResponse.json(
      { error: 'Usa PATCH /api/consultorios/[id]/estado para cambiar el estado de el consultorio' },
      { status: 400 }
    )
  }

  const updated = await prisma.consultorio.update({
    where: { id: body.id },
    data: { nombre: body.nombre },
  })

  return NextResponse.json(updated)
}

export async function DELETE(req: Request) {
  const guard = await requireApiAuth(['SUPERVISOR'])
  if (guard) return guard
  const url = new URL(req.url)
  const id = url.searchParams.get('id')

  if (!id) {
    return NextResponse.json({ error: 'ID requerido' }, { status: 400 })
  }

  await prisma.consultorio.delete({ where: { id } })

  return NextResponse.json({ success: true })
}
