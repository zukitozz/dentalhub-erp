'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { Check, Plus } from 'lucide-react'
import { Spinner } from '@/components/Spinner'
import { useToast } from '@/components/Toast'
import { api, fechaCorta, soles } from '@/lib/formato'

interface PlanItem {
  id: string
  descripcion: string
  pieza: number | null
  cantidad: number
  precioUnit: number
  realizado: boolean
}

interface PlanPaciente {
  id: string
  nombre: string
  estado: 'ABIERTO' | 'CERRADO'
  precioTotal: number
  pagado: number
  saldo: number
  creadoAt: string
  items: PlanItem[]
}

export function PlanesTab({ pacienteId, onCambio }: { pacienteId: string; onCambio: () => void }) {
  const toast = useToast()
  const [planes, setPlanes] = useState<PlanPaciente[] | null>(null)

  const cargar = useCallback(async () => {
    const r = await api<PlanPaciente[]>(`/api/pacientes/${pacienteId}/planes`)
    setPlanes(r.ok ? r.data : [])
  }, [pacienteId])

  useEffect(() => { void cargar() }, [cargar])

  const alternar = async (plan: PlanPaciente, item: PlanItem) => {
    const r = await api(`/api/planes/${plan.id}`, { method: 'PATCH', body: { itemId: item.id, realizado: !item.realizado } })
    if (!r.ok) return toast.error(r.error)
    await cargar()
    onCambio()
  }

  if (planes === null) return <p className="text-sm text-ink-500"><Spinner /> Cargando planes…</p>

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-display text-xl font-extrabold">Planes de tratamiento</h3>
          <p className="text-sm text-ink-500">Tratamientos acordados, avance clínico y estado de pagos.</p>
        </div>
        <Link href={`/planes?pacienteId=${pacienteId}&nuevo=1`} className="btn-brand"><Plus size={16} /> Nuevo plan</Link>
      </div>

      {planes.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-ink-200 p-8 text-center text-sm text-ink-500">El paciente no tiene planes de tratamiento.</p>
      ) : (
        planes.map((plan) => {
          const hechos = plan.items.filter((i) => i.realizado).length
          const avance = plan.items.length > 0 ? Math.round((hechos / plan.items.length) * 100) : 0
          return (
            <article key={plan.id} className="rounded-2xl border border-ink-100 bg-white p-5">
              <div className="flex flex-wrap items-center gap-3">
                <h4 className="font-display text-lg font-extrabold">{plan.nombre}</h4>
                <span className={`badge ${plan.estado === 'ABIERTO' ? 'bg-brand-100 text-brand-800' : 'bg-ink-100 text-ink-600'}`}>{plan.estado === 'ABIERTO' ? 'Abierto' : 'Cerrado'}</span>
                <span className="text-xs text-ink-400">Creado {fechaCorta(plan.creadoAt)}</span>
                <Link href="/planes" className="ml-auto text-sm font-semibold text-brand-700 hover:underline">Gestionar pagos</Link>
              </div>

              <div className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
                <p><span className="text-ink-500">Total:</span> <strong>{soles(plan.precioTotal)}</strong></p>
                <p><span className="text-ink-500">Pagado:</span> <strong className="text-emerald-700">{soles(plan.pagado)}</strong></p>
                <p><span className="text-ink-500">Saldo:</span> <strong className={plan.saldo > 0.01 ? 'text-amber-700' : ''}>{soles(plan.saldo)}</strong></p>
              </div>

              {plan.items.length > 0 && (
                <>
                  <div className="mt-4 flex items-center gap-3">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-ink-100"><div className="h-full rounded-full bg-brand-500" style={{ width: `${avance}%` }} /></div>
                    <span className="text-xs font-bold text-ink-500">{hechos}/{plan.items.length} realizados</span>
                  </div>
                  <ul className="mt-3 divide-y divide-ink-100">
                    {plan.items.map((item) => (
                      <li key={item.id} className="flex items-center gap-3 py-2 text-sm">
                        <button
                          type="button"
                          role="checkbox"
                          aria-checked={item.realizado}
                          aria-label={`Marcar ${item.descripcion} como realizado`}
                          onClick={() => void alternar(plan, item)}
                          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border transition ${item.realizado ? 'border-brand-600 bg-brand-600 text-white' : 'border-ink-300 hover:border-brand-500'}`}
                        >
                          {item.realizado && <Check size={14} />}
                        </button>
                        <span className={`flex-1 ${item.realizado ? 'text-ink-400 line-through' : 'text-ink-800'}`}>
                          {item.descripcion}{item.pieza ? ` · pieza ${item.pieza}` : ''}{item.cantidad > 1 ? ` × ${item.cantidad}` : ''}
                        </span>
                        <span className="font-semibold text-ink-700">{soles(item.cantidad * item.precioUnit)}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </article>
          )
        })
      )}
    </div>
  )
}
