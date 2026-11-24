import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireApiAuth } from '@/lib/api-auth'

export const dynamic = 'force-dynamic'

// Registra (o cambia) quién recomendó al paciente, p. ej. desde la primera venta, sin tocar el resto de sus datos.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireApiAuth(['ADMIN', 'SUPERVISOR'])
  if (guard) return guard
  const { id } = await params
  const body = await req.json()
  const referidoPorId = typeof body.referidoPorId === 'string' && body.referidoPorId ? body.referidoPorId : null
  if (referidoPorId === id) {
    return NextResponse.json({ error: 'Un paciente no puede recomendarse a sí mismo' }, { status: 400 })
  }
  if (referidoPorId && !(await prisma.paciente.findUnique({ where: { id: referidoPorId }, select: { id: true } }))) {
    return NextResponse.json({ error: 'Quien recomienda no existe' }, { status: 404 })
  }
  const paciente = await prisma.paciente.update({ where: { id }, data: { referidoPorId }, select: { id: true, referidoPorId: true } })
  return NextResponse.json(paciente)
}
