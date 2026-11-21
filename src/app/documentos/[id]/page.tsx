'use client'

import Link from 'next/link'
import { use, useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Ban, CheckCircle2, ClipboardCheck, Printer } from 'lucide-react'
import { Spinner } from '@/components/Spinner'
import { useToast } from '@/components/Toast'
import { useConfirm } from '@/components/ConfirmDialog'
import { ESTADO_DOCUMENTO } from '@/components/documentos/estado'
import { api, fechaLarga, soles } from '@/lib/formato'
import {
  edadDesde,
  NOMBRE_TIPO,
  totalPresupuesto,
  type DatosPresupuesto,
  type DatosReceta,
} from '@/lib/documentos'

interface DocumentoCompleto {
  id: string
  numero: string
  tipo: 'CONSENTIMIENTO' | 'RECETA' | 'PRESUPUESTO' | 'OTRO'
  titulo: string
  estado: string
  contenido: string
  datos: (DatosReceta & DatosPresupuesto) | null
  total: number | null
  creadoAt: string
  firmadoAt: string | null
  paciente: { id: string; nombre: string; dni: string | null; ruc: string | null; carnetExtranjeria: string | null; fechaNacimiento: string | null; apoderado: string | null; alergias: string | null }
  odontologo: { name: string; colegiatura: string | null; especialidad: string | null } | null
  configuracion: { nombreEmpresa: string; ruc: string | null; razonSocial: string | null; direccionFiscal: string | null; telefono: string | null; email: string | null; pieDocumentos: string | null } | null
}

