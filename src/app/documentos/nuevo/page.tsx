'use client'

import Link from 'next/link'
import { Suspense, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { ArrowLeft, Plus, Trash2 } from 'lucide-react'
import { SearchSelect } from '@/components/SearchSelect'
import { Spinner } from '@/components/Spinner'
import { useToast } from '@/components/Toast'
import { api, soles } from '@/lib/formato'
import {
  LINEA_VACIA,
  MEDICAMENTO_VACIO,
  renderPlantilla,
  TIPOS_DOCUMENTO,
  totalPresupuesto,
  valoresBase,
  type CampoPlantilla,
  type DocumentoTipo,
  type LineaPresupuesto,
  type Medicamento,
} from '@/lib/documentos'

interface Plantilla { id: string; tipo: DocumentoTipo; nombre: string; contenido: string; campos: CampoPlantilla[] | null }
interface Paciente { id: string; nombre: string; dni: string | null; ruc: string | null; carnetExtranjeria: string | null; fechaNacimiento: string | null; apoderado: string | null }
interface Odontologo { id: string; name: string; colegiatura: string | null }
interface Tratamiento { id: string; nombre: string; precio: number; activo: boolean }
interface Configuracion { nombreEmpresa: string }

function NuevoDocumento() {
  const router = useRouter()
  const toast = useToast()
  const { data: session } = useSession()
  const params = useSearchParams()
  const esOdontologo = session?.user?.role === 'ODONTOLOGO'

  const [tipo, setTipo] = useState<DocumentoTipo>((params.get('tipo') as DocumentoTipo) || 'CONSENTIMIENTO')
  const [pacienteId, setPacienteId] = useState(params.get('pacienteId') ?? '')
  const [odontologoId, setOdontologoId] = useState('')
  const [plantillaId, setPlantillaId] = useState('')
  const [titulo, setTitulo] = useState('')

  const [plantillas, setPlantillas] = useState<Plantilla[]>([])
  const [pacientes, setPacientes] = useState<Paciente[]>([])
  const [odontologos, setOdontologos] = useState<Odontologo[]>([])
  const [tratamientos, setTratamientos] = useState<Tratamiento[]>([])
  const [consultorio, setConsultorio] = useState('')
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)

  // Contenido por tipo
  const [camposValores, setCamposValores] = useState<Record<string, string>>({})
  const [contenido, setContenido] = useState('')
  const [contenidoEditado, setContenidoEditado] = useState(false)
  const [diagnostico, setDiagnostico] = useState('')
  const [medicamentos, setMedicamentos] = useState<Medicamento[]>([{ ...MEDICAMENTO_VACIO }])
  const [items, setItems] = useState<LineaPresupuesto[]>([{ ...LINEA_VACIA }])
  const [validezDias, setValidezDias] = useState(30)

  useEffect(() => {
    Promise.all([
      api<Plantilla[]>('/api/documentos/plantillas'),
      api<Paciente[]>('/api/pacientes'),
      api<Odontologo[]>('/api/usuarios/odontologos'),
      api<Tratamiento[]>('/api/tratamientos'),
      api<Configuracion>('/api/ajustes'),
    ]).then(([pl, pa, od, tr, cf]) => {
      if (pl.ok) setPlantillas(pl.data)
      if (pa.ok) setPacientes(pa.data)
      if (od.ok) setOdontologos(od.data)
      if (tr.ok) setTratamientos(tr.data.filter((t) => t.activo))
      if (cf.ok) setConsultorio(cf.data.nombreEmpresa)
      setCargando(false)
    })
  }, [])

  const plantillasTipo = useMemo(() => plantillas.filter((p) => p.tipo === tipo), [plantillas, tipo])
  const plantilla = plantillasTipo.find((p) => p.id === plantillaId) ?? null
  const paciente = pacientes.find((p) => p.id === pacienteId) ?? null
  const odontologoSel = odontologos.find((o) => o.id === (esOdontologo ? session?.user?.id : odontologoId)) ?? null
  const odontologoNombre = odontologoSel?.name ?? (esOdontologo ? session?.user?.name ?? '' : '')

  // Al cambiar de tipo se elige la primera plantilla y se reinicia el contenido.
  useEffect(() => {
    setPlantillaId(plantillasTipo[0]?.id ?? '')
    setCamposValores({})
    setContenidoEditado(false)
  }, [tipo, plantillasTipo])

  useEffect(() => {
    setTitulo(plantilla?.nombre ?? TIPOS_DOCUMENTO.find((t) => t.codigo === tipo)?.nombre ?? '')
  }, [plantilla, tipo])

  const valores = useMemo(() => {
    const base = paciente
      ? valoresBase({ paciente, odontologo: { name: odontologoNombre, colegiatura: odontologoSel?.colegiatura ?? null }, consultorio })
      : { fecha: new Date().toLocaleDateString('es-PE'), odontologo: odontologoNombre, consultorio }
    return { ...base, ...camposValores }
  }, [paciente, odontologoNombre, odontologoSel, consultorio, camposValores])

  // El contenido se regenera solo mientras el usuario no lo haya editado a mano.
  useEffect(() => {
    if (contenidoEditado) return
    setContenido(plantilla ? renderPlantilla(plantilla.contenido, valores) : '')
  }, [plantilla, valores, contenidoEditado])

  const total = totalPresupuesto(items)

  const guardar = async () => {
    if (!pacienteId) return toast.error('Selecciona el paciente')
    if (!esOdontologo && !odontologoId && tipo === 'RECETA') return toast.error('Selecciona el odontólogo que firma la receta')
    setGuardando(true)
    const datos =
      tipo === 'RECETA' ? { diagnostico, medicamentos: medicamentos.filter((m) => m.medicamento.trim()) }
      : tipo === 'PRESUPUESTO' ? { items: items.filter((i) => i.descripcion.trim()), validezDias }
      : { campos: camposValores }
    const r = await api<{ id: string }>('/api/documentos', {
      method: 'POST',
      body: { tipo, pacienteId, odontologoId: odontologoId || undefined, plantillaId: plantillaId || undefined, titulo, contenido, datos },
    })
    setGuardando(false)
    if (!r.ok) return toast.error(r.error)
    toast.success('Documento generado')
    router.push(`/documentos/${r.data.id}`)
  }

  if (cargando) return <div className="p-8 text-ink-500"><Spinner /> Cargando…</div>

  const campos = plantilla?.campos ?? []
  const camposPendientes = campos.filter((c) => !camposValores[c.clave]?.trim()).length

  return (
    <div className="page-shell px-4 py-8 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-5xl space-y-6">
        <Link href="/documentos" className="inline-flex items-center gap-2 text-sm font-semibold text-ink-500 hover:text-brand-700"><ArrowLeft size={16} /> Documentos</Link>

        <div className="card-surface">
          <p className="eyebrow">Documentos</p>
          <h1 className="page-heading mt-2 text-3xl">Nuevo documento</h1>
          <div className="mt-5 flex flex-wrap gap-2">
            {TIPOS_DOCUMENTO.map((t) => (
              <button key={t.codigo} type="button" onClick={() => setTipo(t.codigo)} aria-pressed={tipo === t.codigo} className={`rounded-full px-4 py-2 text-sm font-bold transition ${tipo === t.codigo ? 'bg-ink-900 text-white' : 'bg-ink-100 text-ink-600 hover:bg-ink-200'}`}>{t.nombre}</button>
            ))}
          </div>
        </div>

        <div className="card-surface grid gap-5 md:grid-cols-2">
          <div>
            <label className="label" htmlFor="doc-paciente">Paciente *</label>
            <SearchSelect
              id="doc-paciente"
              value={pacienteId}
              onChange={setPacienteId}
              options={pacientes.map((p) => ({ value: p.id, label: `${p.nombre}${p.dni ? ` · DNI ${p.dni}` : ''}` }))}
              placeholder="Buscar paciente…"
              className="field bg-white"
            />
          </div>
          {!esOdontologo && (
            <div>
              <label className="label" htmlFor="doc-odo">Odontólogo{tipo === 'RECETA' ? ' *' : ''}</label>
              <select id="doc-odo" value={odontologoId} onChange={(e) => setOdontologoId(e.target.value)} className="field">
                <option value="">Selecciona…</option>
                {odontologos.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="label" htmlFor="doc-plantilla">Plantilla</label>
            <select id="doc-plantilla" value={plantillaId} onChange={(e) => { setPlantillaId(e.target.value); setContenidoEditado(false); setCamposValores({}) }} className="field">
              <option value="">Sin plantilla (en blanco)</option>
              {plantillasTipo.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="doc-titulo">Título</label>
            <input id="doc-titulo" value={titulo} onChange={(e) => setTitulo(e.target.value)} className="field" />
          </div>
        </div>

        {campos.length > 0 && (
          <div className="card-surface">
            <h2 className="font-display text-xl font-extrabold">Datos del documento</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {campos.map((c) => (
                <div key={c.clave} className={c.tipo === 'area' ? 'md:col-span-2' : ''}>
                  <label className="label" htmlFor={`campo-${c.clave}`}>{c.label}</label>
                  {c.tipo === 'area' ? (
                    <textarea id={`campo-${c.clave}`} rows={3} className="field" value={camposValores[c.clave] ?? ''} onChange={(e) => { setContenidoEditado(false); setCamposValores((prev) => ({ ...prev, [c.clave]: e.target.value })) }} />
                  ) : (
                    <input id={`campo-${c.clave}`} type={c.tipo === 'fecha' ? 'date' : c.tipo === 'numero' ? 'number' : 'text'} className="field" value={camposValores[c.clave] ?? ''} onChange={(e) => { setContenidoEditado(false); setCamposValores((prev) => ({ ...prev, [c.clave]: e.target.value })) }} />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {tipo === 'RECETA' && (
          <div className="card-surface space-y-4">
            <h2 className="font-display text-xl font-extrabold">Receta</h2>
            <div>
              <label className="label" htmlFor="rec-dx">Diagnóstico</label>
              <input id="rec-dx" value={diagnostico} onChange={(e) => setDiagnostico(e.target.value)} className="field" />
            </div>
            <div className="space-y-3">
              {medicamentos.map((m, i) => (
                <div key={i} className="rounded-xl border border-ink-100 p-3">
                  <div className="grid gap-2 md:grid-cols-6">
                    <input aria-label="Medicamento" placeholder="Medicamento *" value={m.medicamento} onChange={(e) => setMedicamentos((prev) => prev.map((x, j) => (j === i ? { ...x, medicamento: e.target.value } : x)))} className="field md:col-span-2" />
                    <input aria-label="Presentación" placeholder="Presentación (500 mg tab.)" value={m.presentacion} onChange={(e) => setMedicamentos((prev) => prev.map((x, j) => (j === i ? { ...x, presentacion: e.target.value } : x)))} className="field" />
                    <input aria-label="Dosis" placeholder="Dosis" value={m.dosis} onChange={(e) => setMedicamentos((prev) => prev.map((x, j) => (j === i ? { ...x, dosis: e.target.value } : x)))} className="field" />
                    <input aria-label="Frecuencia" placeholder="Cada 8 horas" value={m.frecuencia} onChange={(e) => setMedicamentos((prev) => prev.map((x, j) => (j === i ? { ...x, frecuencia: e.target.value } : x)))} className="field" />
                    <input aria-label="Duración" placeholder="Por 5 días" value={m.duracion} onChange={(e) => setMedicamentos((prev) => prev.map((x, j) => (j === i ? { ...x, duracion: e.target.value } : x)))} className="field" />
                  </div>
                  <div className="mt-2 flex gap-2">
                    <input aria-label="Indicaciones" placeholder="Indicaciones (después de las comidas…)" value={m.indicaciones} onChange={(e) => setMedicamentos((prev) => prev.map((x, j) => (j === i ? { ...x, indicaciones: e.target.value } : x)))} className="field" />
                    {medicamentos.length > 1 && <button type="button" aria-label="Quitar medicamento" onClick={() => setMedicamentos((prev) => prev.filter((_, j) => j !== i))} className="rounded-xl border border-ink-200 px-3 text-ink-400 transition hover:bg-danger-50 hover:text-danger-600"><Trash2 size={16} /></button>}
                  </div>
                </div>
              ))}
              <button type="button" onClick={() => setMedicamentos((prev) => [...prev, { ...MEDICAMENTO_VACIO }])} className="btn-ghost btn-sm"><Plus size={14} /> Agregar medicamento</button>
            </div>
          </div>
        )}

        {tipo === 'PRESUPUESTO' && (
          <div className="card-surface space-y-4">
            <h2 className="font-display text-xl font-extrabold">Tratamientos presupuestados</h2>
            <div className="space-y-3">
              {items.map((it, i) => (
                <div key={i} className="grid gap-2 rounded-xl border border-ink-100 p-3 md:grid-cols-12">
                  <select
                    aria-label="Tratamiento del catálogo"
                    className="field md:col-span-3"
                    value={it.tratamientoId ?? ''}
                    onChange={(e) => {
                      const t = tratamientos.find((x) => x.id === e.target.value)
                      setItems((prev) => prev.map((x, j) => (j === i ? { ...x, tratamientoId: t?.id ?? null, descripcion: t ? t.nombre : x.descripcion, precioUnit: t ? t.precio : x.precioUnit } : x)))
                    }}
                  >
                    <option value="">Del catálogo…</option>
                    {tratamientos.map((t) => <option key={t.id} value={t.id}>{t.nombre} — {soles(t.precio)}</option>)}
                  </select>
                  <input aria-label="Descripción" placeholder="Descripción *" value={it.descripcion} onChange={(e) => setItems((prev) => prev.map((x, j) => (j === i ? { ...x, descripcion: e.target.value } : x)))} className="field md:col-span-4" />
                  <input aria-label="Pieza" placeholder="Pieza" value={it.pieza} onChange={(e) => setItems((prev) => prev.map((x, j) => (j === i ? { ...x, pieza: e.target.value } : x)))} className="field md:col-span-1" />
                  <input aria-label="Cantidad" type="number" min={1} value={it.cantidad} onChange={(e) => setItems((prev) => prev.map((x, j) => (j === i ? { ...x, cantidad: Number(e.target.value) } : x)))} className="field md:col-span-1" />
                  <input aria-label="Precio unitario" type="number" min={0} step="0.01" value={it.precioUnit} onChange={(e) => setItems((prev) => prev.map((x, j) => (j === i ? { ...x, precioUnit: Number(e.target.value) } : x)))} className="field md:col-span-2" />
                  {items.length > 1 && <button type="button" aria-label="Quitar línea" onClick={() => setItems((prev) => prev.filter((_, j) => j !== i))} className="rounded-xl border border-ink-200 text-ink-400 transition hover:bg-danger-50 hover:text-danger-600 md:col-span-1"><Trash2 size={16} className="mx-auto" /></button>}
                </div>
              ))}
              <button type="button" onClick={() => setItems((prev) => [...prev, { ...LINEA_VACIA }])} className="btn-ghost btn-sm"><Plus size={14} /> Agregar línea</button>
            </div>
            <div className="flex flex-wrap items-end justify-between gap-4 border-t border-ink-100 pt-4">
              <div>
                <label className="label" htmlFor="pre-validez">Vigencia (días)</label>
                <input id="pre-validez" type="number" min={1} value={validezDias} onChange={(e) => setValidezDias(Number(e.target.value))} className="field !w-32" />
              </div>
              <p className="text-right"><span className="text-sm text-ink-500">Total del presupuesto</span><br /><span className="font-display text-3xl font-extrabold">{soles(total)}</span></p>
            </div>
          </div>
        )}

        <div className="card-surface">
          <div className="flex items-center justify-between gap-3">
            <label className="font-display text-xl font-extrabold" htmlFor="doc-contenido">{tipo === 'CONSENTIMIENTO' ? 'Texto del consentimiento' : tipo === 'RECETA' ? 'Indicaciones generales' : tipo === 'PRESUPUESTO' ? 'Condiciones' : 'Contenido'}</label>
            {tipo === 'CONSENTIMIENTO' && camposPendientes > 0 && <span className="badge bg-amber-100 text-amber-800">{camposPendientes} campo(s) por completar</span>}
          </div>
          <p className="mt-1 text-xs text-ink-400">Puedes ajustar el texto antes de emitirlo; las líneas con ________ quedan para llenar a mano.</p>
          <textarea id="doc-contenido" rows={tipo === 'CONSENTIMIENTO' ? 14 : 5} value={contenido} onChange={(e) => { setContenido(e.target.value); setContenidoEditado(true) }} className="field mt-3 font-serif leading-relaxed" />
        </div>

        <div className="flex justify-end gap-3">
          <Link href="/documentos" className="btn-ghost">Cancelar</Link>
          <button type="button" onClick={() => void guardar()} disabled={guardando} className="btn-brand">
            {guardando ? <><Spinner /> Generando…</> : 'Generar documento'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function NuevoDocumentoPage() {
  return (
    <Suspense fallback={<div className="p-8 text-ink-500"><Spinner /> Cargando…</div>}>
      <NuevoDocumento />
    </Suspense>
  )
}
