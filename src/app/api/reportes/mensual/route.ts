import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireApiAuth } from '@/lib/api-auth'
import { getSedeCtx } from '@/lib/sede'
import { CATEGORIA_COMPRAS } from '@/lib/compras'
import { fechaPeru, mesActualPeru, rangoMesPeru } from '@/lib/fechas'
import { obtenerIngresosDelPeriodo } from '@/lib/reportesIngresos'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const guard = await requireApiAuth(['SUPERVISOR'])
  if (guard) return guard

  const mes = new URL(req.url).searchParams.get('mes') || mesActualPeru()
  const rango = rangoMesPeru(mes)
  const ctx = await getSedeCtx()
  const sede = ctx?.filtro ?? {}

  const [ingresos, gastos, gastosPorCategoria, cierres] = await Promise.all([
    obtenerIngresosDelPeriodo(prisma, rango, ctx?.sedeLectura),
    prisma.gasto.aggregate({
      where: { ...sede, activo: true, fecha: rango },
      _sum: { monto: true },
    }),
    prisma.gasto.groupBy({
      by: ['categoria'],
      where: { ...sede, activo: true, fecha: rango },
      _sum: { monto: true },
    }),
    prisma.cierreTurno.findMany({
      where: { ...sede, activo: true, fechaFin: rango },
      select: { id: true, fechaInicio: true, fechaFin: true, totalVentas: true, totalGastos: true, usuario: { select: { name: true } } },
      orderBy: { fechaFin: 'asc' },
    }),
  ])

  const totalGastos = gastos._sum.monto || 0

  // Compras del mes (gastos de categoría Compras) y consumo de inventario: salidas manuales
  // más productos vendidos en comprobantes pagados (la facturación descuenta stock sin movimiento).
  const [compras, salidas, itemsProducto] = await Promise.all([
    prisma.gasto.findMany({
      where: { ...sede, activo: true, categoria: CATEGORIA_COMPRAS, fecha: rango },
      select: { id: true, concepto: true, proveedor: true, monto: true, fecha: true },
      orderBy: { fecha: 'desc' },
    }),
    prisma.movimientoInventario.findMany({
      where: { ...sede, tipo: 'SALIDA', creadoAt: rango },
      select: { cantidad: true, producto: { select: { id: true, nombre: true, precioCosto: true } } },
    }),
    prisma.facturaItem.findMany({
      where: { productoId: { not: null }, factura: { activo: true, estado: 'PAGADO', fechaEmision: rango, ...(ctx?.sedeLectura ? { sedeId: ctx.sedeLectura } : {}) } },
      select: { cantidad: true, producto: { select: { id: true, nombre: true, precioCosto: true } } },
    }),
  ])
  const consumoMapa = new Map<string, { producto: string; unidades: number; costo: number }>()
  for (const fila of [...salidas, ...itemsProducto]) {
    if (!fila.producto) continue
    const actual = consumoMapa.get(fila.producto.id) ?? { producto: fila.producto.nombre, unidades: 0, costo: 0 }
    actual.unidades += fila.cantidad
    actual.costo += fila.cantidad * (fila.producto.precioCosto ?? 0)
    consumoMapa.set(fila.producto.id, actual)
  }
  const consumo = [...consumoMapa.values()].sort((a, b) => b.unidades - a.unidades)

  // Serie diaria (hora de Perú) para el gráfico de tendencia.
  const [facturasDia, gastosDia] = await Promise.all([
    prisma.factura.findMany({
      where: { activo: true, estado: 'PAGADO', cuentaParaCierre: true, fechaEmision: rango, ...(ctx?.sedeLectura ? { sedeId: ctx.sedeLectura } : {}) },
      select: { fechaEmision: true, total: true },
    }),
    prisma.gasto.findMany({ where: { ...sede, activo: true, fecha: rango }, select: { fecha: true, monto: true } }),
  ])
  const [anio, mesNum] = mes.split('-').map(Number)
  const diasMes = new Date(Date.UTC(anio, mesNum, 0)).getUTCDate()
  const porDia = Array.from({ length: diasMes }, (_, i) => ({ fecha: `${mes}-${String(i + 1).padStart(2, '0')}`, ingresos: 0, gastos: 0 }))
  for (const f of facturasDia) {
    if (!f.fechaEmision) continue
    const d = porDia[Number(fechaPeru(f.fechaEmision).slice(8)) - 1]
    if (d) d.ingresos += f.total
  }
  for (const g of gastosDia) { const d = porDia[Number(fechaPeru(g.fecha).slice(8)) - 1]; if (d) d.gastos += g.monto }

  return NextResponse.json({
    mes,
    ingresos,
    gastos: {
      total: totalGastos,
      porCategoria: gastosPorCategoria.map((item) => ({
        categoria: item.categoria || 'Sin categoría',
        total: item._sum.monto || 0,
      })),
    },
    diferencia: ingresos.total - totalGastos,
    porDia,
    compras: { total: compras.reduce((t, c) => t + c.monto, 0), items: compras },
    consumo,
    cierres: cierres.map((cierre) => ({
      id: cierre.id,
      fechaInicio: cierre.fechaInicio,
      totalGastos: cierre.totalGastos,
      fechaFin: cierre.fechaFin,
      totalVentas: cierre.totalVentas,
      usuario: cierre.usuario.name,
    })),
  })
}
