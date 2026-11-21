'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import {
  AlertTriangle,
  CalendarClock,
  FileText,
  FlaskConical,
  Receipt,
  ScrollText,
  Stethoscope,
  type LucideIcon,
} from 'lucide-react'
import { fechaCorta, fechaHoraLima, soles } from '@/lib/formato'

export interface EventoExpediente {
  id: string
  tipo: 'ATENCION' | 'EVOLUCION' | 'DOCUMENTO' | 'CITA' | 'PLAN' | 'PAGO'
  fecha: string
  titulo: string
  detalle: string | null
  autor: string | null
  href: string | null
  meta?: Record<string, string | number | null>
}

export interface ExpedienteData {
  paciente: {
    id: string
    nombre: string
    alergias: string | null
    apoderado: string | null
    fechaNacimiento: string | null
  }
  indicadores: {
    atenciones: number
    ultimaAtencion: string | null
    proximaCita: { id: string; fecha: string; tratamiento: string } | null
    hallazgosPendientes: { pieza: number; condicion: string }[]
    fotos: number
    documentos: number
    saldoPlanes: number
    historiaActualizada: string | null
  }
  eventos: EventoExpediente[]
}

const TIPOS: Record<EventoExpediente['tipo'], { label: string; icono: LucideIcon; color: string }> = {
  ATENCION: { label: 'Atenciones', icono: Stethoscope, color: 'bg-brand-500' },
  EVOLUCION: { label: 'Evoluciones', icono: ScrollText, color: 'bg-blue-600' },
  DOCUMENTO: { label: 'Documentos', icono: FileText, color: 'bg-violet-600' },
  CITA: { label: 'Citas', icono: CalendarClock, color: 'bg-amber-500' },
  PLAN: { label: 'Planes', icono: FlaskConical, color: 'bg-mint-500' },
  PAGO: { label: 'Comprobantes', icono: Receipt, color: 'bg-emerald-600' },
}

function Indicador({ titulo, valor, detalle, alerta }: { titulo: string; valor: string | number; detalle?: string; alerta?: boolean }) {
  return (
    <div className={`rounded-2xl border p-4 ${alerta ? 'border-amber-200 bg-amber-50' : 'border-ink-100 bg-white'}`}>
      <p className="text-[11px] font-bold uppercase tracking-wide text-ink-500">{titulo}</p>
      <p className="mt-1 font-display text-3xl font-extrabold leading-none text-ink-900">{valor}</p>
      {detalle && <p className="mt-1.5 text-xs text-ink-500">{detalle}</p>}
    </div>
  )
}

