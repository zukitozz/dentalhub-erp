import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireApiAuth } from '@/lib/api-auth'
import { calcularSaldo } from '@/lib/planes'

export const dynamic = 'force-dynamic'

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const params = await ctx.params
  const guard = await requireApiAuth()
  if (guard) return guard

  const planes = await prisma.plan.findMany({
    where: { pacienteId: params.id, activo: true },
    include: {
      tratamiento: { select: { id: true, nombre: true } },
      facturas: { where: { tipo: 'NOTA_VENTA', activo: true } },
      sesiones: { orderBy: { numero: 'asc' } },
      items: { orderBy: { orden: 'asc' } },
    },
    orderBy: { creadoAt: 'desc' },
  })

  const resultado = planes.map((plan) => ({ ...plan, ...calcularSaldo(plan.precioTotal, plan.facturas) }))

  return NextResponse.json(resultado)
}
