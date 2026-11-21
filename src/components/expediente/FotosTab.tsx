'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ImagePlus } from 'lucide-react'
import { Spinner } from '@/components/Spinner'
import { useToast } from '@/components/Toast'
import { api, fechaHoraLima } from '@/lib/formato'

interface Foto {
  id: string
  url: string
  tipo: string | null
  descripcion: string | null
  creadoAt: string
  atencionId: string | null
}

const TIPOS = [
  ['RADIOGRAFIA', 'Radiografía'],
  ['INTRAORAL', 'Intraoral'],
  ['EXTRAORAL', 'Extraoral'],
  ['ANTES', 'Antes'],
  ['DESPUES', 'Después'],
  ['EVOLUCION', 'Evolución'],
  ['OTRO', 'Otro'],
] as const

export function FotosTab({ pacienteId, onCambio }: { pacienteId: string; onCambio: () => void }) {
  const toast = useToast()
  const [fotos, setFotos] = useState<Foto[]>([])
  const [cargando, setCargando] = useState(true)
  const [subiendo, setSubiendo] = useState(false)
  const [tipo, setTipo] = useState('RADIOGRAFIA')
  const [descripcion, setDescripcion] = useState('')
  const [filtro, setFiltro] = useState('TODAS')

  const cargar = useCallback(async () => {
    const r = await api<Foto[]>(`/api/pacientes/${pacienteId}/fotos`)
    if (r.ok) setFotos(r.data)
    setCargando(false)
  }, [pacienteId])

  useEffect(() => { void cargar() }, [cargar])

  const subir = async (archivo: File) => {
    setSubiendo(true)
    const body = new FormData()
    body.append('file', archivo)
    body.append('tipo', tipo)
    if (descripcion) body.append('descripcion', descripcion)
    const res = await fetch(`/api/pacientes/${pacienteId}/fotos`, { method: 'POST', body })
    setSubiendo(false)
    if (!res.ok) {
      const data = await res.json().catch(() => null)
      return toast.error(data?.error ?? 'No se pudo subir la imagen')
    }
    setDescripcion('')
    toast.success('Imagen guardada en el expediente')
    await cargar()
    onCambio()
  }

  const visibles = useMemo(() => fotos.filter((f) => filtro === 'TODAS' || f.tipo === filtro), [fotos, filtro])

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-ink-100 bg-white p-4">
        <div>
          <label className="label" htmlFor="foto-tipo">Tipo</label>
          <select id="foto-tipo" value={tipo} onChange={(e) => setTipo(e.target.value)} className="field !w-auto">
            {TIPOS.map(([c, n]) => <option key={c} value={c}>{n}</option>)}
          </select>
        </div>
        <div className="min-w-[14rem] flex-1">
          <label className="label" htmlFor="foto-desc">Descripción</label>
          <input id="foto-desc" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Ej. Periapical pieza 36" className="field" />
        </div>
        <label className="btn-brand cursor-pointer">
          {subiendo ? <><Spinner /> Subiendo…</> : <><ImagePlus size={16} /> Subir imagen</>}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic"
            className="hidden"
            disabled={subiendo}
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void subir(f)
              e.target.value = ''
            }}
          />
        </label>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {[['TODAS', 'Todas'], ...TIPOS].map(([c, n]) => (
          <button key={c} type="button" onClick={() => setFiltro(c)} className={`rounded-full px-3 py-1 text-xs font-bold transition ${filtro === c ? 'bg-ink-900 text-white' : 'bg-ink-100 text-ink-600 hover:bg-ink-200'}`}>{n}</button>
        ))}
      </div>

      {cargando ? (
        <p className="text-sm text-ink-500"><Spinner /> Cargando imágenes…</p>
      ) : visibles.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-ink-200 p-8 text-center text-sm text-ink-500">No hay imágenes en esta categoría.</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {visibles.map((f) => (
            <a key={f.id} href={f.url} target="_blank" rel="noreferrer" className="group block overflow-hidden rounded-2xl border border-ink-100 bg-white transition hover:shadow-soft">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={f.url} alt={f.descripcion ?? 'Imagen clínica'} className="h-36 w-full object-cover" />
              <div className="p-2.5">
                <p className="text-[10px] font-extrabold uppercase tracking-wide text-brand-700">{TIPOS.find(([c]) => c === f.tipo)?.[1] ?? 'Sin tipo'}</p>
                {f.descripcion && <p className="truncate text-xs text-ink-700">{f.descripcion}</p>}
                <p className="text-[11px] text-ink-400">{fechaHoraLima(f.creadoAt)}</p>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
