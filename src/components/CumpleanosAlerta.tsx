'use client'

import { useEffect, useState } from 'react'
import { Modal } from '@/components/Modal'

interface Cumpleanero { pacienteId: string; nombre: string; celular: string | null }
interface Alerta { ayer: Cumpleanero[]; hoy: Cumpleanero[]; manana: Cumpleanero[] }

export const CLAVE_ALERTA_CUMPLEANOS = 'cumpleanos-alerta-vista'

const SECCIONES: { clave: keyof Alerta; titulo: string; estilo: string }[] = [
  { clave: 'hoy', titulo: '🎂 Cumplen hoy', estilo: 'border-brand-200 bg-brand-50 text-brand-900' },
  { clave: 'manana', titulo: 'Cumplen mañana', estilo: 'border-amber-200 bg-amber-50 text-amber-900' },
  { clave: 'ayer', titulo: 'Cumplieron ayer', estilo: 'border-ink-200 bg-ink-50 text-ink-700' },
]

// Se muestra una vez por inicio de sesión (la marca se limpia al salir, ver Sidebar).
export function CumpleanosAlerta() {
  const [alerta, setAlerta] = useState<Alerta | null>(null)

  useEffect(() => {
    try {
      if (sessionStorage.getItem(CLAVE_ALERTA_CUMPLEANOS)) return
      sessionStorage.setItem(CLAVE_ALERTA_CUMPLEANOS, '1')
    } catch {
      // Sin sessionStorage se muestra igualmente.
    }
    fetch('/api/cumpleanos/alerta')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: Alerta | null) => {
        if (data && (data.ayer.length || data.hoy.length || data.manana.length)) setAlerta(data)
      })
      .catch(() => undefined)
  }, [])

  if (!alerta) return null

  return (
    <Modal title="Cumpleaños de pacientes" onClose={() => setAlerta(null)}>
      <div className="space-y-4">
        {SECCIONES.filter(({ clave }) => alerta[clave].length > 0).map(({ clave, titulo, estilo }) => (
          <div key={clave} className={`rounded-2xl border p-4 ${estilo}`}>
            <p className="text-sm font-semibold">{titulo}</p>
            <ul className="mt-2 space-y-1 text-sm">
              {alerta[clave].map((paciente) => (
                <li key={paciente.pacienteId} className="flex justify-between gap-3">
                  <span>{paciente.nombre}</span>
                  {paciente.celular && <span className="text-xs opacity-80">{paciente.celular}</span>}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="mt-6 flex justify-end">
        <button type="button" autoFocus onClick={() => setAlerta(null)} className="btn-brand">Entendido</button>
      </div>
    </Modal>
  )
}
