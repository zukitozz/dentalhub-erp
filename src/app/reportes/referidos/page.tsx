'use client'

import { Fragment, useEffect, useState } from 'react'
import { Spinner } from '@/components/Spinner'

interface Fila {
  id: string
  nombre: string
  celular: string | null
  ventas: number
  recomendados: { nombre: string; ventas: number }[]
}
interface Reporte { mes: string; totalVentas: number; filas: Fila[] }

const soles = (n: number) => `S/ ${n.toFixed(2)}`
const mesActual = () => new Date(Date.now() - 5 * 3600 * 1000).toISOString().slice(0, 7)

export default function ReporteReferidosPage() {
  const [mes, setMes] = useState(mesActual())
  const [reporte, setReporte] = useState<Reporte | null>(null)
  const [abierta, setAbierta] = useState<string | null>(null)
  const [top, setTop] = useState(5)

  useEffect(() => {
    setReporte(null)
    void fetch(`/api/reportes/referidos?mes=${mes}`).then((r) => r.json()).then(setReporte)
  }, [mes])

  return (
    <main className="page-shell px-4 py-8 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="card-surface">
          <p className="eyebrow">Fidelización</p>
          <h1 className="mt-3 page-heading text-3xl">Top de recomendados</h1>
          <p className="mt-2 text-ink-600">Ranking de quienes más ventas generaron en el mes con los pacientes que recomendaron. El premio al top lo defines tú.</p>
          <div className="mt-4 flex items-center gap-3">
            <label htmlFor="mes-referidos" className="text-sm font-medium text-ink-700">Mes</label>
            <input id="mes-referidos" type="month" value={mes} onChange={(e) => e.target.value && setMes(e.target.value)} className="field w-48" />
            <label htmlFor="top-referidos" className="ml-4 text-sm font-medium text-ink-700">Mostrar top</label>
            <select id="top-referidos" value={top} onChange={(e) => setTop(Number(e.target.value))} className="field w-24">{[3, 5, 10, 20].map((n) => <option key={n} value={n}>{n}</option>)}</select>
          </div>
        </div>

        {!reporte ? <div className="flex justify-center py-12"><Spinner /></div> : (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="card-surface"><p className="text-xs uppercase tracking-[0.2em] text-ink-500">Ventas de recomendados</p><p className="mt-2 text-2xl font-semibold text-brand-900">{soles(reporte.totalVentas)}</p></div>
              <div className="card-surface"><p className="text-xs uppercase tracking-[0.2em] text-ink-500">Pacientes que recomendaron</p><p className="mt-2 text-2xl font-semibold text-brand-900">{reporte.filas.length}</p></div>
            </div>

            <div className="card-surface overflow-x-auto">
              {reporte.filas.length === 0 ? (
                <p className="text-ink-500">No hay ventas de pacientes recomendados en este mes.</p>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead><tr className="text-ink-500"><th className="py-2 pr-4">Puesto</th><th className="py-2 pr-4">Quien recomendó</th><th className="py-2 pr-4">Celular</th><th className="py-2 pr-4 text-right">Recomendados</th><th className="py-2 text-right">Ventas del mes</th></tr></thead>
                  <tbody>
                    {reporte.filas.slice(0, top).map((f, i) => (
                      <Fragment key={f.id}>
                        <tr onClick={() => setAbierta(abierta === f.id ? null : f.id)} className="cursor-pointer border-t border-ink-50 hover:bg-ink-50">
                          <td className="py-3 pr-4 font-semibold text-brand-700">#{i + 1}</td>
                          <td className="py-3 pr-4 font-medium text-ink-800">{f.nombre}</td>
                          <td className="py-3 pr-4 text-ink-600">{f.celular || '-'}</td>
                          <td className="py-3 pr-4 text-right">{f.recomendados.length}</td>
                          <td className="py-3 text-right font-semibold text-brand-700">{soles(f.ventas)}</td>
                        </tr>
                        {abierta === f.id && f.recomendados.map((r) => (
                          <tr key={r.nombre} className="bg-ink-50/60 text-xs text-ink-600">
                            <td className="py-2 pl-6 pr-4" colSpan={4}>↳ {r.nombre}</td>
                            <td className="py-2 text-right">{soles(r.ventas)}</td>
                          </tr>
                        ))}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}
      </div>
    </main>
  )
}