export default function DocumentoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const toast = useToast()
  const confirmar = useConfirm()
  const [doc, setDoc] = useState<DocumentoCompleto | null>(null)
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    const r = await api<DocumentoCompleto>(`/api/documentos/${id}`)
    if (r.ok) setDoc(r.data)
    else setError(r.error)
  }, [id])

  useEffect(() => { void cargar() }, [cargar])

  const cambiarEstado = async (estado: 'FIRMADO' | 'ANULADO') => {
    if (estado === 'ANULADO') {
      const ok = await confirmar({ title: 'Anular documento', mensaje: 'El documento quedará anulado y no podrá usarse. ¿Continuar?', textoConfirmar: 'Anular', peligro: true })
      if (!ok) return
    }
    const r = await api(`/api/documentos/${id}`, { method: 'PATCH', body: { estado } })
    if (!r.ok) return toast.error(r.error)
    toast.success(estado === 'FIRMADO' ? 'Documento marcado como firmado' : 'Documento anulado')
    await cargar()
  }

  const convertirEnPlan = async () => {
    if (!doc?.datos?.items) return
    const items = doc.datos.items.map((i) => ({ descripcion: i.descripcion, pieza: i.pieza, cantidad: i.cantidad, precioUnit: i.precioUnit, tratamientoId: i.tratamientoId }))
    const r = await api<{ id: string }>('/api/planes', { method: 'POST', body: { pacienteId: doc.paciente.id, nombre: `${doc.titulo} (${doc.numero})`, items } })
    if (!r.ok) return toast.error(r.error)
    toast.success('Plan de tratamiento creado a partir del presupuesto')
    router.push(`/pacientes/${doc.paciente.id}?tab=planes`)
  }

  if (error) return <div className="p-8"><p role="alert" className="rounded-xl bg-danger-50 px-4 py-3 text-sm font-semibold text-danger-700">{error}</p></div>
  if (!doc) return <div className="p-8 text-ink-500"><Spinner /> Cargando documento…</div>

  const c = doc.configuracion
  const p = doc.paciente
  const edad = edadDesde(p.fechaNacimiento)
  const documentoPaciente = p.dni ? `DNI ${p.dni}` : p.carnetExtranjeria ? `CE ${p.carnetExtranjeria}` : p.ruc ? `RUC ${p.ruc}` : '—'
  const anulado = doc.estado === 'ANULADO'
  const vigenciaDias = doc.datos?.validezDias ?? 30
  const vence = new Date(new Date(doc.creadoAt).getTime() + vigenciaDias * 86_400_000)

  return (
    <div className="page-shell px-4 py-8 sm:px-6 lg:px-10 print:p-0">
      <div className="mx-auto max-w-4xl space-y-5">
        <div className="no-print flex flex-wrap items-center gap-3">
          <Link href="/documentos" className="inline-flex items-center gap-2 text-sm font-semibold text-ink-500 hover:text-brand-700"><ArrowLeft size={16} /> Documentos</Link>
          <span className={`badge ${ESTADO_DOCUMENTO[doc.estado]?.clase}`}>{ESTADO_DOCUMENTO[doc.estado]?.texto}</span>
          <div className="ml-auto flex flex-wrap gap-2">
            {doc.tipo === 'PRESUPUESTO' && !anulado && <button type="button" onClick={() => void convertirEnPlan()} className="btn-ghost btn-sm"><ClipboardCheck size={15} /> Crear plan de tratamiento</button>}
            {doc.estado === 'EMITIDO' && <button type="button" onClick={() => void cambiarEstado('FIRMADO')} className="btn-ghost btn-sm"><CheckCircle2 size={15} /> Marcar firmado</button>}
            {!anulado && <button type="button" onClick={() => void cambiarEstado('ANULADO')} className="btn-ghost btn-sm text-danger-600"><Ban size={15} /> Anular</button>}
            <button type="button" onClick={() => window.print()} className="btn-brand btn-sm"><Printer size={15} /> Imprimir / PDF</button>
          </div>
        </div>

        <article className="documento-impresion relative rounded-[22px] border border-ink-100 bg-white p-10 font-serif text-[15px] leading-relaxed text-ink-900 shadow-soft">
          {anulado && <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-8xl font-extrabold uppercase tracking-widest text-danger-500/15 [transform:rotate(-20deg)]">Anulado</p>}

          <header className="flex flex-wrap items-start justify-between gap-6 border-b-2 border-brand-500 pb-5 font-body">
            <div>
              <p className="font-display text-2xl font-extrabold text-brand-800">{c?.nombreEmpresa ?? 'HubDental'}</p>
              {c?.razonSocial && <p className="text-sm text-ink-600">{c.razonSocial}{c.ruc ? ` · RUC ${c.ruc}` : ''}</p>}
              {c?.direccionFiscal && <p className="text-sm text-ink-500">{c.direccionFiscal}</p>}
              <p className="text-sm text-ink-500">{[c?.telefono, c?.email].filter(Boolean).join(' · ')}</p>
            </div>
            <div className="text-right">
              <p className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-brand-700">{NOMBRE_TIPO[doc.tipo]}</p>
              <p className="font-display text-xl font-extrabold">{doc.numero}</p>
              <p className="text-sm text-ink-500">{fechaLarga(doc.creadoAt)}</p>
            </div>
          </header>

          <section className="mt-5 grid gap-x-8 gap-y-1 rounded-xl bg-ink-50 p-4 font-body text-sm sm:grid-cols-2">
            <p><span className="text-ink-500">Paciente:</span> <strong>{p.nombre}</strong></p>
            <p><span className="text-ink-500">Documento:</span> {documentoPaciente}</p>
            {edad !== null && <p><span className="text-ink-500">Edad:</span> {edad} años</p>}
            {p.apoderado && <p><span className="text-ink-500">Apoderado:</span> {p.apoderado}</p>}
            {doc.tipo === 'RECETA' && p.alergias && <p className="sm:col-span-2"><span className="text-ink-500">Alergias:</span> <strong className="text-danger-700">{p.alergias}</strong></p>}
          </section>

          <h1 className="mt-6 text-center font-body text-xl font-extrabold uppercase tracking-wide">{doc.titulo}</h1>

          {doc.tipo === 'RECETA' && doc.datos && (
            <section className="mt-5">
              {doc.datos.diagnostico && <p className="mb-3"><strong>Diagnóstico:</strong> {doc.datos.diagnostico}</p>}
              <p className="font-display text-3xl font-extrabold text-brand-700">Rp.</p>
              <ol className="mt-2 list-decimal space-y-3 pl-6">
                {doc.datos.medicamentos.map((m, i) => (
                  <li key={i}>
                    <p><strong>{m.medicamento}</strong>{m.presentacion ? ` — ${m.presentacion}` : ''}</p>
                    <p className="text-sm text-ink-700">{[m.dosis && `Dosis: ${m.dosis}`, m.frecuencia, m.duracion].filter(Boolean).join(' · ')}</p>
                    {m.indicaciones && <p className="text-sm italic text-ink-600">{m.indicaciones}</p>}
                  </li>
                ))}
              </ol>
              {doc.contenido && <p className="mt-5 whitespace-pre-line border-t border-ink-100 pt-3 text-sm text-ink-700">{doc.contenido}</p>}
            </section>
          )}

          {doc.tipo === 'PRESUPUESTO' && doc.datos && (
            <section className="mt-5 font-body">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-ink-200 text-left text-xs uppercase tracking-wide text-ink-500">
                    <th className="py-2">Tratamiento</th><th className="py-2">Pieza</th><th className="py-2 text-right">Cant.</th><th className="py-2 text-right">P. unit.</th><th className="py-2 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {doc.datos.items.map((it, i) => (
                    <tr key={i} className="border-b border-ink-100">
                      <td className="py-2">{it.descripcion}</td><td className="py-2">{it.pieza || '—'}</td>
                      <td className="py-2 text-right">{it.cantidad}</td><td className="py-2 text-right">{soles(it.precioUnit)}</td>
                      <td className="py-2 text-right font-semibold">{soles(it.cantidad * it.precioUnit)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr><td colSpan={4} className="pt-3 text-right text-sm font-bold uppercase tracking-wide text-ink-500">Total</td><td className="pt-3 text-right font-display text-2xl font-extrabold">{soles(doc.total ?? totalPresupuesto(doc.datos.items))}</td></tr>
                </tfoot>
              </table>
              <p className="mt-3 text-xs text-ink-500">Presupuesto válido hasta el {fechaLarga(vence)} ({vigenciaDias} días).</p>
              {doc.contenido && <p className="mt-3 whitespace-pre-line font-serif text-sm text-ink-700">{doc.contenido}</p>}
            </section>
          )}

          {(doc.tipo === 'CONSENTIMIENTO' || doc.tipo === 'OTRO') && <p className="mt-5 whitespace-pre-line text-justify">{doc.contenido}</p>}

          <footer className="mt-14 font-body">
            {doc.tipo === 'CONSENTIMIENTO' ? (
              <div className="grid gap-10 sm:grid-cols-2">
                <div className="border-t border-ink-700 pt-2 text-center text-sm"><strong>{p.apoderado ?? p.nombre}</strong><br />{p.apoderado ? 'Apoderado' : 'Paciente'} · {documentoPaciente}<br /><span className="text-xs text-ink-500">Firma y huella</span></div>
                <div className="border-t border-ink-700 pt-2 text-center text-sm"><strong>{doc.odontologo?.name ?? '________________'}</strong><br />Cirujano Dentista{doc.odontologo?.colegiatura ? ` · COP ${doc.odontologo.colegiatura}` : ''}</div>
              </div>
            ) : (
              <div className="ml-auto w-72 border-t border-ink-700 pt-2 text-center text-sm"><strong>{doc.odontologo?.name ?? '________________'}</strong><br />{doc.odontologo?.especialidad ?? 'Cirujano Dentista'}{doc.odontologo?.colegiatura ? ` · COP ${doc.odontologo.colegiatura}` : ''}</div>
            )}
            {c?.pieDocumentos && <p className="mt-8 text-center text-xs text-ink-400">{c.pieDocumentos}</p>}
            {doc.firmadoAt && <p className="mt-3 text-center text-[11px] text-emerald-700">Firmado el {fechaLarga(doc.firmadoAt)}</p>}
          </footer>
        </article>
      </div>
    </div>
  )
}
