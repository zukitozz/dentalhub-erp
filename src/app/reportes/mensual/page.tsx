'use client'

import Link from 'next/link'
import { DetalleCierre, type CierreResumen } from '@/components/DetalleCierre'
import { useEffect, useState } from 'react'
import { Spinner } from '@/components/Spinner'
import { BarrasHorizontales, COLOR_GASTOS, COLOR_INGRESOS, GraficoDiario, type PuntoDia } from '@/components/ReporteCharts'

interface ReporteMensual {
  mes: string
  ingresos: { total: number; totalesPorMetodo: Record<string, number> }
  gastos: { total: number; porCategoria: { categoria: string; total: number }[] }
  diferencia: number
  porDia: PuntoDia[]
  compras: { total: number; items: { id: string; concepto: string; proveedor: string | null; monto: number }[] }
  consumo: { producto: string; unidades: number; costo: number }[]
  cierres: { id: string; fechaInicio: string; fechaFin: string; totalVentas: number; totalGastos: number; usuario: string }[]
}

const metodoLabels: Record<string, string> = {
  EFECTIVO: 'Efectivo',
  TARJETA: 'POS',
  YAPE: 'Yape / Plin',
  TRANSFERENCIA: 'Transferencia',
  DEPOSITO: 'Depósito',
}

