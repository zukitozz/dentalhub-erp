'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { FilePlus2, FileText, LayoutTemplate } from 'lucide-react'
import { Pagination } from '@/components/Pagination'
import { Spinner } from '@/components/Spinner'
import { ESTADO_DOCUMENTO } from '@/components/documentos/estado'
import { api, fechaHoraLima, soles } from '@/lib/formato'
import { NOMBRE_TIPO, TIPOS_DOCUMENTO } from '@/lib/documentos'

interface Doc {
  id: string
  numero: string
  tipo: string
  titulo: string
  estado: string
  total: number | null
  creadoAt: string
  paciente: { id: string; nombre: string; dni: string | null }
  odontologo: { name: string } | null
}

const PAGE_SIZE = 12

export default function DocumentosPage() {
  const [docs, setDocs] = useState<Doc[] | null>(null)
  const [tipo, setTipo] = useState('')
  const [q, setQ] = useState('')
  const [pagina, setPagina] = useState(1)

  useEffect(() => {
    setDocs(null)
    const t = setTimeout(() => {
      const params = new URLSearchParams()
      if (tipo) params.set('tipo', tipo)
      if (q.trim()) params.set('q', q.trim())
      api<Doc[]>(`/api/documentos?${params}`).then((r) => { setDocs(r.ok ? r.data : []); setPagina(1) })
    }, 250)
    return () => clearTimeout(t)
  }, [tipo, q])

  const totalPaginas = Math.max(1, Math.ceil((docs?.length ?? 0) / PAGE_SIZE))
  const visibles = (docs ?? []).slice((pagina - 1) * PAGE_SIZE, pagina * PAGE_SIZE)

  return (
    <div className="page-shell px-4 py-8 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="card-surface flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="eyebrow">Documentos</p>
            <h1 className="page-heading mt-3 text-3xl">Documentos listos para entregar</h1>
            <p className="mt-2 max-w-xl text-ink-600">Consentimientos, recetas y presupuestos con la información del paciente, el profesional y la identidad del consultorio.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/documentos/plantillas" className="btn-ghost"><LayoutTemplate size={16} /> Plantillas</Link>
            <Link href="/documentos/nuevo" className="btn-brand"><FilePlus2 size={16} /> Nuevo documento</Link>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          {TIPOS_DOCUMENTO.filter((t) => t.codigo !== 'OTRO').map((t, i) => (
            <Link key={t.codigo} href={`/documentos/nuevo?tipo=${t.codigo}`} className="card-surface group flex items-center gap-4 transition hover:-translate-y-0.5 hover:border-brand-200">
              <span className={`flex h-11 w-11 items-center justify-center rounded-xl text-white ${['bg-violet-600', 'bg-brand-500', 'bg-emerald-600'][i]}`}><FileText size={20} /></span>
              <span>
                <span className="block text-[11px] font-bold uppercase tracking-wide text-ink-400">Nuevo</span>
                <span className="font-display text-lg font-extrabold">{t.nombre}</span>
              </span>
            </Link>
          ))}
        </div>

        <div className="card-surface">
          <div className="flex flex-wrap items-center gap-3">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por paciente, DNI o número…" className="field !w-auto min-w-[16rem] flex-1" aria-label="Buscar documentos" />
            <div className="flex flex-wrap gap-1.5">
              {[{ codigo: '', plural: 'Todos' }, ...TIPOS_DOCUMENTO].map((t) => (
                <button key={t.codigo} type="button" onClick={() => setTipo(t.codigo)} className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${tipo === t.codigo ? 'bg-ink-900 text-white' : 'bg-ink-100 text-ink-600 hover:bg-ink-200'}`}>{t.plural}</button>
              ))}
            </div>
          </div>

          <div className="mt-5">
            {docs === null ? (
              <p className="text-sm text-ink-500"><Spinner /> Cargando documentos…</p>
            ) : visibles.length === 0 ? (
              <p className="py-8 text-center text-sm text-ink-500">No hay documentos con esos filtros.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left">
                  <thead><tr><th className="th">Número</th><th className="th">Paciente</th><th className="th">Documento</th><th className="th">Fecha</th><th className="th text-right">Total</th><th className="th">Estado</th></tr></thead>
                  <tbody>
                    {visibles.map((d) => (
                      <tr key={d.id} className="border-t border-ink-50 transition hover:bg-ink-50">
                        <td className="td font-bold"><Link href={`/documentos/${d.id}`} className="text-brand-700 hover:underline">{d.numero}</Link></td>
                        <td className="td"><Link href={`/pacientes/${d.paciente.id}?tab=documentos`} className="hover:text-brand-700">{d.paciente.nombre}</Link></td>
                        <td className="td"><span className="block font-semibold">{d.titulo}</span><span className="text-xs text-ink-400">{NOMBRE_TIPO[d.tipo]}{d.odontologo ? ` · ${d.odontologo.name}` : ''}</span></td>
                        <td className="td">{fechaHoraLima(d.creadoAt)}</td>
                        <td className="td text-right">{d.total !== null ? soles(d.total) : '—'}</td>
                        <td className="td"><span className={`badge ${ESTADO_DOCUMENTO[d.estado]?.clase}`}>{ESTADO_DOCUMENTO[d.estado]?.texto}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <Pagination page={pagina} totalPages={totalPaginas} onChange={setPagina} />
        </div>
      </div>
    </div>
  )
}
