'use client'

import { useEffect, useState } from 'react'
import { ConsultorioCard, type AtencionActual, type ConsultorioEstado } from '@/components/ConsultorioCard'
import { Modal } from '@/components/Modal'
import { ConsultorioAtencionPanel } from '@/components/ConsultorioAtencionPanel'
import { useToast } from '@/components/Toast'

interface Consultorio {
  id: string
  nombre: string
  estado: ConsultorioEstado
  atencionActual: AtencionActual | null
}

const estados: ConsultorioEstado[] = ['DISPONIBLE', 'ATENCION', 'LIMPIEZA', 'MANTENIMIENTO']

export default function ConsultoriosPage() {
  const toast = useToast()
  const [consultorios, setConsultorios] = useState<Consultorio[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState<{ nombre: string; estado: ConsultorioEstado }>({ nombre: '', estado: 'DISPONIBLE' })
  const [submitting, setSubmitting] = useState(false)
  const [selectedConsultorioId, setSelectedConsultorioId] = useState<string | null>(null)

  const load = async () => {
    const response = await fetch('/api/consultorios')
    const data = await response.json()
    setConsultorios(Array.isArray(data) ? data : [])
    setLoading(false)
  }

  useEffect(() => { void load() }, [])

  const handleCreate = async () => {
    if (!form.nombre) return
    setSubmitting(true)
    const response = await fetch('/api/consultorios', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const created = await response.json()
    setSubmitting(false)
    if (!response.ok) {
      toast.error(created.error || 'No se pudo crear el consultorio')
      return
    }
    setConsultorios((prev) => [{ ...created, atencionActual: null }, ...prev])
    setForm({ nombre: '', estado: 'DISPONIBLE' })
    toast.success('Consultorio creada')
  }

  const consultorioSeleccionada = consultorios.find((consultorio) => consultorio.id === selectedConsultorioId) ?? null

  return (
    <div className="page-shell px-4 py-8 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="card-surface">
          <p className="eyebrow">Consultorios</p>
          <h1 className="page-heading mt-3 text-3xl">Estado en tiempo real</h1>
          <p className="mt-2 text-ink-600">Registra los consultorios y sillones y controla su estado en tiempo real.</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="card-surface">
            <h2 className="text-xl font-bold text-ink-800">Crear consultorio</h2>
            <div className="mt-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-ink-700">Nombre</label>
                <input
                  value={form.nombre}
                  onChange={(event) => setForm((prev) => ({ ...prev, nombre: event.target.value }))}
                  className="field mt-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink-700">Estado inicial</label>
                <select
                  value={form.estado}
                  onChange={(event) => setForm((prev) => ({ ...prev, estado: event.target.value as ConsultorioEstado }))}
                  className="field mt-2"
                >
                  {estados.map((estado) => (
                    <option key={estado} value={estado}>{estado}</option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                onClick={handleCreate}
                disabled={submitting}
                className="btn-brand w-full disabled:opacity-60"
              >
                {submitting ? 'Creando...' : 'Agregar consultorio'}
              </button>
            </div>
          </div>

          <div className="card-surface">
            <h2 className="text-xl font-bold text-ink-800">Resumen</h2>
            <p className="mt-4 text-sm text-ink-600">Total de consultorios: {consultorios.length}</p>
            <div className="mt-6 space-y-3">
              {loading ? (
                <div className="rounded-2xl bg-ink-50 p-5">Cargando consultorios...</div>
              ) : consultorios.length === 0 ? (
                <div className="rounded-2xl bg-ink-50 p-5">No hay consultorios registradas.</div>
              ) : (
                consultorios.map((consultorio) => (
                  <div key={consultorio.id} className="rounded-2xl border border-ink-50 bg-ink-50 p-4">
                    <p className="font-bold text-ink-800">{consultorio.nombre}</p>
                    <p className="mt-1 text-sm text-ink-500">Estado: {consultorio.estado}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <section className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {consultorios.map((consultorio) => (
            <ConsultorioCard
              key={consultorio.id}
              nombre={consultorio.nombre}
              estado={consultorio.estado}
              atencionActual={consultorio.atencionActual}
              onClick={() => setSelectedConsultorioId(consultorio.id)}
            />
          ))}
        </section>
      </div>

      {consultorioSeleccionada && (
        <Modal title={consultorioSeleccionada.nombre} size="lg" onClose={() => setSelectedConsultorioId(null)}>
          <ConsultorioAtencionPanel
            consultorio={consultorioSeleccionada}
            onClose={() => setSelectedConsultorioId(null)}
            onChanged={() => { void load() }}
          />
        </Modal>
      )}
    </div>
  )
}
