'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Camera } from 'lucide-react'
import { Modal } from '@/components/Modal'
import { AtencionFotos } from '@/components/AtencionFotos'

interface Paciente { id: string; nombre: string }
interface Tratamiento { id: string; nombre: string; precio?: number }
interface Consultorio { id: string; nombre: string }
interface Odontologo { id: string; name: string }
interface Foto { id: string; url: string; descripcion: string | null; creadoAt: string }

function formatearFechaFoto(fecha: string) {
  return new Date(fecha).toLocaleString('es-PE', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

interface Atencion {
  id: string
  horaInicio: string
  horaFin: string | null
  notas: string | null
  atencionId: string
  estado: 'PENDIENTE' | 'EN_CURSO' | 'FINALIZADA' | 'CANCELADA'
  // Precio acordado al asignar el tratamiento a la visita (si no se cambió, coincide con el
  // precio de catálogo) y el precio de catálogo capturado en ese momento, para evidenciar cambios.
  precio: number | null
  precioCatalogo: number | null
  consultorio: Consultorio | null
  paciente: Paciente
  tratamiento: { id: string; nombre: string; duracionMin: number; precio: number }
  odontologo: Odontologo
  cita: { id: string; fecha: string } | null
  fotos: Foto[]
}

/** true si el precio acordado difiere del precio de catálogo capturado en ese momento. */
function precioFueModificado(atencion: Pick<Atencion, 'precio' | 'precioCatalogo'>) {
  if (atencion.precio == null || atencion.precioCatalogo == null) return false
  return Math.abs(atencion.precio - atencion.precioCatalogo) > 0.005
}

function costoAtencion(atencion: Atencion) {
  return atencion.precio ?? atencion.tratamiento.precio
}

const estadoLabels: Record<Atencion['estado'], string> = {
  PENDIENTE: 'Pendiente',
  EN_CURSO: 'En curso',
  FINALIZADA: 'Finalizada',
  CANCELADA: 'Cancelada',
}

function calcularDuracion(atencion: Atencion) {
  if (!atencion.horaFin) return '—'
  const minutos = Math.round((new Date(atencion.horaFin).getTime() - new Date(atencion.horaInicio).getTime()) / 60000)
  return `${minutos} min`
}

function FotosPreview({ fotos }: { fotos: Foto[] }) {
  if (fotos.length === 0) {
    return <Camera size={18} className="text-ink-300" aria-hidden />
  }

  return (
    <div className="group relative inline-flex" onClick={(event) => event.stopPropagation()}>
      <button type="button" className="relative flex h-8 w-8 items-center justify-center rounded-full text-brand-700 transition hover:bg-brand-50">
        <Camera size={18} />
        <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-600 px-1 text-[10px] font-semibold text-white">
          {fotos.length}
        </span>
      </button>
      <div className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 hidden w-max max-w-xs -translate-x-1/2 flex-wrap gap-2 rounded-2xl border border-ink-200 bg-white p-3 shadow-lg group-hover:flex">
        {fotos.slice(0, 8).map((foto) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={foto.id} src={foto.url} alt={formatearFechaFoto(foto.creadoAt)} title={formatearFechaFoto(foto.creadoAt)} className="h-14 w-14 rounded-xl border border-ink-200 object-cover" />
        ))}
        {fotos.length > 8 && <span className="flex h-14 w-14 items-center justify-center rounded-xl bg-ink-100 text-xs text-ink-500">+{fotos.length - 8}</span>}
      </div>
    </div>
  )
}

function DetalleAtencion({ atencion, onClose, onFotosCambio }: { atencion: Atencion; onClose: () => void; onFotosCambio: () => void }) {
  return (
    <Modal title={atencion.paciente.nombre} onClose={onClose}>
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div><p className="text-xs uppercase tracking-[0.2em] text-ink-500">Tratamiento</p><p className="text-sm font-semibold text-ink-900">{atencion.tratamiento.nombre}</p></div>
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-ink-500">Costo</p>
            <p className="flex items-center gap-2 text-sm font-semibold text-ink-900">
              S/ {costoAtencion(atencion).toFixed(2)}
              {precioFueModificado(atencion) && (
                <span title={`Precio de catálogo: S/ ${atencion.precioCatalogo!.toFixed(2)}`} className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                  Precio modificado
                </span>
              )}
            </p>
          </div>
          <div><p className="text-xs uppercase tracking-[0.2em] text-ink-500">Consultorio</p><p className="text-sm text-ink-700">{atencion.consultorio?.nombre ?? 'Sin consultorio'}</p></div>
          <div><p className="text-xs uppercase tracking-[0.2em] text-ink-500">Odontólogo</p><p className="text-sm text-ink-700">{atencion.odontologo.name}</p></div>
          <div><p className="text-xs uppercase tracking-[0.2em] text-ink-500">Inicio</p><p className="text-sm text-ink-700">{new Date(atencion.horaInicio).toLocaleString('es-PE')}</p></div>
          <div><p className="text-xs uppercase tracking-[0.2em] text-ink-500">Duración</p><p className="text-sm text-ink-700">{calcularDuracion(atencion)}</p></div>
          <div><p className="text-xs uppercase tracking-[0.2em] text-ink-500">Cita</p><p className="text-sm text-ink-700">{atencion.cita ? new Date(atencion.cita.fecha).toLocaleString('es-PE') : 'Walk-in'}</p></div>
          <div><p className="text-xs uppercase tracking-[0.2em] text-ink-500">Estado</p><p className="text-sm text-ink-700">{estadoLabels[atencion.estado]}</p></div>
        </div>

        {atencion.notas && (
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-ink-500">Notas</p>
            <p className="mt-1 text-sm text-ink-600">{atencion.notas}</p>
          </div>
        )}

        <AtencionFotos atencionId={atencion.atencionId} onCambio={onFotosCambio} />
      </div>
    </Modal>
  )
}

function HistoricoAtencionesContent() {
  const searchParams = useSearchParams()

  const [pacientes, setPacientes] = useState<Paciente[]>([])
  const [tratamientos, setTratamientos] = useState<Tratamiento[]>([])
  const [consultorios, setConsultorios] = useState<Consultorio[]>([])
  const [odontologos, setOdontologos] = useState<Odontologo[]>([])
  const [atenciones, setAtenciones] = useState<Atencion[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(15)
  const [loading, setLoading] = useState(true)
  const [sinPermiso, setSinPermiso] = useState(false)
  const [detalle, setDetalle] = useState<Atencion | null>(null)
  const [filtros, setFiltros] = useState(() => ({
    pacienteId: searchParams.get('pacienteId') || '',
    tratamientoId: '',
    consultorioId: '',
    odontologoId: '',
    estado: '',
    desde: '',
    hasta: '',
  }))
  const [pacienteQuery, setPacienteQuery] = useState('')
  const [showPacienteDropdown, setShowPacienteDropdown] = useState(false)
  const [tratamientoQuery, setTratamientoQuery] = useState('')
  const [showTratamientoDropdown, setShowTratamientoDropdown] = useState(false)

  useEffect(() => {
    Promise.all([
      fetch('/api/pacientes').then((res) => res.json()),
      fetch('/api/tratamientos').then((res) => res.json()),
      fetch('/api/consultorios').then((res) => res.json()),
      fetch('/api/usuarios/odontologos').then((res) => res.json()),
    ]).then(([pacientesData, tratamientosData, consultoriosData, odontologosData]) => {
      setPacientes(Array.isArray(pacientesData) ? pacientesData : [])
      setTratamientos(Array.isArray(tratamientosData) ? tratamientosData : [])
      setConsultorios(Array.isArray(consultoriosData) ? consultoriosData : [])
      setOdontologos(Array.isArray(odontologosData) ? odontologosData : [])
    })
  }, [])

  useEffect(() => {
    if (!filtros.pacienteId || pacienteQuery) return
    const match = pacientes.find((paciente) => paciente.id === filtros.pacienteId)
    if (match) setPacienteQuery(match.nombre)
  }, [pacientes, filtros.pacienteId, pacienteQuery])

  const pacientesFiltrados = useMemo(() => {
    const query = pacienteQuery.trim().toLowerCase()
    if (!query) return pacientes.slice(0, 8)
    return pacientes.filter((paciente) => paciente.nombre.toLowerCase().includes(query)).slice(0, 8)
  }, [pacientes, pacienteQuery])

  const tratamientosFiltrados = useMemo(() => {
    const query = tratamientoQuery.trim().toLowerCase()
    if (!query) return tratamientos.slice(0, 8)
    return tratamientos.filter((tratamiento) => tratamiento.nombre.toLowerCase().includes(query)).slice(0, 8)
  }, [tratamientos, tratamientoQuery])

  const buscar = async (pageToLoad = 1) => {
    setLoading(true)
    setSinPermiso(false)
    const params = new URLSearchParams()
    Object.entries(filtros).forEach(([key, value]) => { if (value) params.set(key, value) })
    params.set('page', String(pageToLoad))
    params.set('pageSize', String(pageSize))
    const response = await fetch(`/api/atenciones?${params.toString()}`)
    if (response.status === 403) {
      setSinPermiso(true)
      setAtenciones([])
      setTotal(0)
      setLoading(false)
      return
    }
    const data = await response.json()
    setAtenciones(Array.isArray(data.items) ? data.items : [])
    setTotal(typeof data.total === 'number' ? data.total : 0)
    setPage(pageToLoad)
    setLoading(false)
  }

  useEffect(() => { void buscar(1) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  return (
    <div className="page-shell px-4 py-8 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="card-surface">
          <p className="eyebrow">Histórico</p>
          <h1 className="mt-3 page-heading text-3xl">Histórico de Atenciones</h1>
          <p className="mt-2 text-ink-600">Filtra por fecha, paciente y tratamiento. Pasa el cursor sobre la cámara para ver fotos y haz clic en una fila para el detalle.</p>
        </div>

        {sinPermiso ? (
          <div className="card-surface">
            <p className="text-sm text-ink-600">No tienes permisos para ver este histórico. Solo administradores y gerentes pueden acceder.</p>
          </div>
        ) : (
          <>
            <div className="card-surface">
              <h2 className="text-xl font-semibold text-brand-900">Filtros</h2>
              <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div className="relative">
                  <label className="block text-sm font-medium text-ink-700">Paciente</label>
                  <input
                    value={pacienteQuery}
                    onChange={(e) => {
                      setPacienteQuery(e.target.value)
                      setFiltros((prev) => ({ ...prev, pacienteId: '' }))
                      setShowPacienteDropdown(true)
                    }}
                    onFocus={() => setShowPacienteDropdown(true)}
                    onBlur={() => setTimeout(() => setShowPacienteDropdown(false), 150)}
                    autoComplete="off"
                    placeholder="Todos"
                    className="field mt-2"
                  />
                  {showPacienteDropdown && pacientesFiltrados.length > 0 && (
                    <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-lg">
                      {pacientesFiltrados.map((paciente) => (
                        <button
                          key={paciente.id}
                          type="button"
                          onMouseDown={() => {
                            setFiltros((prev) => ({ ...prev, pacienteId: paciente.id }))
                            setPacienteQuery(paciente.nombre)
                            setShowPacienteDropdown(false)
                          }}
                          className="block w-full px-4 py-2.5 text-left text-sm hover:bg-brand-50"
                        >
                          {paciente.nombre}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="relative">
                  <label className="block text-sm font-medium text-ink-700">Tratamiento</label>
                  <input
                    value={tratamientoQuery}
                    onChange={(e) => {
                      setTratamientoQuery(e.target.value)
                      setFiltros((prev) => ({ ...prev, tratamientoId: '' }))
                      setShowTratamientoDropdown(true)
                    }}
                    onFocus={() => setShowTratamientoDropdown(true)}
                    onBlur={() => setTimeout(() => setShowTratamientoDropdown(false), 150)}
                    autoComplete="off"
                    placeholder="Todos"
                    className="field mt-2"
                  />
                  {showTratamientoDropdown && tratamientosFiltrados.length > 0 && (
                    <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-lg">
                      {tratamientosFiltrados.map((tratamiento) => (
                        <button
                          key={tratamiento.id}
                          type="button"
                          onMouseDown={() => {
                            setFiltros((prev) => ({ ...prev, tratamientoId: tratamiento.id }))
                            setTratamientoQuery(tratamiento.nombre)
                            setShowTratamientoDropdown(false)
                          }}
                          className="block w-full px-4 py-2.5 text-left text-sm hover:bg-brand-50"
                        >
                          {tratamiento.nombre}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-ink-700">Consultorio</label>
                  <select value={filtros.consultorioId} onChange={(e) => setFiltros((prev) => ({ ...prev, consultorioId: e.target.value }))} className="field mt-2">
                    <option value="">Todas</option>
                    {consultorios.map((consultorio) => <option key={consultorio.id} value={consultorio.id}>{consultorio.nombre}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-ink-700">Odontólogo</label>
                  <select value={filtros.odontologoId} onChange={(e) => setFiltros((prev) => ({ ...prev, odontologoId: e.target.value }))} className="field mt-2">
                    <option value="">Todos</option>
                    {odontologos.map((odontologo) => <option key={odontologo.id} value={odontologo.id}>{odontologo.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-ink-700">Estado</label>
                  <select value={filtros.estado} onChange={(e) => setFiltros((prev) => ({ ...prev, estado: e.target.value }))} className="field mt-2">
                    <option value="">Todos</option>
                    <option value="PENDIENTE">Pendiente</option>
                    <option value="EN_CURSO">En curso</option>
                    <option value="FINALIZADA">Finalizada</option>
                    <option value="CANCELADA">Cancelada</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-ink-700">Filas por página</label>
                  <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))} className="field mt-2">
                    <option value={10}>10</option>
                    <option value={15}>15</option>
                    <option value={30}>30</option>
                    <option value={50}>50</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-ink-700">Desde</label>
                  <input type="date" value={filtros.desde} onChange={(e) => setFiltros((prev) => ({ ...prev, desde: e.target.value }))} className="field mt-2" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-ink-700">Hasta</label>
                  <input type="date" value={filtros.hasta} onChange={(e) => setFiltros((prev) => ({ ...prev, hasta: e.target.value }))} className="field mt-2" />
                </div>
              </div>
              <button type="button" onClick={() => void buscar(1)} className="btn-brand mt-5">Filtrar</button>
            </div>

            <div className="card-surface overflow-x-auto">
              <div className="flex items-center justify-between gap-4">
                <h2 className="text-xl font-semibold text-brand-900">Resultados ({total})</h2>
              </div>
              {loading ? (
                <p className="mt-5 text-sm text-ink-500">Cargando...</p>
              ) : atenciones.length === 0 ? (
                <p className="mt-5 text-sm text-ink-500">No se encontraron atenciones con estos filtros.</p>
              ) : (
                <>
                  <table className="mt-5 w-full min-w-[840px] border-collapse text-left text-sm">
                    <thead>
                      <tr className="border-b border-ink-200 text-ink-500">
                        <th className="py-2 pr-4">Fecha</th>
                        <th className="py-2 pr-4">Paciente</th>
                        <th className="py-2 pr-4">Tratamiento</th>
                        <th className="py-2 pr-4">Costo</th>
                        <th className="py-2 pr-4">Odontólogo</th>
                        <th className="py-2 pr-4">Estado</th>
                        <th className="py-2 pr-4 text-center">Fotos</th>
                      </tr>
                    </thead>
                    <tbody>
                      {atenciones.map((atencion) => (
                        <tr
                          key={atencion.id}
                          onClick={() => setDetalle(atencion)}
                          className="cursor-pointer border-b border-ink-100 transition hover:bg-brand-50/50"
                        >
                          <td className="py-3 pr-4">{new Date(atencion.horaInicio).toLocaleString('es-PE')}</td>
                          <td className="py-3 pr-4 font-medium text-ink-900">{atencion.paciente.nombre}</td>
                          <td className="py-3 pr-4">{atencion.tratamiento.nombre}</td>
                          <td className="py-3 pr-4">
                            S/ {costoAtencion(atencion).toFixed(2)}
                            {precioFueModificado(atencion) && (
                              <span title={`Precio de catálogo: S/ ${atencion.precioCatalogo!.toFixed(2)}`} className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                                Modificado
                              </span>
                            )}
                          </td>
                          <td className="py-3 pr-4">{atencion.odontologo.name}</td>
                          <td className="py-3 pr-4">
                            <span className="rounded-full bg-brand-100 px-3 py-1 text-xs font-semibold text-brand-900">{estadoLabels[atencion.estado]}</span>
                          </td>
                          <td className="py-3 pr-4 text-center"><FotosPreview fotos={atencion.fotos} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div className="mt-5 flex items-center justify-between gap-4">
                    <p className="text-xs text-ink-500">Página {page} de {totalPages}</p>
                    <div className="flex gap-2">
                      <button type="button" disabled={page <= 1} onClick={() => void buscar(page - 1)} className="rounded-xl border border-ink-200 px-4 py-2 text-sm font-semibold text-ink-700 transition hover:bg-ink-50 disabled:opacity-40">Anterior</button>
                      <button type="button" disabled={page >= totalPages} onClick={() => void buscar(page + 1)} className="rounded-xl border border-ink-200 px-4 py-2 text-sm font-semibold text-ink-700 transition hover:bg-ink-50 disabled:opacity-40">Siguiente</button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </div>

      {detalle && <DetalleAtencion atencion={detalle} onClose={() => setDetalle(null)} onFotosCambio={() => void buscar(page)} />}
    </div>
  )
}

export default function HistoricoAtencionesPage() {
  return (
    <Suspense fallback={<div className="page-shell" />}>
      <HistoricoAtencionesContent />
    </Suspense>
  )
}
