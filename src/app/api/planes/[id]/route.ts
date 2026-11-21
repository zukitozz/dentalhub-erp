import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireApiAuth } from '@/lib/api-auth'
import { calcularSaldo } from '@/lib/planes'

export const dynamic = 'force-dynamic'

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const params = await ctx.params
  const guard = await requireApiAuth()
  if (guard) return guard

  const plan = await prisma.plan.findUnique({
    where: { id: params.id },
    include: {
      paciente: { select: { id: true, nombre: true, dni: true, ruc: true, razonSocial: true } },
      tratamiento: { select: { id: true, nombre: true } },
      items: { orderBy: { orden: 'asc' } },
      // Todos los abonos (activos e inactivos) para poder mostrar el histórico completo del plan.
      facturas: {
        where: { tipo: 'NOTA_VENTA' },
        orderBy: { creadoAt: 'asc' },
      },
    },
  })
  if (!plan) {
    return NextResponse.json({ error: 'Plan no encontrado' }, { status: 404 })
  }

  const comprobanteFinal = await prisma.factura.findFirst({
    where: { planId: plan.id, tipo: { not: 'NOTA_VENTA' } },
    include: { items: true },
  })

  const abonosActivos = plan.facturas.filter((factura) => factura.activo)
  const { pagado, saldo } = calcularSaldo(plan.precioTotal, abonosActivos)

  return NextResponse.json({ ...plan, pagado, saldo, comprobanteFinal })
}

// Marca/desmarca una línea del plan como realizada (avance clínico del plan de tratamiento).
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const params = await ctx.params
  const guard = await requireApiAuth()
  if (guard) return guard

  const body = await req.json()
  const itemId = typeof body.itemId === 'string' ? body.itemId : ''
  const item = await prisma.planItem.findFirst({ where: { id: itemId, planId: params.id } })
  if (!item) return NextResponse.json({ error: 'Línea del plan no encontrada' }, { status: 404 })

  const realizado = Boolean(body.realizado)
  const actualizado = await prisma.planItem.update({
    where: { id: item.id },
    data: { realizado, realizadoAt: realizado ? new Date() : null },
  })
  return NextResponse.json(actualizado)
}
