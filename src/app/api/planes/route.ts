import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { requireApiAuth } from '@/lib/api-auth'
import { calcularSaldo } from '@/lib/planes'

export const dynamic = 'force-dynamic'

const abonosActivosInclude = {
  facturas: { where: { tipo: 'NOTA_VENTA' as const, activo: true } },
  paciente: { select: { id: true, nombre: true } },
  tratamiento: { select: { id: true, nombre: true } },
  sesiones: { orderBy: { numero: 'asc' as const } },
  items: { orderBy: { orden: 'asc' as const } },
}

function conSaldoPendiente(plan: { precioTotal: number; facturas: { total: number }[] }) {
  const { pagado, saldo } = calcularSaldo(plan.precioTotal, plan.facturas)
  return { pagado, saldo }
}

export async function GET(req: Request) {
  const guard = await requireApiAuth()
  if (guard) return guard

  const url = new URL(req.url)
  const soloConSaldo = url.searchParams.get('conSaldo') === 'true'

  const planes = await prisma.plan.findMany({
    where: { activo: true, ...(soloConSaldo ? { estado: 'ABIERTO' } : {}) },
    include: abonosActivosInclude,
    orderBy: { creadoAt: 'desc' },
  })

  const resultado = planes
    .map((plan) => ({ ...plan, ...conSaldoPendiente(plan) }))
    .filter((plan) => !soloConSaldo || plan.saldo > 0.01)

  return NextResponse.json(resultado)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Usuario autenticado requerido' }, { status: 401 })
  }

  const body = await req.json()
  const pacienteId = typeof body.pacienteId === 'string' ? body.pacienteId : ''
  const nombre = typeof body.nombre === 'string' ? body.nombre.trim() : ''
  // Si el plan trae líneas (pieza, tratamiento, precio) el total y las sesiones se calculan a partir de ellas.
  const itemsBody: { descripcion?: unknown; pieza?: unknown; cantidad?: unknown; precioUnit?: unknown; tratamientoId?: unknown }[] = Array.isArray(body.items) ? body.items : []
  const items = itemsBody
    .map((item, orden) => ({
      descripcion: typeof item.descripcion === 'string' ? item.descripcion.trim() : '',
      pieza: Number.isInteger(Number(item.pieza)) && Number(item.pieza) > 0 ? Number(item.pieza) : null,
      cantidad: Math.max(1, Math.floor(Number(item.cantidad) || 1)),
      precioUnit: Math.max(0, Number(item.precioUnit) || 0),
      tratamientoId: typeof item.tratamientoId === 'string' && item.tratamientoId ? item.tratamientoId : null,
      orden,
    }))
    .filter((item) => item.descripcion)
  const sesionesTotal = items.length > 0 ? items.reduce((acc, i) => acc + i.cantidad, 0) : Number(body.sesionesTotal)
  const precioTotal = items.length > 0 ? Math.round(items.reduce((acc, i) => acc + i.cantidad * i.precioUnit, 0) * 100) / 100 : Number(body.precioTotal)
  const tratamientoId = typeof body.tratamientoId === 'string' && body.tratamientoId.length > 0 ? body.tratamientoId : null

  if (!pacienteId || !nombre) {
    return NextResponse.json({ error: 'Paciente y nombre del plan son requeridos' }, { status: 400 })
  }
  if (!Number.isInteger(sesionesTotal) || sesionesTotal <= 0) {
    return NextResponse.json({ error: 'sesionesTotal debe ser un entero mayor a 0' }, { status: 400 })
  }
  if (!Number.isFinite(precioTotal) || precioTotal <= 0) {
    return NextResponse.json({ error: 'precioTotal debe ser mayor a 0' }, { status: 400 })
  }

  const plan = await prisma.plan.create({
    data: {
      paciente: { connect: { id: pacienteId } },
      tratamiento: tratamientoId ? { connect: { id: tratamientoId } } : undefined,
      nombre,
      sesionesTotal,
      precioTotal,
      usuario: { connect: { id: session.user.id } },
      items: items.length > 0 ? { create: items } : undefined,
    },
    include: abonosActivosInclude,
  })

  return NextResponse.json({ ...plan, ...conSaldoPendiente(plan) }, { status: 201 })
}
