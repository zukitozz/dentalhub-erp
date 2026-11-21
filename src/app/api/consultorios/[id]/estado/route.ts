import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireApiAuth } from '@/lib/api-auth'
import { auth } from '@/lib/auth'
import { cambiarEstadoConsultorio } from '@/lib/consultorios'

export const dynamic = 'force-dynamic'

const ESTADOS_VALIDOS = ['DISPONIBLE', 'ATENCION', 'LIMPIEZA', 'MANTENIMIENTO']

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const params = await ctx.params
  const guard = await requireApiAuth(['ADMIN', 'SUPERVISOR'])
  if (guard) return guard

  const body = await req.json()
  if (!ESTADOS_VALIDOS.includes(body.estado)) {
    return NextResponse.json({ error: 'Estado inválido' }, { status: 400 })
  }

  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Usuario requerido' }, { status: 401 })
  }

  const consultorio = await prisma.consultorio.findUnique({ where: { id: params.id } })
  if (!consultorio) {
    return NextResponse.json({ error: 'Consultorio no encontrada' }, { status: 404 })
  }

  if (consultorio.estado === 'ATENCION' && body.estado !== 'ATENCION') {
    return NextResponse.json(
      { error: 'Debes finalizar o cancelar la atención en curso antes de cambiar el estado de el consultorio' },
      { status: 409 }
    )
  }

  const updated = await prisma.$transaction((tx) =>
    cambiarEstadoConsultorio(tx, {
      consultorioId: params.id,
      estadoNuevo: body.estado,
      usuarioId: session.user.id,
      motivo: body.motivo || null,
    })
  )

  return NextResponse.json(updated)
}
