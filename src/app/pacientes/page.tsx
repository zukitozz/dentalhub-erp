'use client'

import { SearchSelect } from '@/components/SearchSelect'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Spinner } from '@/components/Spinner'
import { Pagination } from '@/components/Pagination'
import { useToast } from '@/components/Toast'

interface Paciente {
  id: string
  nombre: string
  dni: string | null
  ruc: string | null
  carnetExtranjeria: string | null
  razonSocial: string | null
  referidoPorId?: string | null
  celular: string | null
  distrito: string | null
  email: string | null
  fechaNacimiento: string | null
  direccion: string | null
  sexo: string | null
  ocupacion: string | null
  apoderado: string | null
  contactoEmergencia: string | null
  alergias: string | null
  notas: string | null
}

const PAGE_SIZE = 10

const emptyForm = {
  nombre: '', dni: '', ruc: '', carnetExtranjeria: '', razonSocial: '', celular: '', distrito: '',
  email: '', fechaNacimiento: '', direccion: '', sexo: '', ocupacion: '', apoderado: '', contactoEmergencia: '', alergias: '', notas: '', referidoPorId: '',
}

function documentLabel(paciente: Paciente) {
  if (paciente.dni) return `DNI ${paciente.dni}`
  if (paciente.ruc) return `RUC ${paciente.ruc}`
  if (paciente.carnetExtranjeria) return `CE ${paciente.carnetExtranjeria}`
  return 'Sin documento'
}