function mesActual() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export default function ReporteMensualPage() {
  const [mes, setMes] = useState(mesActual())
  const [reporte, setReporte] = useState<ReporteMensual | null>(null)
  const [cargando, setCargando] = useState(true)
  const [cierreAbierto, setCierreAbierto] = useState<CierreResumen | null>(null)

  useEffect(() => {
    setCargando(true)
    fetch(`/api/reportes/mensual?mes=${mes}`)
      .then((res) => res.json())
      .then((data) => setReporte(data))
      .finally(() => setCargando(false))
  }, [mes])

  const diferenciaPositiva = (reporte?.diferencia ?? 0) >= 0

  return (
    <div className="page-shell px-4 py-8 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="card-surface print:hidden">
          <p className="eyebrow">Reportes</p>
          <h1 className="mt-3 page-heading text-3xl">Reporte mensual</h1>
          <p className="mt-2 text-ink-600">Solo para gerente: compara ingresos y gastos del mes para ver la utilidad.</p>
          <Link href="/reportes" className="btn-brand mt-5 inline-flex">Ver cierres de turno</Link>
        </div>

        <div className="card-surface flex flex-wrap items-end justify-between gap-4 print:hidden">
          <div>
            <label className="block text-sm font-medium text-ink-700">Mes</label>
            <input
              type="month"
              value={mes}
              onChange={(event) => setMes(event.target.value)}
              className="field mt-2 max-w-xs"
            />
          </div>
          <button type="button" disabled={cargando || !reporte} onClick={() => window.print()} className="btn-brand disabled:opacity-60">
            Imprimir cierre de mes
          </button>
        </div>

        <h1 className="hidden text-2xl font-bold text-ink-900 print:block">
          Cierre de mes · {mes} · HubDental
        </h1>

        {cargando || !reporte ? (
          <p className="flex items-center gap-2 text-sm text-ink-500"><Spinner /> Cargando reporte...</p>
        ) : (
          <>
            <div className={`card-surface border-2 ${diferenciaPositiva ? 'border-brand-300 bg-brand-50' : 'border-danger-300 bg-danger-50'}`}>
              <p className="eyebrow">Utilidad del mes</p>
              <p className={`mt-2 text-4xl font-bold ${diferenciaPositiva ? 'text-brand-900' : 'text-danger-700'}`}>
                S/ {reporte.diferencia.toFixed(2)}
              </p>
              <p className="mt-2 text-sm text-ink-600">
                Ingresos S/ {reporte.ingresos.total.toFixed(2)} − Gastos S/ {reporte.gastos.total.toFixed(2)}
              </p>
            </div>

            <div className="card-surface">
              <h2 className="text-xl font-semibold text-brand-900">Ingresos y gastos por día</h2>
              <div className="mt-4"><GraficoDiario datos={reporte.porDia} /></div>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <div className="card-surface">
                <h2 className="text-xl font-semibold text-brand-900">Ingresos por método de pago</h2>
                <BarrasHorizontales
                  color={COLOR_INGRESOS}
                  vacio="No hay ingresos registrados este mes."
                  datos={Object.entries(reporte.ingresos.totalesPorMetodo)
                    .filter(([metodo]) => metodo !== 'PLIN')
                    .map(([metodo, valor]) => ({ etiqueta: metodoLabels[metodo] || metodo, valor }))}
                />
                <p className="mt-5 text-sm text-ink-600">Total ingresos: <span className="font-semibold text-brand-900">S/ {reporte.ingresos.total.toFixed(2)}</span></p>
              </div>

              <div className="card-surface">
                <h2 className="text-xl font-semibold text-brand-900">Gastos por categoría</h2>
                <BarrasHorizontales
                  color={COLOR_GASTOS}
                  vacio="No hay gastos registrados este mes."
                  datos={reporte.gastos.porCategoria.map((item) => ({ etiqueta: item.categoria, valor: item.total }))}
                />
                <p className="mt-5 text-sm text-ink-600">Total gastos: <span className="font-semibold text-danger-700">S/ {reporte.gastos.total.toFixed(2)}</span></p>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <div className="card-surface">
                <h2 className="text-xl font-semibold text-brand-900">Compras del mes</h2>
                <BarrasHorizontales
                  color={COLOR_GASTOS}
                  vacio="No se registraron compras este mes."
                  datos={reporte.compras.items.map((c) => ({ etiqueta: c.proveedor ? `${c.concepto} · ${c.proveedor}` : c.concepto, valor: c.monto }))}
                />
                <p className="mt-5 text-sm text-ink-600">Total compras: <span className="font-semibold text-danger-700">S/ {reporte.compras.total.toFixed(2)}</span></p>
              </div>

              <div className="card-surface">
                <h2 className="text-xl font-semibold text-brand-900">Productos consumidos</h2>
                <BarrasHorizontales
                  color={COLOR_INGRESOS}
                  vacio="No hubo consumo de productos este mes."
                  formato={(n) => `${n} uds`}
                  datos={reporte.consumo.map((c) => ({ etiqueta: c.producto, valor: c.unidades }))}
                />
                <p className="mt-5 text-sm text-ink-600">
                  Costo estimado: <span className="font-semibold text-brand-900">S/ {reporte.consumo.reduce((t, c) => t + c.costo, 0).toFixed(2)}</span>
                  <span className="text-xs text-ink-500"> · ventas de productos y salidas de inventario</span>
                </p>
              </div>
            </div>

            <div className="card-surface">
              <h2 className="text-xl font-semibold text-brand-900">Cierres de turno realizados ({reporte.cierres.length})</h2>
              <p className="mt-1 text-xs text-ink-500 print:hidden">Haz clic en un cierre para ver todas sus ventas.</p>
              {reporte.cierres.length === 0 ? (
                <p className="mt-4 text-sm text-ink-500">No se realizaron cierres este mes.</p>
              ) : (
                <table className="mt-5 w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-ink-200 text-ink-500">
                      <th className="py-2 pr-4">Fecha y hora</th>
                      <th className="py-2 pr-4">Cerrado por</th>
                      <th className="py-2 text-right">Monto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reporte.cierres.map((cierre) => (
                      <tr
                        key={cierre.id}
                        tabIndex={0}
                        role="button"
                        onClick={() => setCierreAbierto({ id: cierre.id, fechaInicio: cierre.fechaInicio, fechaFin: cierre.fechaFin, totalVentas: cierre.totalVentas, totalGastos: cierre.totalGastos, usuarioNombre: cierre.usuario })}
                        onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.click() }}
                        className="cursor-pointer border-b border-ink-100 transition hover:bg-brand-50"
                      >
                        <td className="py-2 pr-4">{new Date(cierre.fechaFin).toLocaleString('es-PE')}</td>
                        <td className="py-2 pr-4">{cierre.usuario}</td>
                        <td className="py-2 text-right font-semibold text-ink-800">S/ {cierre.totalVentas.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={2} className="pt-3 font-semibold text-ink-700">Total cierres</td>
                      <td className="pt-3 text-right font-semibold text-brand-900">
                        S/ {reporte.cierres.reduce((sum, cierre) => sum + cierre.totalVentas, 0).toFixed(2)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              )}
            </div>
          </>
        )}
      </div>
      {cierreAbierto && <DetalleCierre cierre={cierreAbierto} onClose={() => setCierreAbierto(null)} />}
    </div>
  )
}
