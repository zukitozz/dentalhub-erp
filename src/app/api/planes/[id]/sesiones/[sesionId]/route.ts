import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { eliminarSesion, PlanError } from '@/lib/planes'

export const dynamic = 'force-dynamic'

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string; sesionId: string }> }) {
  const params = await ctx.params
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Usuario autenticado requerido' }, { status: 401 })
  }

  try {
    await eliminarSesion({ planId: params.id, sesionId: params.sesionId })
    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof PlanError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    const mensaje = error instanceof Error ? error.message : 'No se pudo eliminar la sesión'
    return NextResponse.json({ error: mensaje }, { status: 500 })
  }
}
