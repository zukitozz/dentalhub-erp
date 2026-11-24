import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireApiAuth } from '@/lib/api-auth'

export const dynamic = 'force-dynamic'

export async function GET() {
  const guard = await requireApiAuth()
  if (guard) return guard
  const sedes = await prisma.sede.findMany({ where: { activo: true }, orderBy: { creadoAt: 'asc' } })
  return NextResponse.json(sedes)
}

export async function POST(req: Request) {
  const guard = await requireApiAuth(['SUPERVISOR'])
  if (guard) return guard
  const body = await req.json()
  if (typeof body.nombre !== 'string' || !body.nombre.trim()) {
    return NextResponse.json({ error: 'El nombre de la sede es requerido' }, { status: 400 })
  }
  const sede = await prisma.sede.create({ data: { nombre: body.nombre.trim(), direccion: body.direccion?.trim() || null } })
  return NextResponse.json(sede, { status: 201 })
}

export async function PUT(req: Request) {
  const guard = await requireApiAuth(['SUPERVISOR'])
  if (guard) return guard
  const body = await req.json()
  if (!body.id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 })
  if (typeof body.nombre !== 'string' || !body.nombre.trim()) {
    return NextResponse.json({ error: 'El nombre de la sede es requerido' }, { status: 400 })
  }
  const sede = await prisma.sede.update({
    where: { id: body.id },
    data: { nombre: body.nombre.trim(), direccion: body.direccion?.trim() || null },
  })
  return NextResponse.json(sede)
}
