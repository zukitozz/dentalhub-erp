import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { requireApiAuth } from '@/lib/api-auth'
import { COOKIE_SEDE, SEDE_TODAS, getSedeCtx } from '@/lib/sede'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// Sede activa del usuario (para el selector del encabezado).
export async function GET() {
  const guard = await requireApiAuth()
  if (guard) return guard
  const ctx = await getSedeCtx()
  const sede = ctx?.sedeLectura ? await prisma.sede.findUnique({ where: { id: ctx.sedeLectura } }) : null
  return NextResponse.json({ sedeId: ctx?.sedeLectura ?? null, nombre: sede?.nombre ?? null, puedeElegir: ctx?.role === 'SUPERVISOR' })
}

// Solo el gerente cambia de sede (o ve todas).
export async function POST(req: Request) {
  const guard = await requireApiAuth(['SUPERVISOR'])
  if (guard) return guard
  const body = await req.json()
  const valor = typeof body.sedeId === 'string' && body.sedeId ? body.sedeId : SEDE_TODAS
  if (valor !== SEDE_TODAS) {
    const existe = await prisma.sede.findFirst({ where: { id: valor, activo: true }, select: { id: true } })
    if (!existe) return NextResponse.json({ error: 'Sede no encontrada' }, { status: 404 })
  }
  ;(await cookies()).set(COOKIE_SEDE, valor, { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 30 })
  return NextResponse.json({ sedeId: valor === SEDE_TODAS ? null : valor })
}
