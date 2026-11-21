'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { FilePlus2 } from 'lucide-react'
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
  odontologo: { name: string } | null
}

export function DocumentosPacienteTab({ pacienteId }: { pacienteId: string }) {
  const [docs, setDocs] = useState<Doc[] | null>(null)

  useEffect(() => {
    api<Doc[]>(`/api/documentos?pacienteId=${pacienteId}`).then((r) => setDocs(r.ok ? r.data : []))
  }, [pacienteId])

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        {TIPOS_DOCUMENTO.filter((t) => t.codigo !== 'OTRO').map((t) => (
          <Link key={t.codigo} href={`/documentos/nuevo?tipo=${t.codigo}&pacienteId=${pacienteId}`} className="btn-ghost btn-sm">
            <FilePlus2 size={15} /> Nuevo {t.nombre.toLowerCase()}
          </Link>
        ))}
      </div>

      {docs === null ? (
        <p className="text-sm text-ink-500"><Spinner /> Cargando documentos…</p>
      ) : docs.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-ink-200 p-8 text-center text-sm text-ink-500">Este paciente no tiene documentos emitidos.</p>
      ) : (
        <ul className="divide-y divide-ink-100 rounded-2xl border border-ink-100 bg-white">
          {docs.map((d) => (
            <li key={d.id}>
              <Link href={`/documentos/${d.id}`} className="flex flex-wrap items-center gap-3 px-4 py-3 transition hover:bg-ink-50">
                <span className="w-24 shrink-0 text-xs font-bold text-ink-500">{d.numero}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-ink-900">{d.titulo}</span>
                  <span className="text-xs text-ink-400">{NOMBRE_TIPO[d.tipo]} · {fechaHoraLima(d.creadoAt)}{d.odontologo ? ` · ${d.odontologo.name}` : ''}</span>
                </span>
                {d.total !== null && <span className="text-sm font-bold text-ink-700">{soles(d.total)}</span>}
                <span className={`badge ${ESTADO_DOCUMENTO[d.estado]?.clase}`}>{ESTADO_DOCUMENTO[d.estado]?.texto}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
