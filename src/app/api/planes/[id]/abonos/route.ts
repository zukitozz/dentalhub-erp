import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { registrarAbono, PlanError } from '@/lib/planes'
import type { MetodoPago } from '@/generated/prisma/client'

export const dynamic = 'force-dynamic'

const METODOS_PAGO_VALIDOS = new Set(['EFECTIVO', 'TARJETA', 'YAPE', 'PLIN', 'TRANSFERENCIA', 'DEPOSITO'])

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const params = await ctx.params
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Usuario autenticado requerido' }, { status: 401 })
  }

  const body = await req.json()
  const monto = Number(body.monto)
  const metodoPago = typeof body.metodoPago === 'string' ? body.metodoPago : ''

  if (!Number.isFinite(monto) || monto <= 0) {
    return NextResponse.json({ error: 'monto debe ser mayor a 0' }, { status: 400 })
  }
  if (!METODOS_PAGO_VALIDOS.has(metodoPago)) {
    return NextResponse.json({ error: 'metodoPago inválido' }, { status: 400 })
  }

  try {
    const factura = await registrarAbono({
      planId: params.id,
      monto,
      metodoPago: metodoPago as MetodoPago,
      usuarioId: session.user.id,
    })
    return NextResponse.json(factura, { status: 201 })
  } catch (error) {
    if (error instanceof PlanError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    const mensaje = error instanceof Error ? error.message : 'No se pudo registrar el abono'
    return NextResponse.json({ error: mensaje }, { status: 500 })
  }
}
