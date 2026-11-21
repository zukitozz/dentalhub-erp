'use client'

import { useEffect, useState } from 'react'
import { Spinner } from '@/components/Spinner'
import { useToast } from '@/components/Toast'
import { api, fechaHoraLima } from '@/lib/formato'

const ANTECEDENTES = [
  ['diabetes', 'Diabetes'],
  ['hipertension', 'Hipertensión arterial'],
  ['cardiopatia', 'Enfermedad cardíaca'],
  ['asma', 'Asma / problemas respiratorios'],
  ['hepatitis', 'Hepatitis'],
  ['vih', 'VIH / inmunodeficiencia'],
  ['epilepsia', 'Epilepsia'],
  ['coagulacion', 'Problemas de coagulación'],
  ['anemia', 'Anemia'],
  ['embarazo', 'Embarazo / lactancia'],
  ['alergiaPenicilina', 'Alergia a penicilina'],
  ['alergiaAnestesia', 'Alergia a anestesia'],
  ['alergiaLatex', 'Alergia al látex'],
  ['tabaquismo', 'Tabaquismo'],
  ['bruxismo', 'Bruxismo'],
] as const

interface Historia {
  motivoConsulta: string | null
  enfermedadActual: string | null
  antecedentes: Record<string, boolean> | null
  medicamentosActuales: string | null
  alergias: string | null
  antecedentesOdontologicos: string | null
  habitos: string | null
  examenClinico: string | null
  observaciones: string | null
  actualizadoAt: string
}

const TEXTOS = [
  ['motivoConsulta', 'Motivo de consulta', 'Por qué acude el paciente'],
  ['enfermedadActual', 'Enfermedad actual', 'Tiempo de evolución, síntomas'],
  ['medicamentosActuales', 'Medicamentos que toma actualmente', ''],
  ['alergias', 'Alergias', 'Penicilina, látex, anestesia…'],
  ['antecedentesOdontologicos', 'Antecedentes odontológicos', 'Tratamientos previos, complicaciones, último control'],
  ['habitos', 'Hábitos', 'Cepillado, hilo dental, succión, onicofagia…'],
  ['examenClinico', 'Examen clínico', 'Extraoral, intraoral, ATM, periodonto'],
  ['observaciones', 'Observaciones', ''],
] as const

type Form = Record<(typeof TEXTOS)[number][0], string>

export function HistoriaTab({ pacienteId, onGuardado }: { pacienteId: string; onGuardado: () => void }) {
  const toast = useToast()
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [actualizado, setActualizado] = useState<string | null>(null)
  const [antecedentes, setAntecedentes] = useState<Record<string, boolean>>({})
  const [form, setForm] = useState<Form>({
    motivoConsulta: '', enfermedadActual: '', medicamentosActuales: '', alergias: '',
    antecedentesOdontologicos: '', habitos: '', examenClinico: '', observaciones: '',
  })

  useEffect(() => {
    let vigente = true
    api<Historia | null>(`/api/pacientes/${pacienteId}/historia`).then((r) => {
      if (!vigente) return
      if (r.ok && r.data) {
        setAntecedentes(r.data.antecedentes ?? {})
        setActualizado(r.data.actualizadoAt)
        setForm({
          motivoConsulta: r.data.motivoConsulta ?? '', enfermedadActual: r.data.enfermedadActual ?? '',
          medicamentosActuales: r.data.medicamentosActuales ?? '', alergias: r.data.alergias ?? '',
          antecedentesOdontologicos: r.data.antecedentesOdontologicos ?? '', habitos: r.data.habitos ?? '',
          examenClinico: r.data.examenClinico ?? '', observaciones: r.data.observaciones ?? '',
        })
      }
      setCargando(false)
    })
    return () => { vigente = false }
  }, [pacienteId])

  const guardar = async () => {
    setGuardando(true)
    const r = await api<Historia>(`/api/pacientes/${pacienteId}/historia`, { method: 'PUT', body: { ...form, antecedentes } })
    setGuardando(false)
    if (!r.ok) return toast.error(r.error)
    setActualizado(r.data.actualizadoAt)
    toast.success('Historia clínica guardada')
    onGuardado()
  }

  if (cargando) return <p className="text-sm text-ink-500"><Spinner /> Cargando historia…</p>

  return (
    <div className="space-y-6">
      <section>
        <h3 className="font-display text-xl font-extrabold">Antecedentes médicos</h3>
        <p className="text-sm text-ink-500">Marca lo que aplica al paciente. Se usa como alerta antes de cada procedimiento.</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {ANTECEDENTES.map(([clave, label]) => (
            <label key={clave} className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 text-sm transition ${antecedentes[clave] ? 'border-brand-400 bg-brand-50 font-semibold text-brand-900' : 'border-ink-200 bg-white text-ink-700 hover:bg-ink-50'}`}>
              <input
                type="checkbox"
                checked={Boolean(antecedentes[clave])}
                onChange={(e) => setAntecedentes((prev) => ({ ...prev, [clave]: e.target.checked }))}
                className="h-4 w-4 accent-brand-600"
              />
              {label}
            </label>
          ))}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        {TEXTOS.map(([clave, label, placeholder]) => (
          <div key={clave} className={clave === 'examenClinico' || clave === 'observaciones' ? 'md:col-span-2' : ''}>
            <label htmlFor={`hist-${clave}`} className="label">{label}</label>
            <textarea
              id={`hist-${clave}`}
              rows={clave === 'examenClinico' ? 4 : 3}
              value={form[clave]}
              onChange={(e) => setForm((prev) => ({ ...prev, [clave]: e.target.value }))}
              placeholder={placeholder}
              className="field"
            />
          </div>
        ))}
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-ink-400">{actualizado ? `Última actualización: ${fechaHoraLima(actualizado)}` : 'Aún no se ha registrado la historia clínica.'}</p>
        <button type="button" onClick={() => void guardar()} disabled={guardando} className="btn-brand">
          {guardando ? <><Spinner /> Guardando…</> : 'Guardar historia clínica'}
        </button>
      </div>
    </div>
  )
}
