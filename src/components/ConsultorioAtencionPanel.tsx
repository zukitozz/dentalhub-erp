'use client'

import { useState } from 'react'
import type { AtencionActual, ConsultorioEstado } from '@/components/ConsultorioCard'
import { AtencionEnCursoPanel } from '@/components/AtencionEnCursoPanel'
import { useToast } from '@/components/Toast'

interface ConsultorioDetalle {
  id: string
  nombre: string
  estado: ConsultorioEstado
  atencionActual: AtencionActual | null
}

interface ConsultorioAtencionPanelProps {
  consultorio: ConsultorioDetalle
  onClose: () => void
  onChanged: () => void
}

const ESTADOS_MANUALES: ConsultorioEstado[] = ['DISPONIBLE', 'LIMPIEZA', 'MANTENIMIENTO']

// Panel legado: solo se usa cuando la empresa tiene activado "usar consultorios físicas".
// Delega el manejo de tratamientos al mismo panel que usan Dashboard/Bandeja.
export function ConsultorioAtencionPanel({ consultorio, onClose, onChanged }: ConsultorioAtencionPanelProps) {
  const toast = useToast()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const cambiarEstadoManual = async (estado: ConsultorioEstado) => {
    setSaving(true)
    setError('')
    const response = await fetch(`/api/consultorios/${consultorio.id}/estado`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado }),
    })
    setSaving(false)
    if (!response.ok) {
      const data = await response.json()
      setError(data.error || 'No se pudo cambiar el estado')
      return
    }
    toast.success('Estado de consultorio actualizado')
    onChanged()
  }

  if (consultorio.estado === 'ATENCION' && consultorio.atencionActual) {
    return <AtencionEnCursoPanel atencion={consultorio.atencionActual} onClose={onClose} onChanged={onChanged} />
  }

  return (
    <div className="space-y-6">
      {error && <p className="rounded-2xl bg-danger-50 px-4 py-3 text-sm text-danger-900">{error}</p>}

      {consultorio.estado === 'DISPONIBLE' && (
        <AtencionEnCursoPanel atencion={null} consultorioId={consultorio.id} onClose={onClose} onChanged={onChanged} />
      )}

      <div className={consultorio.estado === 'DISPONIBLE' ? 'border-t border-ink-200 pt-5' : ''}>
        <label className="block text-sm font-medium text-ink-700">Cambiar estado manualmente</label>
        <div className="mt-2 flex flex-wrap gap-2">
          {ESTADOS_MANUALES.filter((estado) => estado !== consultorio.estado).map((estado) => (
            <button
              key={estado}
              type="button"
              disabled={saving}
              onClick={() => void cambiarEstadoManual(estado)}
              className="rounded-xl border border-ink-200 px-4 py-2 text-sm font-semibold text-ink-700 transition hover:bg-ink-50 disabled:opacity-60"
            >
              {estado === 'DISPONIBLE' ? 'Disponible' : estado === 'LIMPIEZA' ? 'Limpieza' : 'Mantenimiento'}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
