'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, Plus, Trash2 } from 'lucide-react'
import { Spinner } from '@/components/Spinner'
import { useToast } from '@/components/Toast'
import { useConfirm } from '@/components/ConfirmDialog'
import { Modal } from '@/components/Modal'
import { api } from '@/lib/formato'
import { NOMBRE_TIPO, TIPOS_DOCUMENTO, VARIABLES_BASE, type CampoPlantilla, type DocumentoTipo } from '@/lib/documentos'

interface Plantilla {
  id: string
  tipo: DocumentoTipo
  nombre: string
  contenido: string
  campos: CampoPlantilla[] | null
  activo: boolean
  sistema: boolean
}

const VACIA = { id: '', tipo: 'CONSENTIMIENTO' as DocumentoTipo, nombre: '', contenido: '', campos: [] as CampoPlantilla[] }

export default function PlantillasPage() {
  const toast = useToast()
  const confirmar = useConfirm()
  const [plantillas, setPlantillas] = useState<Plantilla[] | null>(null)
  const [edicion, setEdicion] = useState<typeof VACIA | null>(null)
  const [guardando, setGuardando] = useState(false)

  const cargar = useCallback(async () => {
    const r = await api<Plantilla[]>('/api/documentos/plantillas?todas=true')
    setPlantillas(r.ok ? r.data : [])
  }, [])

  useEffect(() => { void cargar() }, [cargar])

  const guardar = async () => {
    if (!edicion) return
    setGuardando(true)
    const r = edicion.id
      ? await api(`/api/documentos/plantillas/${edicion.id}`, { method: 'PUT', body: edicion })
      : await api('/api/documentos/plantillas', { method: 'POST', body: edicion })
    setGuardando(false)
    if (!r.ok) return toast.error(r.error)
    toast.success('Plantilla guardada')
    setEdicion(null)
    await cargar()
  }

  const eliminar = async (p: Plantilla) => {
    const ok = await confirmar({ title: 'Eliminar plantilla', mensaje: `¿Eliminar "${p.nombre}"? Los documentos ya emitidos no se ven afectados.`, textoConfirmar: 'Eliminar', peligro: true })
    if (!ok) return
    const r = await api(`/api/documentos/plantillas/${p.id}`, { method: 'DELETE' })
    if (!r.ok) return toast.error(r.error)
    await cargar()
  }

  const alternar = async (p: Plantilla) => {
    const r = await api(`/api/documentos/plantillas/${p.id}`, { method: 'PUT', body: { activo: !p.activo } })
    if (!r.ok) return toast.error(r.error)
    await cargar()
  }

  const clavesCampos = edicion?.campos.map((c) => `{{${c.clave}}}`) ?? []

  return (
    <div className="page-shell px-4 py-8 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-5xl space-y-6">
        <Link href="/documentos" className="inline-flex items-center gap-2 text-sm font-semibold text-ink-500 hover:text-brand-700"><ArrowLeft size={16} /> Documentos</Link>

        <div className="card-surface flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="eyebrow">Documentos</p>
            <h1 className="page-heading mt-3 text-3xl">Plantillas</h1>
            <p className="mt-2 max-w-xl text-ink-600">Textos base para consentimientos, recetas y presupuestos. Usa variables como {'{{paciente}}'} y define campos propios para llenar en cada documento.</p>
          </div>
          <button type="button" onClick={() => setEdicion({ ...VACIA })} className="btn-brand"><Plus size={16} /> Nueva plantilla</button>
        </div>

        {plantillas === null ? (
          <p className="text-ink-500"><Spinner /> Cargando plantillas…</p>
        ) : (
          TIPOS_DOCUMENTO.map((t) => {
            const lista = plantillas.filter((p) => p.tipo === t.codigo)
            if (lista.length === 0) return null
            return (
              <section key={t.codigo} className="card-surface">
                <h2 className="font-display text-xl font-extrabold">{t.plural}</h2>
                <ul className="mt-3 divide-y divide-ink-100">
                  {lista.map((p) => (
                    <li key={p.id} className="flex flex-wrap items-center gap-3 py-3">
                      <span className={`min-w-0 flex-1 ${p.activo ? '' : 'opacity-50'}`}>
                        <span className="block truncate font-semibold">{p.nombre}</span>
                        <span className="text-xs text-ink-400">{p.campos?.length ?? 0} campo(s) · {p.sistema ? 'Plantilla base' : 'Personalizada'}{p.activo ? '' : ' · Desactivada'}</span>
                      </span>
                      <button type="button" onClick={() => setEdicion({ id: p.id, tipo: p.tipo, nombre: p.nombre, contenido: p.contenido, campos: p.campos ?? [] })} className="text-sm font-semibold text-brand-700 hover:underline">Editar</button>
                      <button type="button" onClick={() => void alternar(p)} className="text-sm font-semibold text-ink-500 hover:underline">{p.activo ? 'Desactivar' : 'Activar'}</button>
                      <button type="button" onClick={() => void eliminar(p)} aria-label="Eliminar plantilla" className="rounded-full p-1.5 text-ink-400 transition hover:bg-danger-50 hover:text-danger-600"><Trash2 size={15} /></button>
                    </li>
                  ))}
                </ul>
              </section>
            )
          })
        )}
      </div>

      {edicion && (
        <Modal title={edicion.id ? 'Editar plantilla' : 'Nueva plantilla'} onClose={() => setEdicion(null)} size="lg">
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="label" htmlFor="pl-tipo">Tipo</label>
                <select id="pl-tipo" value={edicion.tipo} disabled={Boolean(edicion.id)} onChange={(e) => setEdicion({ ...edicion, tipo: e.target.value as DocumentoTipo })} className="field">
                  {TIPOS_DOCUMENTO.map((t) => <option key={t.codigo} value={t.codigo}>{NOMBRE_TIPO[t.codigo]}</option>)}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="label" htmlFor="pl-nombre">Nombre</label>
                <input id="pl-nombre" value={edicion.nombre} onChange={(e) => setEdicion({ ...edicion, nombre: e.target.value })} className="field" />
              </div>
            </div>

            <div>
              <label className="label" htmlFor="pl-contenido">Contenido</label>
              <textarea id="pl-contenido" rows={11} value={edicion.contenido} onChange={(e) => setEdicion({ ...edicion, contenido: e.target.value })} className="field font-serif" />
              <p className="mt-2 text-xs text-ink-500">
                Variables: {[...VARIABLES_BASE.map((v) => `{{${v.clave}}}`), ...clavesCampos].map((v) => (
                  <button key={v} type="button" onClick={() => setEdicion({ ...edicion, contenido: `${edicion.contenido}${v}` })} className="mr-1.5 rounded bg-ink-100 px-1.5 py-0.5 font-mono text-[11px] hover:bg-brand-100">{v}</button>
                ))}
              </p>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <p className="label !mb-0">Campos a llenar</p>
                <button type="button" onClick={() => setEdicion({ ...edicion, campos: [...edicion.campos, { clave: '', label: '', tipo: 'texto' }] })} className="text-sm font-semibold text-brand-700 hover:underline">+ Agregar campo</button>
              </div>
              <div className="mt-2 space-y-2">
                {edicion.campos.map((c, i) => (
                  <div key={i} className="grid gap-2 sm:grid-cols-[1fr_1.5fr_8rem_auto]">
                    <input aria-label="Clave del campo" placeholder="clave (ej. piezas)" value={c.clave} onChange={(e) => setEdicion({ ...edicion, campos: edicion.campos.map((x, j) => (j === i ? { ...x, clave: e.target.value } : x)) })} className="field" />
                    <input aria-label="Etiqueta del campo" placeholder="Etiqueta (ej. Piezas a tratar)" value={c.label} onChange={(e) => setEdicion({ ...edicion, campos: edicion.campos.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })} className="field" />
                    <select aria-label="Tipo de campo" value={c.tipo} onChange={(e) => setEdicion({ ...edicion, campos: edicion.campos.map((x, j) => (j === i ? { ...x, tipo: e.target.value as CampoPlantilla['tipo'] } : x)) })} className="field">
                      <option value="texto">Texto</option><option value="area">Párrafo</option><option value="fecha">Fecha</option><option value="numero">Número</option>
                    </select>
                    <button type="button" aria-label="Quitar campo" onClick={() => setEdicion({ ...edicion, campos: edicion.campos.filter((_, j) => j !== i) })} className="rounded-xl border border-ink-200 px-3 text-ink-400 hover:bg-danger-50 hover:text-danger-600"><Trash2 size={15} /></button>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setEdicion(null)} className="btn-ghost">Cancelar</button>
              <button type="button" onClick={() => void guardar()} disabled={guardando || !edicion.nombre.trim() || !edicion.contenido.trim()} className="btn-brand">{guardando ? <><Spinner /> Guardando…</> : 'Guardar plantilla'}</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