export function ResumenTab({ data }: { data: ExpedienteData }) {
  const [filtro, setFiltro] = useState<EventoExpediente['tipo'] | 'TODOS'>('TODOS')
  const { indicadores: ind, paciente } = data

  // Agrupa por año y mes para que el historial largo se pueda recorrer rápido.
  const grupos = useMemo(() => {
    const eventos = data.eventos.filter((e) => filtro === 'TODOS' || e.tipo === filtro)
    const mapa = new Map<string, EventoExpediente[]>()
    for (const e of eventos) {
      const d = new Date(e.fecha)
      const clave = new Intl.DateTimeFormat('es-PE', { timeZone: 'America/Lima', month: 'long', year: 'numeric' }).format(d)
      mapa.set(clave, [...(mapa.get(clave) ?? []), e])
    }
    return [...mapa.entries()]
  }, [data.eventos, filtro])

  const esMenor = paciente.fechaNacimiento ? (Date.now() - new Date(paciente.fechaNacimiento).getTime()) / 31_557_600_000 < 18 : false

  return (
    <div className="space-y-6">
      {(paciente.alergias || (esMenor && !paciente.apoderado)) && (
        <div role="alert" className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <AlertTriangle size={20} className="mt-0.5 shrink-0" />
          <div>
            {paciente.alergias && <p><strong>Alergias:</strong> {paciente.alergias}</p>}
            {esMenor && !paciente.apoderado && <p>Paciente menor de edad sin apoderado registrado: complétalo antes de firmar consentimientos.</p>}
          </div>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Indicador titulo="Atenciones" valor={ind.atenciones} detalle={ind.ultimaAtencion ? `Última: ${fechaCorta(ind.ultimaAtencion)}` : 'Sin atenciones aún'} />
        <Indicador titulo="Próxima cita" valor={ind.proximaCita ? fechaCorta(ind.proximaCita.fecha) : '—'} detalle={ind.proximaCita ? `${ind.proximaCita.tratamiento}` : 'Sin cita programada'} />
        <Indicador titulo="Hallazgos por tratar" valor={ind.hallazgosPendientes.length} detalle={ind.hallazgosPendientes.slice(0, 3).map((h) => `${h.pieza} ${h.condicion}`).join(' · ') || 'Odontograma al día'} alerta={ind.hallazgosPendientes.length > 0} />
        <Indicador titulo="Saldo de planes" valor={soles(ind.saldoPlanes)} detalle={`${ind.documentos} documentos · ${ind.fotos} fotos`} alerta={ind.saldoPlanes > 0} />
      </div>

      <section>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-display text-xl font-extrabold">Historial clínico</h3>
          <div className="flex flex-wrap gap-1.5">
            {(['TODOS', ...Object.keys(TIPOS)] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setFiltro(t as typeof filtro)}
                className={`rounded-full px-3 py-1 text-xs font-bold transition ${filtro === t ? 'bg-ink-900 text-white' : 'bg-ink-100 text-ink-600 hover:bg-ink-200'}`}
              >
                {t === 'TODOS' ? 'Todo' : TIPOS[t as EventoExpediente['tipo']].label}
              </button>
            ))}
          </div>
        </div>

        {grupos.length === 0 ? (
          <p className="mt-6 rounded-2xl border border-dashed border-ink-200 p-8 text-center text-sm text-ink-500">Aún no hay registros en el expediente.</p>
        ) : (
          <div className="mt-5 space-y-7">
            {grupos.map(([mes, eventos]) => (
              <div key={mes}>
                <p className="mb-3 text-xs font-extrabold uppercase tracking-[0.18em] text-ink-400">{mes}</p>
                <ol className="relative space-y-3 border-l-2 border-ink-100 pl-6">
                  {eventos.map((e) => {
                    const { icono: Icono, color, label } = TIPOS[e.tipo]
                    const total = typeof e.meta?.total === 'number' ? e.meta.total : null
                    const contenido = (
                      <div className="rounded-2xl border border-ink-100 bg-white p-4 transition hover:border-brand-200 hover:shadow-soft">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[11px] font-bold uppercase tracking-wide text-ink-400">{label}</span>
                          <span className="text-xs text-ink-400">· {fechaHoraLima(e.fecha)}</span>
                          {e.autor && <span className="text-xs text-ink-400">· {e.autor}</span>}
                          {total !== null && total > 0 && <span className="ml-auto rounded-full bg-ink-100 px-2 py-0.5 text-xs font-bold text-ink-700">{soles(total)}</span>}
                        </div>
                        <p className="mt-1 font-semibold text-ink-900">{e.titulo}</p>
                        {e.detalle && <p className="mt-1 line-clamp-3 whitespace-pre-line text-sm text-ink-600">{e.detalle}</p>}
                        {typeof e.meta?.fotos === 'number' && e.meta.fotos > 0 && <p className="mt-1 text-xs text-ink-400">{e.meta.fotos} fotos adjuntas</p>}
                        {e.meta?.piezas ? <p className="mt-1 text-xs text-ink-400">Piezas: {String(e.meta.piezas)}</p> : null}
                      </div>
                    )
                    return (
                      <li key={`${e.tipo}-${e.id}`} className="relative">
                        <span className={`absolute -left-[37px] top-3 flex h-6 w-6 items-center justify-center rounded-full text-white ring-4 ring-[#f8f9fc] ${color}`}>
                          <Icono size={13} />
                        </span>
                        {e.href ? <Link href={e.href} className="block">{contenido}</Link> : contenido}
                      </li>
                    )
                  })}
                </ol>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