export default function PacientesPage() {
  const toast = useToast()
  const [pacientes, setPacientes] = useState<Paciente[]>([])
  const [cargando, setCargando] = useState(true)
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [filtro, setFiltro] = useState<'todos' | 'ruc'>('todos')
  const [busqueda, setBusqueda] = useState('')
  const [pagina, setPagina] = useState(1)
  const [mostrarFormulario, setMostrarFormulario] = useState(false)

  useEffect(() => {
    fetch('/api/pacientes')
      .then((res) => res.json())
      .then((data) => setPacientes(Array.isArray(data) ? data : []))
      .finally(() => setCargando(false))
  }, [])

  const pacientesFiltrados = useMemo(() => {
    const base = filtro === 'ruc' ? pacientes.filter((paciente) => paciente.ruc) : pacientes
    const query = busqueda.trim().toLowerCase()
    if (!query) return base
    return base.filter((paciente) =>
      paciente.nombre.toLowerCase().includes(query) ||
      (paciente.dni || '').includes(query) ||
      (paciente.ruc || '').includes(query) ||
      (paciente.carnetExtranjeria || '').includes(query),
    )
  }, [pacientes, filtro, busqueda])

  const totalPages = Math.max(1, Math.ceil(pacientesFiltrados.length / PAGE_SIZE))
  const paginaActual = Math.min(pagina, totalPages)
  const pacientesPagina = pacientesFiltrados.slice((paginaActual - 1) * PAGE_SIZE, paginaActual * PAGE_SIZE)

  useEffect(() => { setPagina(1) }, [busqueda, filtro])

  const abrirNuevo = () => {
    setEditingId(null)
    setForm(emptyForm)
    setMostrarFormulario(true)
  }

  const abrirEdicion = (paciente: Paciente) => {
    setEditingId(paciente.id)
    setForm({
      nombre: paciente.nombre,
      dni: paciente.dni || '',
      ruc: paciente.ruc || '',
      carnetExtranjeria: paciente.carnetExtranjeria || '',
      razonSocial: paciente.razonSocial || '',
      celular: paciente.celular || '',
      distrito: paciente.distrito || '',
      email: paciente.email || '',
      fechaNacimiento: paciente.fechaNacimiento ? paciente.fechaNacimiento.slice(0, 10) : '',
      direccion: paciente.direccion || '',
      sexo: paciente.sexo || '',
      ocupacion: paciente.ocupacion || '',
      apoderado: paciente.apoderado || '',
      contactoEmergencia: paciente.contactoEmergencia || '',
      alergias: paciente.alergias || '',
      notas: paciente.notas || '',
      referidoPorId: paciente.referidoPorId || '',
    })
    setMostrarFormulario(true)
  }

  const handleGuardar = async () => {
    const dni = form.dni.trim()
    const dniDuplicado = dni && pacientes.some((paciente) => paciente.dni?.trim() === dni && paciente.id !== editingId)

    if (dniDuplicado) {
      toast.error('El DNI ya está registrado en otro paciente')
      return
    }

    setLoading(true)

    const response = await fetch('/api/pacientes', {
      method: editingId ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        id: editingId || undefined,
        fechaNacimiento: form.fechaNacimiento || undefined,
      }),
    })

    const result = await response.json()
    setLoading(false)
    if (!response.ok) {
      toast.error(result.error || 'No se pudo guardar el paciente')
      return
    }

    setPacientes((prev) => (editingId ? prev.map((item) => (item.id === editingId ? result : item)) : [result, ...prev]))
    setMostrarFormulario(false)
    toast.success(editingId ? 'Paciente actualizado' : 'Paciente creado')
  }

  const handleEliminar = async (id: string) => {
    const response = await fetch(`/api/pacientes?id=${id}`, { method: 'DELETE' })
    if (!response.ok) {
      const data = await response.json().catch(() => null)
      toast.error(data?.error || 'No se pudo eliminar el paciente')
      return
    }
    setPacientes((prev) => prev.filter((item) => item.id !== id))
    toast.success('Paciente eliminado')
  }

  return (
    <div className="page-shell px-4 py-8 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="card-surface">
          <p className="eyebrow">Pacientes</p>
          <h1 className="page-heading mt-3 text-3xl">Pacientes y expedientes</h1>
          <p className="mt-2 text-ink-600">Registra pacientes y abre su expediente clínico completo.</p>
        </div>

        <div className="card-surface">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h2 className="text-xl font-bold text-ink-800">Pacientes registrados</h2>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setFiltro('todos')}
                  className={`rounded-full px-3.5 py-1.5 text-xs font-extrabold transition ${filtro === 'todos' ? 'bg-ink-800 text-white' : 'bg-ink-50 text-ink-600'}`}
                >Todos</button>
                <button
                  type="button"
                  onClick={() => setFiltro('ruc')}
                  className={`rounded-full px-3.5 py-1.5 text-xs font-extrabold transition ${filtro === 'ruc' ? 'bg-ink-800 text-white' : 'bg-ink-50 text-ink-600'}`}
                >Con RUC</button>
              </div>
              <button type="button" onClick={abrirNuevo} className="rounded-full bg-brand-700 px-5 py-2 text-sm font-bold text-white transition hover:brightness-110">+ Nuevo paciente</button>
            </div>
          </div>

          <input
            value={busqueda}
            onChange={(event) => setBusqueda(event.target.value)}
            placeholder="Buscar por nombre, DNI o RUC..."
            className="field mt-4"
          />

          <div className="mt-6">
            {cargando ? (
              <p className="flex items-center gap-2 text-sm text-ink-500"><Spinner /> Cargando pacientes...</p>
            ) : pacientesPagina.length === 0 ? (
              <p className="text-sm text-ink-500">No se encontraron pacientes.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead>
                    <tr className="text-xs font-semibold uppercase tracking-wide text-ink-500">
                      <th className="pb-3 pr-4">Nombre</th>
                      <th className="pb-3 pr-4">Documento</th>
                      <th className="pb-3 pr-4">Celular</th>
                      <th className="pb-3 pr-4">Distrito</th>
                      <th className="pb-3">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pacientesPagina.map((paciente) => (
                      <tr key={paciente.id} className="border-t border-ink-50">
                        <td className="py-3 pr-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-extrabold text-brand-600">
                              {paciente.nombre.split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <Link href={`/pacientes/${paciente.id}`} className="block truncate font-semibold text-ink-800 hover:text-brand-700">{paciente.nombre}</Link>
                              {paciente.ruc && <span className="rounded-full bg-ink-100 px-2 py-0.5 text-[10px] font-extrabold text-ink-400">Factura</span>}
                            </div>
                          </div>
                        </td>
                        <td className="py-3 pr-4 text-ink-600">{documentLabel(paciente)}</td>
                        <td className="py-3 pr-4 text-ink-600">{paciente.celular || '—'}</td>
                        <td className="py-3 pr-4 text-ink-600">{paciente.distrito || '—'}</td>
                        <td className="py-3">
                          <div className="flex flex-wrap items-center gap-3">
                            <Link href={`/pacientes/${paciente.id}`} className="text-sm font-semibold text-brand-600">Expediente</Link>
                            <button type="button" onClick={() => abrirEdicion(paciente)} className="text-sm font-semibold text-brand-700">Editar</button>
                            <button type="button" onClick={() => void handleEliminar(paciente.id)} className="text-sm font-semibold text-danger-600">Eliminar</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <Pagination page={paginaActual} totalPages={totalPages} onChange={setPagina} />
        </div>
      </div>

      {mostrarFormulario && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 px-4 py-8"
        >
          <div className="card-surface w-full max-w-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-xl font-bold text-ink-800">{editingId ? 'Editar paciente' : 'Nuevo paciente'}</h2>
              <button
                type="button"
                onClick={() => setMostrarFormulario(false)}
                className="rounded-full p-2 text-ink-500 transition hover:bg-ink-100"
                aria-label="Cerrar"
              >✕</button>
            </div>

            <div className="mt-6 space-y-4">
              <div>
                <label htmlFor="paciente-nombre" className="block text-sm font-medium text-ink-700">Nombre</label>
                <input id="paciente-nombre" value={form.nombre} onChange={(event) => setForm((prev) => ({ ...prev, nombre: event.target.value }))} className="field mt-2" />
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label htmlFor="paciente-dni" className="block text-sm font-medium text-ink-700">DNI</label>
                  <input id="paciente-dni" value={form.dni} onChange={(event) => setForm((prev) => ({ ...prev, dni: event.target.value }))} className="field mt-2" placeholder="Para boleta" />
                </div>
                <div>
                  <label htmlFor="paciente-carnet-extranjeria" className="block text-sm font-medium text-ink-700">Carnet de extranjería</label>
                  <input id="paciente-carnet-extranjeria" value={form.carnetExtranjeria} onChange={(event) => setForm((prev) => ({ ...prev, carnetExtranjeria: event.target.value }))} className="field mt-2" placeholder="Para boleta" />
                </div>
                <div>
                  <label htmlFor="paciente-ruc" className="block text-sm font-medium text-ink-700">RUC</label>
                  <input id="paciente-ruc" value={form.ruc} onChange={(event) => setForm((prev) => ({ ...prev, ruc: event.target.value }))} className="field mt-2" placeholder="Para factura" />
                </div>
              </div>

              <div>
                <label htmlFor="paciente-razon-social" className="block text-sm font-medium text-ink-700">Razón social</label>
                <input id="paciente-razon-social" value={form.razonSocial} onChange={(event) => setForm((prev) => ({ ...prev, razonSocial: event.target.value }))} className="field mt-2" placeholder="Requerido para emitir factura" />
              </div>

              <div>
                <label htmlFor="paciente-referido" className="block text-sm font-medium text-ink-700">Recomendado por (opcional)</label>
                <SearchSelect
                  id="paciente-referido"
                  ariaLabel="Recomendado por"
                  value={form.referidoPorId}
                  onChange={(value) => setForm((prev) => ({ ...prev, referidoPorId: value }))}
                  placeholder="Busca al paciente que lo recomendó"
                  options={[{ value: '', label: 'Nadie / no aplica' }, ...pacientes.filter((p) => p.id !== editingId).map((p) => ({ value: p.id, label: `${p.nombre}${p.dni ? ` · ${p.dni}` : ''}` }))]}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="paciente-celular" className="block text-sm font-medium text-ink-700">Celular</label>
                  <input id="paciente-celular" value={form.celular} onChange={(event) => setForm((prev) => ({ ...prev, celular: event.target.value }))} className="field mt-2" />
                </div>
                <div>
                  <label htmlFor="paciente-distrito" className="block text-sm font-medium text-ink-700">Distrito</label>
                  <input id="paciente-distrito" value={form.distrito} onChange={(event) => setForm((prev) => ({ ...prev, distrito: event.target.value }))} className="field mt-2" />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="paciente-email" className="block text-sm font-medium text-ink-700">Email</label>
                  <input id="paciente-email" value={form.email} onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))} className="field mt-2" />
                </div>
                <div>
                  <label htmlFor="paciente-fecha-nacimiento" className="block text-sm font-medium text-ink-700">Fecha de nacimiento</label>
                  <input id="paciente-fecha-nacimiento" type="date" value={form.fechaNacimiento} onChange={(event) => setForm((prev) => ({ ...prev, fechaNacimiento: event.target.value }))} className="field mt-2" />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label htmlFor="paciente-sexo" className="block text-sm font-medium text-ink-700">Sexo</label>
                  <select id="paciente-sexo" value={form.sexo} onChange={(event) => setForm((prev) => ({ ...prev, sexo: event.target.value }))} className="field mt-2">
                    <option value="">—</option>
                    <option value="F">Femenino</option>
                    <option value="M">Masculino</option>
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="paciente-direccion" className="block text-sm font-medium text-ink-700">Dirección</label>
                  <input id="paciente-direccion" value={form.direccion} onChange={(event) => setForm((prev) => ({ ...prev, direccion: event.target.value }))} className="field mt-2" />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label htmlFor="paciente-ocupacion" className="block text-sm font-medium text-ink-700">Ocupación</label>
                  <input id="paciente-ocupacion" value={form.ocupacion} onChange={(event) => setForm((prev) => ({ ...prev, ocupacion: event.target.value }))} className="field mt-2" />
                </div>
                <div>
                  <label htmlFor="paciente-apoderado" className="block text-sm font-medium text-ink-700">Apoderado (menores)</label>
                  <input id="paciente-apoderado" value={form.apoderado} onChange={(event) => setForm((prev) => ({ ...prev, apoderado: event.target.value }))} className="field mt-2" />
                </div>
                <div>
                  <label htmlFor="paciente-emergencia" className="block text-sm font-medium text-ink-700">Contacto de emergencia</label>
                  <input id="paciente-emergencia" value={form.contactoEmergencia} onChange={(event) => setForm((prev) => ({ ...prev, contactoEmergencia: event.target.value }))} className="field mt-2" placeholder="Nombre y celular" />
                </div>
              </div>

              <div>
                <label htmlFor="paciente-alergias" className="block text-sm font-medium text-ink-700">Alergias</label>
                <input id="paciente-alergias" value={form.alergias} onChange={(event) => setForm((prev) => ({ ...prev, alergias: event.target.value }))} className="field mt-2" placeholder="Penicilina, látex, anestesia…" />
              </div>

              <div>
                <label htmlFor="paciente-notas" className="block text-sm font-medium text-ink-700">Notas</label>
                <input id="paciente-notas" value={form.notas} onChange={(event) => setForm((prev) => ({ ...prev, notas: event.target.value }))} className="field mt-2" />
              </div>

              <button
                type="button"
                disabled={loading || !form.nombre}
                onClick={() => void handleGuardar()}
                className="btn-brand flex w-full items-center justify-center gap-2 disabled:opacity-60"
              >
                {loading && <Spinner />}
                {loading ? 'Guardando...' : editingId ? 'Actualizar paciente' : 'Crear paciente'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
