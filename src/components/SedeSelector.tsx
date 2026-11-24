'use client'

import { useEffect, useState } from 'react'
import { Building2 } from 'lucide-react'

interface Sede { id: string; nombre: string }

// Gerente: selector de sede (o todas). Resto de usuarios: muestra la sede a la que pertenecen.
export function SedeSelector({ collapsed }: { collapsed: boolean }) {
  const [actual, setActual] = useState<{ sedeId: string | null; nombre: string | null; puedeElegir: boolean } | null>(null)
  const [sedes, setSedes] = useState<Sede[]>([])

  useEffect(() => {
    void fetch('/api/sede').then((r) => (r.ok ? r.json() : null)).then((d) => d && setActual(d))
    void fetch('/api/sedes').then((r) => (r.ok ? r.json() : [])).then((d) => setSedes(Array.isArray(d) ? d : []))
  }, [])

  if (!actual || sedes.length === 0) return null
  if (!actual.puedeElegir && sedes.length < 2) return null

  const cambiar = async (sedeId: string) => {
    await fetch('/api/sede', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sedeId }) })
    window.location.reload()
  }

  if (collapsed) {
    return <div className="flex justify-center py-2 text-ink-300" title={actual.nombre ?? 'Todas las sedes'}><Building2 size={18} /></div>
  }

  return (
    <div className="px-2 pb-2">
      <p className="mb-1 flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-[0.2em] text-ink-400"><Building2 size={12} /> Sede</p>
      {actual.puedeElegir ? (
        <select
          aria-label="Sede activa"
          value={actual.sedeId ?? ''}
          onChange={(e) => void cambiar(e.target.value)}
          className="w-full rounded-lg border border-white/15 bg-ink-800 px-2 py-1.5 text-sm text-white"
        >
          <option value="">Todas las sedes</option>
          {sedes.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
        </select>
      ) : (
        <p className="truncate rounded-lg bg-ink-800 px-2 py-1.5 text-sm text-white">{actual.nombre}</p>
      )}
    </div>
  )
}
