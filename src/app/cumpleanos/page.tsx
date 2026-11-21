'use client'

import { useEffect, useState } from 'react'
import { PacienteHistorialLink } from '@/components/PacienteHistorialLink'

type ColorEstado = 'HOY' | 'PRONTO' | 'EN_RANGO' | 'LEJANO'

interface Cumpleanos {
  pacienteId: string
  nombre: string
  celular: string | null
  email: string | null
  fechaNacimiento: string
  proximoCumpleanos: string
  diasHasta: number
  edadQueCumple: number
  colorEstado: ColorEstado
}

const estiloPorColor: Record<ColorEstado, string> = {
  HOY: 'border-brand-300 bg-brand-100 text-brand-900',
  PRONTO: 'border-amber-200 bg-amber-50 text-amber-900',
  EN_RANGO: 'border-ink-200 bg-ink-50 text-ink-600',
  LEJANO: 'border-ink-100 bg-white text-ink-400',
}

const etiquetaPorColor: Record<ColorEstado, string> = {
  HOY: '¡Hoy!',
  PRONTO: 'Esta semana',
  EN_RANGO: 'Este mes',
  LEJANO: 'Próximamente',
}

function normalizarWhatsapp(telefono: string) {
  const digitos = telefono.replace(/\D/g, '')
  if (digitos.length === 9) return `51${digitos}`
  return digitos
}

function formatearDiasHasta(dias: number) {
  if (dias === 0) return 'Cumple hoy'
  if (dias === 1) return 'Cumple mañana'
  return `Faltan ${dias} días`
}

export default function CumpleanosPage() {
  const [pacientes, setPacientes] = useState<Cumpleanos[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const response = await fetch('/api/cumpleanos')
        const data = await response.json()
        if (!response.ok) throw new Error(data?.error || 'No se pudo cargar la lista de cumpleaños')
        setPacientes(Array.isArray(data) ? data : [])
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'No se pudo cargar la lista de cumpleaños')
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [])

  return (
    <div className="page-shell px-4 py-8 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="card-surface">
          <p className="eyebrow">Cumpleaños</p>
          <h1 className="mt-3 page-heading text-3xl">Cumpleaños de pacientes</h1>
          <p className="mt-2 text-ink-600">Pacientes ordenados por proximidad de su próximo cumpleaños.</p>
        </div>

        <div className="card-surface overflow-x-auto">
          {loading ? (
            <p className="text-sm text-ink-500">Cargando pacientes...</p>
          ) : error ? (
            <p className="text-sm text-danger-600">{error}</p>
          ) : pacientes.length === 0 ? (
            <p className="text-sm text-ink-500">Ningún paciente tiene fecha de nacimiento registrada.</p>
          ) : (
            <table className="w-full min-w-[720px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-ink-200 text-ink-500">
                  <th className="py-2 pr-4">Paciente</th>
                  <th className="py-2 pr-4">Cumpleaños</th>
                  <th className="py-2 pr-4">Cumple años</th>
                  <th className="py-2 pr-4">Contacto</th>
                </tr>
              </thead>
              <tbody>
                {pacientes.map((paciente) => (
                  <tr key={paciente.pacienteId} className="border-b border-ink-100">
                    <td className="py-3 pr-4 font-medium text-ink-900">
                      <PacienteHistorialLink pacienteId={paciente.pacienteId} nombre={paciente.nombre} />
                    </td>
                    <td className="py-3 pr-4">
                      <span className={`inline-block rounded-full border px-3 py-1 text-xs font-semibold ${estiloPorColor[paciente.colorEstado]}`}>
                        {etiquetaPorColor[paciente.colorEstado]}
                      </span>
                      <p className="mt-1 text-xs text-ink-500">
                        {new Date(paciente.proximoCumpleanos).toLocaleDateString('es-PE', { day: '2-digit', month: 'long' })} · {formatearDiasHasta(paciente.diasHasta)}
                      </p>
                    </td>
                    <td className="py-3 pr-4 text-ink-600">{paciente.edadQueCumple} años</td>
                    <td className="py-3 pr-4">
                      {paciente.celular ? (
                        <div className="flex flex-col gap-1 text-xs">
                          <a href={`tel:${paciente.celular}`} className="font-semibold text-ink-700 underline decoration-dotted underline-offset-2 hover:text-brand-700">
                            {paciente.celular}
                          </a>
                          <a
                            href={`https://wa.me/${normalizarWhatsapp(paciente.celular)}`}
                            target="_blank"
                            rel="noreferrer"
                            className="font-semibold text-brand-700 underline decoration-dotted underline-offset-2 hover:text-brand-900"
                          >
                            WhatsApp
                          </a>
                        </div>
                      ) : (
                        <span className="text-xs text-ink-400">Sin teléfono</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
