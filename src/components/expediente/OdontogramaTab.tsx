'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { COLOR_PLANIFICADO, COLOR_REALIZADO, colorHallazgo, Odontograma, type Hallazgo } from '@/components/Odontograma'
import { Spinner } from '@/components/Spinner'
import { useToast } from '@/components/Toast'
import { useConfirm } from '@/components/ConfirmDialog'
import { api, fechaCorta } from '@/lib/formato'
import { CONDICION_POR_CODIGO, CONDICIONES, ESTADOS_HALLAZGO, nombrePieza, SUPERFICIES } from '@/lib/odontograma'

const ETIQUETA_ESTADO: Record<string, string> = { EXISTENTE: 'Existente', PLANIFICADO: 'Planificado', REALIZADO: 'Realizado' }
const CLASE_ESTADO: Record<string, string> = {
  EXISTENTE: 'bg-ink-100 text-ink-700',
  PLANIFICADO: 'bg-amber-100 text-amber-800',
  REALIZADO: 'bg-blue-100 text-blue-800',
}

export function OdontogramaTab({ pacienteId, onCambio }: { pacienteId: string; onCambio: () => void }) {
  const toast = useToast()
  const confirmar = useConfirm()
  const [hallazgos, setHallazgos] = useState<Hallazgo[]>([])
  const [cargando, setCargando] = useState(true)
  const [pieza, setPieza] = useState<number | null>(null)
  const [condicion, setCondicion] = useState('CARIES')
  const [estado, setEstado] = useState('EXISTENTE')
  const [superficies, setSuperficies] = useState<string[]>([])
  const [notas, setNotas] = useState('')
  const [guardando, setGuardando] = useState(false)

  const cargar = useCallback(async () => {
    const r = await api<Hallazgo[]>(`/api/pacientes/${pacienteId}/odontograma`)
    if (r.ok) setHallazgos(r.data)
    setCargando(false)
  }, [pacienteId])

  useEffect(() => { void cargar() }, [cargar])

  const definicion = CONDICION_POR_CODIGO[condicion]
  const hallazgosPieza = useMemo(() => hallazgos.filter((h) => h.pieza === pieza), [hallazgos, pieza])
  const pendientes = useMemo(() => hallazgos.filter((h) => h.estado === 'PLANIFICADO').sort((a, b) => a.pieza - b.pieza), [hallazgos])

  const agregar = async () => {
    if (!pieza) return
    if (definicion.porSuperficie && superficies.length === 0) return toast.error('Marca al menos una superficie')
    setGuardando(true)
    const r = await api(`/api/pacientes/${pacienteId}/odontograma`, { method: 'POST', body: { pieza, condicion, estado, superficies, notas } })
    setGuardando(false)
    if (!r.ok) return toast.error(r.error)
    setSuperficies([])
    setNotas('')
    toast.success(`Hallazgo registrado en la pieza ${pieza}`)
    await cargar()
    onCambio()
  }

  const cambiarEstado = async (h: Hallazgo, nuevo: string) => {
    const r = await api(`/api/odontograma/${h.id}`, { method: 'PATCH', body: { estado: nuevo } })
    if (!r.ok) return toast.error(r.error)
    await cargar()
    onCambio()
  }

  const quitar = async (h: Hallazgo) => {
    const ok = await confirmar({
      title: 'Quitar hallazgo',
      mensaje: `¿Quitar "${CONDICION_POR_CODIGO[h.condicion]?.nombre ?? h.condicion}" de la pieza ${h.pieza}?`,
      textoConfirmar: 'Quitar',
      peligro: true,
    })
    if (!ok) return
    const r = await api(`/api/odontograma/${h.id}`, { method: 'DELETE' })
    if (!r.ok) return toast.error(r.error)
    await cargar()
    onCambio()
  }

  if (cargando) return <p className="text-sm text-ink-500"><Spinner /> Cargando odontograma…</p>

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-ink-100 bg-white p-4">
        <Odontograma hallazgos={hallazgos} seleccionada={pieza} onSelect={setPieza} />
        <div className="mt-3 flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-[11px] text-ink-500">
          <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm" style={{ background: '#dc2626' }} /> Diagnóstico existente (color por condición)</span>
          <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm" style={{ background: COLOR_PLANIFICADO }} /> Planificado</span>
          <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm" style={{ background: COLOR_REALIZADO }} /> Realizado</span>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-ink-100 bg-white p-5">
          {pieza ? (
            <>
              <h3 className="font-display text-xl font-extrabold">Pieza {pieza}</h3>
              <p className="text-sm capitalize text-ink-500">{nombrePieza(pieza)}</p>

              <ul className="mt-4 space-y-2">
                {hallazgosPieza.length === 0 && <li className="text-sm text-ink-500">Sin hallazgos registrados en esta pieza.</li>}
                {hallazgosPieza.map((h) => (
                  <li key={h.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-ink-100 px-3 py-2 text-sm">
                    <i className="h-3 w-3 shrink-0 rounded-sm" style={{ background: colorHallazgo(h) }} />
                    <span className="font-semibold">{CONDICION_POR_CODIGO[h.condicion]?.nombre ?? h.condicion}</span>
                    {h.superficie && <span className="rounded bg-ink-100 px-1.5 text-xs font-bold text-ink-600">{h.superficie}</span>}
                    <select
                      value={h.estado}
                      onChange={(e) => void cambiarEstado(h, e.target.value)}
                      aria-label="Estado del hallazgo"
                      className={`ml-auto rounded-full border-0 px-2 py-0.5 text-xs font-bold ${CLASE_ESTADO[h.estado]}`}
                    >
                      {ESTADOS_HALLAZGO.map((e) => <option key={e.codigo} value={e.codigo}>{ETIQUETA_ESTADO[e.codigo]}</option>)}
                    </select>
                    <button type="button" onClick={() => void quitar(h)} aria-label="Quitar hallazgo" className="rounded-full p-1 text-ink-400 transition hover:bg-danger-50 hover:text-danger-600"><Trash2 size={15} /></button>
                    {h.notas && <p className="w-full text-xs text-ink-500">{h.notas}</p>}
                  </li>
                ))}
              </ul>

              <div className="mt-5 space-y-3 border-t border-ink-100 pt-4">
                <p className="label !mb-0">Agregar hallazgo</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <select value={condicion} onChange={(e) => { setCondicion(e.target.value); setSuperficies([]) }} className="field" aria-label="Condición">
                    {CONDICIONES.map((c) => <option key={c.codigo} value={c.codigo}>{c.nombre}</option>)}
                  </select>
                  <select value={estado} onChange={(e) => setEstado(e.target.value)} className="field" aria-label="Estado">
                    {ESTADOS_HALLAZGO.map((e) => <option key={e.codigo} value={e.codigo}>{e.nombre}</option>)}
                  </select>
                </div>
                {definicion.porSuperficie && (
                  <div className="flex flex-wrap gap-2">
                    {SUPERFICIES.map((s) => (
                      <label key={s.codigo} className={`cursor-pointer rounded-lg border px-3 py-1.5 text-xs font-bold transition ${superficies.includes(s.codigo) ? 'border-brand-500 bg-brand-50 text-brand-800' : 'border-ink-200 text-ink-600 hover:bg-ink-50'}`}>
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={superficies.includes(s.codigo)}
                          onChange={(e) => setSuperficies((prev) => (e.target.checked ? [...prev, s.codigo] : prev.filter((x) => x !== s.codigo)))}
                        />
                        {s.codigo} · {s.nombre}
                      </label>
                    ))}
                  </div>
                )}
                <input value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Nota (opcional)" className="field" />
                <button type="button" onClick={() => void agregar()} disabled={guardando} className="btn-brand w-full">
                  {guardando ? <><Spinner /> Guardando…</> : 'Registrar hallazgo'}
                </button>
              </div>
            </>
          ) : (
            <p className="py-10 text-center text-sm text-ink-500">Selecciona una pieza en el odontograma para ver o registrar hallazgos.</p>
          )}
        </section>

        <section className="rounded-2xl border border-ink-100 bg-white p-5">
          <h3 className="font-display text-xl font-extrabold">Pendiente de tratar</h3>
          <p className="text-sm text-ink-500">Hallazgos marcados como planificados.</p>
          {pendientes.length === 0 ? (
            <p className="mt-6 text-center text-sm text-ink-500">No hay hallazgos planificados.</p>
          ) : (
            <ul className="mt-4 divide-y divide-ink-100">
              {pendientes.map((h) => (
                <li key={h.id} className="flex items-center gap-3 py-2 text-sm">
                  <button type="button" onClick={() => setPieza(h.pieza)} className="w-10 shrink-0 rounded-lg bg-amber-100 py-1 text-center text-xs font-extrabold text-amber-800">{h.pieza}</button>
                  <span className="flex-1">{CONDICION_POR_CODIGO[h.condicion]?.nombre ?? h.condicion}{h.superficie ? ` · ${h.superficie}` : ''}</span>
                  <span className="text-xs text-ink-400">{fechaCorta(h.creadoAt)}</span>
                  <button type="button" onClick={() => void cambiarEstado(h, 'REALIZADO')} className="text-xs font-bold text-brand-700 hover:underline">Marcar realizado</button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}
