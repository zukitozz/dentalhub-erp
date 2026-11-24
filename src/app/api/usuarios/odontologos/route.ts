import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireApiAuth } from '@/lib/api-auth'
import { getSedeCtx } from '@/lib/sede'

export const dynamic = 'force-dynamic'

export async function GET() {
  const guard = await requireApiAuth()
  if (guard) return guard

  const ctx = await getSedeCtx()
  const odontologos = await prisma.user.findMany({
    where: { role: 'ODONTOLOGO', activo: true, ...(ctx?.sedeLectura ? { sedeId: ctx.sedeLectura } : {}) },
    select: { id: true, name: true, colegiatura: true, especialidad: true },
    orderBy: { name: 'asc' },
  })

  return NextResponse.json(odontologos)
}
