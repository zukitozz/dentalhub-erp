'use client'

import Link from 'next/link'
import { Suspense, use, useCallback, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, CalendarPlus, Cake, Mail, MapPin, Phone, Stethoscope } from 'lucide-react'
import { Spinner } from '@/components/Spinner'
import { DocumentosPacienteTab } from '@/components/expediente/DocumentosPacienteTab'
import { EvolucionesTab } from '@/components/expediente/EvolucionesTab'
import { FotosTab } from '@/components/expediente/FotosTab'
import { HistoriaTab } from '@/components/expediente/HistoriaTab'
import { OdontogramaTab } from '@/components/expediente/OdontogramaTab'
import { PlanesTab } from '@/components/expediente/PlanesTab'
import { ResumenTab, type ExpedienteData } from '@/components/expediente/ResumenTab'
import { api, fechaCorta } from '@/lib/formato'
import { edadDesde } from '@/lib/documentos'

const TABS = [
  ['resumen', 'Resumen'],
  ['historia', 'Historia clínica'],
  ['odontograma', 'Odontograma'],
  ['evoluciones', 'Evoluciones'],
  ['planes', 'Planes'],
  ['fotos', 'Fotografías'],
  ['documentos', 'Documentos'],
] as const

type Tab = (typeof TABS)[number][0]

function Expediente({ id }: { id: string }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const tabParam = searchParams.get('tab') as Tab | null
  const tab: Tab = TABS.some(([t]) => t === tabParam) ? (tabParam as Tab) : 'resumen'
  const [data, setData] = useState<ExpedienteData | null>(null)
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    const r = await api<ExpedienteData>(`/api/pacientes/${id}/expediente`)
    if (r.ok) setData(r.data)
    else setError(r.error)
  }, [id])

  useEffect(() => { void cargar() }, [cargar])

  const irA = (t: Tab) => router.replace(`/pacientes/${id}?tab=${t}`, { scroll: false })

  if (error) return <div className="p-8"><p role="alert" className="rounded-xl bg-danger-50 px-4 py-3 text-sm font-semibold text-danger-700">{error}</p></div>
  if (!data) return <div className="p-8 text-ink-500"><Spinner /> Cargando expediente…</div>

  const p = data.paciente as ExpedienteData['paciente'] & {
    nombre: string; dni: string | null; ruc: string | null; carnetExtranjeria: string | null; celular: string | null
    email: string | null; distrito: string | null; direccion: string | null; fechaNacimiento: string | null; sexo: string | null
  }
  const edad = edadDesde(p.fechaNacimiento)
  const documento = p.dni ? `DNI ${p.dni}` : p.carnetExtranjeria ? `CE ${p.carnetExtranjeria}` : p.ruc ? `RUC ${p.ruc}` : 'Sin documento'
  const iniciales = p.nombre.split(' ').map((x) => x[0]).slice(0, 2).join('').toUpperCase()

  return (
    <div className="page-shell px-4 py-8 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <Link href="/pacientes" className="inline-flex items-center gap-2 text-sm font-semibold text-ink-500 hover:text-brand-700"><ArrowLeft size={16} /> Pacientes</Link>

        <header className="card-surface flex flex-wrap items-center gap-5">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-brand-500 font-display text-2xl font-extrabold text-white">{iniciales}</div>
          <div className="min-w-0 flex-1">
            <p className="eyebrow">Expediente clínico</p>
            <h1 className="page-heading mt-1 truncate text-3xl">{p.nombre}</h1>
            <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-500">
              <span>{documento}</span>
              {edad !== null && <span className="inline-flex items-center gap-1"><Cake size={14} /> {edad} años · {fechaCorta(p.fechaNacimiento)}</span>}
              {p.celular && <span className="inline-flex items-center gap-1"><Phone size={14} /> {p.celular}</span>}
              {p.email && <span className="inline-flex items-center gap-1"><Mail size={14} /> {p.email}</span>}
              {(p.direccion || p.distrito) && <span className="inline-flex items-center gap-1"><MapPin size={14} /> {[p.direccion, p.distrito].filter(Boolean).join(', ')}</span>}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={`/citas?pacienteId=${id}&nueva=1`} className="btn-ghost"><CalendarPlus size={16} /> Agendar cita</Link>
            <Link href={`/atenciones?pacienteId=${id}`} className="btn-brand"><Stethoscope size={16} /> Atenciones</Link>
          </div>
        </header>

        <nav className="flex gap-1 overflow-x-auto rounded-2xl border border-ink-100 bg-white p-1.5" aria-label="Secciones del expediente">
          {TABS.map(([t, label]) => (
            <button
              key={t}
              type="button"
              onClick={() => irA(t)}
              aria-current={tab === t ? 'page' : undefined}
              className={`whitespace-nowrap rounded-xl px-4 py-2 text-sm font-semibold transition ${tab === t ? 'bg-ink-900 text-white' : 'text-ink-600 hover:bg-ink-50'}`}
            >{label}</button>
          ))}
        </nav>

        <div>
          {tab === 'resumen' && <ResumenTab data={data} />}
          {tab === 'historia' && <HistoriaTab pacienteId={id} onGuardado={cargar} />}
          {tab === 'odontograma' && <OdontogramaTab pacienteId={id} onCambio={cargar} />}
          {tab === 'evoluciones' && <EvolucionesTab pacienteId={id} onCambio={cargar} />}
          {tab === 'planes' && <PlanesTab pacienteId={id} onCambio={cargar} />}
          {tab === 'fotos' && <FotosTab pacienteId={id} onCambio={cargar} />}
          {tab === 'documentos' && <DocumentosPacienteTab pacienteId={id} />}
        </div>
      </div>
    </div>
  )
}

export default function ExpedientePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  return (
    <Suspense fallback={<div className="p-8 text-ink-500"><Spinner /> Cargando expediente…</div>}>
      <Expediente id={id} />
    </Suspense>
  )
}
