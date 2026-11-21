'use client'

import { useCallback, useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { CalendarPlus, Plus } from 'lucide-react'
import { Spinner } from '@/components/Spinner'
import { useToast } from '@/components/Toast'
import { aInputDatetime, api, deInputDatetime, fechaHoraLima } from '@/lib/formato'

interface Evolucion {
  id: string
  fecha: string
  motivo: string | null
  diagnostico: string | null
  procedimiento: string
  indicaciones: string | null
  piezas: string | null
  odontologo: { id: string; name: string; colegiatura: string | null }
  proximaCita: { id: string; fecha: string; tratamiento: string; estado: string } | null
}

const VACIO = { motivo: '', diagnostico: '', procedimiento: '', indicaciones: '', piezas: '' }

export function EvolucionesTab({ pacienteId, onCambio }: { pacienteId: string; onCambio: () => void }) {
  const toast = useToast()
  const { data: session } = useSession()
  const esOdontologo = session?.user?.role === 'ODONTOLOGO'
  const [evoluciones, setEvoluciones] = useState<Evolucion[]>([])
  const [odontologos, setOdontologos] = useState<{ id: string; name: string }[]>([])
  const [cargando, setCargando] = useState(true)
  const [abierto, setAbierto] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [form, setForm] = useState(VACIO)
  const [odontologoId, setOdontologoId] = useState('')
  const [programar, setProgramar] = useState(false)
  const [fechaCita, setFechaCita] = useState('')
  const [motivoCita, setMotivoCita] = useState('Control de evolución')
  const [duracion, setDuracion] = useState('30')

  const cargar = useCallback(async () => {
    const r = await api<Evolucion[]>(`/api/pacientes/${pacienteId}/evoluciones`)
    if (r.ok) setEvoluciones(r.data)
    setCargando(false)
  }, [pacienteId])

  useEffect(() => {
    void cargar()
    api<{ id: string; name: string }[]>('/api/usuarios/odontologos').then((r) => r.ok && setOdontologos(r.data))
  }, [cargar])

  const nueva = () => {
    setForm(VACIO)
    setProgramar(false)
    setFechaCita(aInputDatetime(new Date(Date.now() + 7 * 24 * 3600 * 1000)).slice(0, 11) + '09:00')
    setAbierto(true)
  }

  const guardar = async () => {
    if (!form.procedimiento.trim()) return toast.error('Describe el procedimiento realizado')
    if (!esOdontologo && !odontologoId) return toast.error('Selecciona el odontólogo')
    setGuardando(true)
    const r = await api(`/api/pacientes/${pacienteId}/evoluciones`, {
      method: 'POST',
      body: {
        ...form,
        odontologoId: odontologoId || undefined,
        proximaCita: programar && fechaCita ? { fecha: deInputDatetime(fechaCita).toISOString(), tratamiento: motivoCita, duracionMin: Number(duracion) || null } : undefined,
      },
    })
    setGuardando(false)
    if (!r.ok) return toast.error(r.error)
    toast.success(programar ? 'Evolución guardada y cita agendada' : 'Evolución guardada')
    setAbierto(false)
    await cargar()
    onCambio()
  }

  const set = (campo: keyof typeof VACIO) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm((prev) => ({ ...prev, [campo]: e.target.value }))

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-display text-xl font-extrabold">Evoluciones clínicas</h3>
          <p className="text-sm text-ink-500">Nota de cada visita. Si programas la próxima cita, aparece directamente en la agenda.</p>
        </div>
        {!abierto && <button type="button" onClick={nueva} className="btn-brand"><Plus size={16} /> Nueva evolución</button>}
      </div>

      {abierto && (
        <div className="space-y-4 rounded-2xl border border-brand-200 bg-brand-50/40 p-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="label" htmlFor="ev-motivo">Motivo / molestia referida</label>
              <input id="ev-motivo" value={form.motivo} onChange={set('motivo')} className="field" />
            </div>
            <div>
              <label className="label" htmlFor="ev-dx">Diagnóstico</label>
              <input id="ev-dx" value={form.diagnostico} onChange={set('diagnostico')} className="field" placeholder="Ej. Pulpitis irreversible pieza 36" />
            </div>
            <div>
              <label className="label" htmlFor="ev-piezas">Piezas</label>
              <input id="ev-piezas" value={form.piezas} onChange={set('piezas')} className="field" placeholder="Ej. 36, 37" />
            </div>
            <div className="md:col-span-2">
              <label className="label" htmlFor="ev-proc">Procedimiento realizado *</label>
              <textarea id="ev-proc" rows={4} value={form.procedimiento} onChange={set('procedimiento')} className="field" />
            </div>
            <div className="md:col-span-2">
              <label className="label" htmlFor="ev-ind">Indicaciones al paciente</label>
              <textarea id="ev-ind" rows={2} value={form.indicaciones} onChange={set('indicaciones')} className="field" />
            </div>
            {!esOdontologo && (
              <div>
                <label className="label" htmlFor="ev-odo">Odontólogo</label>
                <select id="ev-odo" value={odontologoId} onChange={(e) => setOdontologoId(e.target.value)} className="field">
                  <option value="">Selecciona…</option>
                  {odontologos.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-ink-200 bg-white p-4">
            <label className="flex cursor-pointer items-center gap-3 text-sm font-semibold text-ink-800">
              <input type="checkbox" checked={programar} onChange={(e) => setProgramar(e.target.checked)} className="h-4 w-4 accent-brand-600" />
              <CalendarPlus size={16} className="text-brand-600" /> Programar la próxima cita
            </label>
            {programar && (
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <input type="datetime-local" value={fechaCita} onChange={(e) => setFechaCita(e.target.value)} className="field" aria-label="Fecha y hora de la próxima cita" />
                <input value={motivoCita} onChange={(e) => setMotivoCita(e.target.value)} className="field" aria-label="Motivo de la próxima cita" />
                <input type="number" min={10} step={5} value={duracion} onChange={(e) => setDuracion(e.target.value)} className="field" aria-label="Duración en minutos" />
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setAbierto(false)} className="btn-ghost">Cancelar</button>
            <button type="button" onClick={() => void guardar()} disabled={guardando} className="btn-brand">
              {guardando ? <><Spinner /> Guardando…</> : 'Guardar evolución'}
            </button>
          </div>
        </div>
      )}

      {cargando ? (
        <p className="text-sm text-ink-500"><Spinner /> Cargando evoluciones…</p>
      ) : evoluciones.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-ink-200 p-8 text-center text-sm text-ink-500">Aún no hay evoluciones registradas.</p>
      ) : (
        <ul className="space-y-3">
          {evoluciones.map((e) => (
            <li key={e.id} className="rounded-2xl border border-ink-100 bg-white p-5">
              <div className="flex flex-wrap items-center gap-2 text-xs text-ink-500">
                <span className="font-bold text-ink-800">{fechaHoraLima(e.fecha)}</span>
                <span>· {e.odontologo.name}{e.odontologo.colegiatura ? ` (COP ${e.odontologo.colegiatura})` : ''}</span>
                {e.piezas && <span className="rounded-full bg-brand-50 px-2 py-0.5 font-bold text-brand-800">Piezas {e.piezas}</span>}
              </div>
              {e.diagnostico && <p className="mt-2 font-semibold text-ink-900">{e.diagnostico}</p>}
              {e.motivo && <p className="mt-1 text-sm text-ink-600"><span className="font-semibold">Motivo:</span> {e.motivo}</p>}
              <p className="mt-2 whitespace-pre-line text-sm text-ink-700">{e.procedimiento}</p>
              {e.indicaciones && <p className="mt-2 whitespace-pre-line rounded-xl bg-ink-50 p-3 text-sm text-ink-600"><span className="font-semibold">Indicaciones:</span> {e.indicaciones}</p>}
              {e.proximaCita && (
                <p className="mt-2 inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
                  <CalendarPlus size={13} /> Próxima cita: {fechaHoraLima(e.proximaCita.fecha)} · {e.proximaCita.tratamiento}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
