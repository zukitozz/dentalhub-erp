'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { PacienteHistorialLink } from '@/components/PacienteHistorialLink'
import { AtencionFotos } from '@/components/AtencionFotos'
import { useToast } from '@/components/Toast'
import { SearchSelect } from '@/components/SearchSelect'

type LineaEstado = 'PENDIENTE' | 'EN_CURSO' | 'FINALIZADA' | 'CANCELADA'

interface Paciente { id: string; nombre: string }
interface Tratamiento { id: string; nombre: string; precio: number; activo: boolean; diasProximoTratamiento?: number | null }
interface Odontologo { id: string; name: string }
interface CitaPendiente { id: string; fecha: string; tratamiento: string; estado: string; registrado: boolean; paciente: Paciente | null }
interface Configuracion { horasExpiracionCita: number }
interface Producto { id: string; nombre: string; precioVenta: number; stock: number }
interface AtencionProductoItem { id: string; cantidad: number; precioUnit: number; precioCatalogo: number | null; producto: { id: string; nombre: string } }

interface LineaTratamiento {
  id: string
  estado: LineaEstado
  horaInicio: string | null
  horaFin: string | null
  diasProximoTratamiento: number | null
  precio: number | null
  precioCatalogo: number | null
  facturaId?: string | null
  pieza?: number | null
  tratamiento: { id: string; nombre: string; diasProximoTratamiento?: number | null }
  odontologo: { id: string; name: string }
}

/** true si el precio acordado difiere del precio de catálogo capturado en ese momento. */
function precioFueModificado(precio: number | null, precioCatalogo: number | null) {
  if (precio == null || precioCatalogo == null) return false
  return Math.abs(precio - precioCatalogo) > 0.005
}

export interface AtencionDetalle {
  id: string
  horaInicio: string
  paciente: { id: string; nombre: string }
  tratamientos: LineaTratamiento[]
}

interface AtencionEnCursoPanelProps {
  atencion: AtencionDetalle | null
  /** Solo aplica al crear una atención nueva reservando el consultorio (flujo legado). */
  consultorioId?: string
  onClose: () => void
  onChanged: () => void
}

const estadoLabels: Record<LineaEstado, string> = {
  PENDIENTE: 'Pendiente',
  EN_CURSO: 'En curso',
  FINALIZADA: 'Finalizada',
  CANCELADA: 'Cancelada',
}

const estadoStyles: Record<LineaEstado, string> = {
  PENDIENTE: 'bg-ink-100 text-ink-700',
  EN_CURSO: 'bg-amber-100 text-amber-900',
  FINALIZADA: 'bg-brand-100 text-brand-900',
  CANCELADA: 'bg-danger-100 text-danger-700',
}

function formatearHora(fecha: string | null) {
  if (!fecha) return '—'
  return new Date(fecha).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })
}

function calcularDuracion(linea: LineaTratamiento) {
  if (!linea.horaInicio) return '—'
  const fin = linea.horaFin ? new Date(linea.horaFin).getTime() : Date.now()
  const minutos = Math.round((fin - new Date(linea.horaInicio).getTime()) / 60000)
  if (minutos < 60) return `${minutos} min`
  return `${Math.floor(minutos / 60)} h ${minutos % 60} min`
}

export function AtencionEnCursoPanel({ atencion, consultorioId, onClose, onChanged }: AtencionEnCursoPanelProps) {
  const router = useRouter()
  const toast = useToast()
  const { data: session } = useSession()
  const rol = session?.user?.role
  const userId = session?.user?.id

  const [pacientes, setPacientes] = useState<Paciente[]>([])
  const [tratamientos, setTratamientos] = useState<Tratamiento[]>([])
  const [odontologos, setOdontologos] = useState<Odontologo[]>([])
  const [citas, setCitas] = useState<CitaPendiente[]>([])
  const [horasExpiracionCita, setHorasExpiracionCita] = useState(24)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // --- Formulario para crear una atención nueva (sin consultorio) ---
  const [modo, setModo] = useState<'walkin' | 'cita'>('walkin')
  const [form, setForm] = useState({ pacienteId: '', tratamientoId: '', odontologoId: '', citaId: '', notas: '', precio: '', pieza: '' })
  const [pacienteQuery, setPacienteQuery] = useState('')
  const [showPacienteDropdown, setShowPacienteDropdown] = useState(false)
  const [tratamientoQuery, setTratamientoQuery] = useState('')
  const [showTratamientoDropdown, setShowTratamientoDropdown] = useState(false)

  // --- Formulario único para agregar un tratamiento o un producto a la visita ---
  const [nuevoItemValue, setNuevoItemValue] = useState('') // 't:<tratamientoId>' | 'p:<productoId>' | ''
  const [nuevoOdontologoId, setNuevoOdontologoId] = useState('')
  const [nuevaPieza, setNuevaPieza] = useState('')
  const [nuevaCantidad, setNuevaCantidad] = useState(1)
  const [nuevoPrecio, setNuevoPrecio] = useState('')
  const [nuevaComision, setNuevaComision] = useState('')
  const [comisionOdontologoId, setComisionOdontologoId] = useState('')
  const [agregandoItem, setAgregandoItem] = useState(false)
  const puedeCambiarPrecio = rol === 'ADMIN' || rol === 'SUPERVISOR'
  const [productos, setProductos] = useState<Producto[]>([])
  const [productosAtencion, setProductosAtencion] = useState<AtencionProductoItem[]>([])

  const [tipoNuevoItem, idNuevoItem] = useMemo(
    () => (nuevoItemValue ? (nuevoItemValue.split(':') as [string, string]) : ['', '']),
    [nuevoItemValue]
  )

  const [diasProximoTratamientoPorLinea, setDiasProximoTratamientoPorLinea] = useState<Record<string, string>>({})

  useEffect(() => {
    if (atencion) return
    Promise.all([
      fetch('/api/pacientes').then((res) => res.json()),
      fetch('/api/tratamientos').then((res) => res.json()),
      fetch('/api/usuarios/odontologos').then((res) => res.json()),
      fetch('/api/citas').then((res) => res.json()),
      fetch('/api/ajustes').then((res) => res.json()),
    ]).then(([pacientesData, tratamientosData, odontologosData, citasData, configuracionData]) => {
      setPacientes(Array.isArray(pacientesData) ? pacientesData : [])
      setTratamientos(Array.isArray(tratamientosData) ? tratamientosData.filter((t: Tratamiento) => t.activo) : [])
      setOdontologos(Array.isArray(odontologosData) ? odontologosData : [])
      const horas = Math.max(1, Number((configuracionData as Configuracion).horasExpiracionCita) || 24)
      setHorasExpiracionCita(horas)
      setCitas(
        Array.isArray(citasData)
          ? citasData.filter((c: CitaPendiente) => Boolean(c.paciente) && !c.registrado && (c.estado === 'PENDIENTE' || c.estado === 'CONFIRMADA') && new Date(c.fecha).getTime() + horas * 60 * 60 * 1000 > Date.now())
          : []
      )
    })
  }, [atencion])

  useEffect(() => {
    if (!atencion) return
    fetch('/api/tratamientos').then((res) => res.json()).then((data) => setTratamientos(Array.isArray(data) ? data.filter((t: Tratamiento) => t.activo) : []))
    fetch('/api/usuarios/odontologos').then((res) => res.json()).then((data) => setOdontologos(Array.isArray(data) ? data : []))
    fetch('/api/productos').then((res) => res.json()).then((data) => setProductos(Array.isArray(data) ? data : []))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [atencion?.id])

  const cargarProductosAtencion = () => {
    if (!atencion) return
    fetch(`/api/atenciones/${atencion.id}/productos`)
      .then((res) => res.json())
      .then((data) => setProductosAtencion(Array.isArray(data) ? data : []))
  }

  useEffect(() => {
    cargarProductosAtencion()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [atencion?.id])

  const seleccionarCita = (citaId: string) => {
    const cita = citas.find((c) => c.id === citaId)
    if (!cita?.paciente) return
    setForm((prev) => ({ ...prev, citaId, pacienteId: cita.paciente!.id }))
    setPacienteQuery(cita.paciente.nombre)
  }

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

  const iniciarAtencion = async () => {
    if (!form.pacienteId || !form.tratamientoId || !form.odontologoId) {
      setError('Selecciona paciente, tratamiento y odontologo')
      return
    }
    setSaving(true)
    setError('')
    const response = await fetch('/api/atenciones', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pacienteId: form.pacienteId,
        tratamientoId: form.tratamientoId,
        odontologoId: form.odontologoId,
        citaId: modo === 'cita' ? form.citaId || null : null,
        notas: form.notas || null,
        consultorioId: consultorioId || null,
        ...(puedeCambiarPrecio && form.precio !== '' ? { precio: Number(form.precio) } : {}),
        ...(form.pieza !== '' ? { pieza: Number(form.pieza) } : {}),
      }),
    })
    setSaving(false)
    if (!response.ok) {
      const data = await response.json()
      setError(data.error || 'No se pudo registrar la atención')
      return
    }
    toast.success('Atención registrada')
    onChanged()
  }

  const puedeGestionar = (linea: LineaTratamiento) => rol !== 'ODONTOLOGO' || linea.odontologo.id === userId

  const cambiarEstadoLinea = async (linea: LineaTratamiento, accion: 'iniciar' | 'finalizar' | 'cancelar') => {
    if (!atencion) return
    setSaving(true)
    setError('')
    const diasProximoTratamiento = diasProximoTratamientoPorLinea[linea.id]
    const response = await fetch(`/api/atenciones/${atencion.id}/tratamientos/${linea.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accion,
        ...(accion === 'finalizar' && diasProximoTratamiento ? { diasProximoTratamiento: Number(diasProximoTratamiento) } : {}),
      }),
    })
    setSaving(false)
    if (!response.ok) {
      const data = await response.json()
      setError(data.error || 'No se pudo actualizar el tratamiento')
      return
    }
    const mensajes = { iniciar: 'Tratamiento iniciado', finalizar: 'Tratamiento finalizado', cancelar: 'Tratamiento cancelado' }
    toast.success(mensajes[accion])
    onChanged()
  }

  const cancelarAtencionCompleta = async () => {
    if (!atencion) return
    setSaving(true)
    setError('')
    const response = await fetch(`/api/atenciones/${atencion.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accion: 'cancelar' }),
    })
    setSaving(false)
    if (!response.ok) {
      const data = await response.json()
      setError(data.error || 'No se pudo cancelar la atención')
      return
    }
    toast.success('Atención cancelada')
    onChanged()
  }

  const agregarItem = async () => {
    if (!atencion || !idNuevoItem) return

    if (tipoNuevoItem === 't') {
      if (!nuevoOdontologoId) {
        setError('Selecciona el odontólogo para el tratamiento')
        return
      }
      setAgregandoItem(true)
      setError('')
      const response = await fetch(`/api/atenciones/${atencion.id}/tratamientos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tratamientoId: idNuevoItem,
          odontologoId: nuevoOdontologoId,
          ...(nuevaComision !== '' ? { comision: Number(nuevaComision) } : {}),
          ...(puedeCambiarPrecio && nuevoPrecio !== '' ? { precio: Number(nuevoPrecio) } : {}),
          ...(nuevaPieza !== '' ? { pieza: Number(nuevaPieza) } : {}),
        }),
      })
      setAgregandoItem(false)
      if (!response.ok) {
        const data = await response.json()
        setError(data.error || 'No se pudo agregar el tratamiento')
        return
      }
      setNuevoItemValue('')
      setNuevoOdontologoId('')
      setNuevoPrecio('')
      setNuevaComision('')
      setNuevaPieza('')
      toast.success('Tratamiento agregado')
      onChanged()
      return
    }

    if (nuevaCantidad <= 0) return
    setAgregandoItem(true)
    setError('')
    const response = await fetch(`/api/atenciones/${atencion.id}/productos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        productoId: idNuevoItem,
        cantidad: nuevaCantidad,
        ...(nuevaComision !== '' ? { comision: Number(nuevaComision), odontologoId: comisionOdontologoId } : {}),
        ...(puedeCambiarPrecio && nuevoPrecio !== '' ? { precioUnit: Number(nuevoPrecio) } : {}),
      }),
    })
    setAgregandoItem(false)
    if (!response.ok) {
      const data = await response.json()
      setError(data.error || 'No se pudo agregar el producto')
      return
    }
    setNuevoItemValue('')
    setNuevaCantidad(1)
    setNuevoPrecio('')
    setNuevaComision('')
    setComisionOdontologoId('')
    cargarProductosAtencion()
    toast.success('Producto agregado')
  }

  if (!atencion) {
    return (
      <div className="space-y-6">
        {error && <p className="rounded-2xl bg-danger-50 px-4 py-3 text-sm text-danger-900">{error}</p>}

        <div className="flex gap-2">
          <button type="button" onClick={() => setModo('walkin')} className={`flex-1 rounded-xl px-4 py-2 text-sm font-semibold transition ${modo === 'walkin' ? 'bg-brand-600 text-white' : 'bg-ink-100 text-ink-600'}`}>Walk-in</button>
          <button type="button" onClick={() => setModo('cita')} className={`flex-1 rounded-xl px-4 py-2 text-sm font-semibold transition ${modo === 'cita' ? 'bg-brand-600 text-white' : 'bg-ink-100 text-ink-600'}`}>Con cita existente</button>
        </div>

        {modo === 'cita' && (
          <div>
            <label className="block text-sm font-medium text-ink-700">Cita agendada</label>
            <select value={form.citaId} onChange={(e) => seleccionarCita(e.target.value)} className="field mt-2">
              <option value="">Selecciona cita</option>
              {citas.map((cita) => (
                <option key={cita.id} value={cita.id}>
                  {new Date(cita.fecha).toLocaleString('es-PE')} · {cita.paciente?.nombre} · {cita.tratamiento}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="relative">
          <label className="block text-sm font-medium text-ink-700">Paciente</label>
          <input
            value={pacienteQuery}
            onChange={(e) => {
              setPacienteQuery(e.target.value)
              setForm((prev) => ({ ...prev, pacienteId: '' }))
              setShowPacienteDropdown(true)
            }}
            onFocus={() => setShowPacienteDropdown(true)}
            onBlur={() => setTimeout(() => setShowPacienteDropdown(false), 150)}
            autoComplete="off"
            placeholder="Busca un paciente por nombre"
            className="field mt-2"
          />
          {showPacienteDropdown && pacientesFiltrados.length > 0 && (
            <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-lg">
              {pacientesFiltrados.map((paciente) => (
                <button
                  key={paciente.id}
                  type="button"
                  onMouseDown={() => {
                    setForm((prev) => ({ ...prev, pacienteId: paciente.id }))
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
              setForm((prev) => ({ ...prev, tratamientoId: '' }))
              setShowTratamientoDropdown(true)
            }}
            onFocus={() => setShowTratamientoDropdown(true)}
            onBlur={() => setTimeout(() => setShowTratamientoDropdown(false), 150)}
            autoComplete="off"
            placeholder="Busca un tratamiento por nombre"
            className="field mt-2"
          />
          {showTratamientoDropdown && tratamientosFiltrados.length > 0 && (
            <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-lg">
              {tratamientosFiltrados.map((tratamiento) => (
                <button
                  key={tratamiento.id}
                  type="button"
                  onMouseDown={() => {
                    setForm((prev) => ({ ...prev, tratamientoId: tratamiento.id, precio: String(tratamiento.precio) }))
                    setTratamientoQuery(tratamiento.nombre)
                    setShowTratamientoDropdown(false)
                  }}
                  className="block w-full px-4 py-2.5 text-left text-sm hover:bg-brand-50"
                >
                  {tratamiento.nombre} · S/ {tratamiento.precio.toFixed(2)}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-ink-700">Odontólogo</label>
            <select value={form.odontologoId} onChange={(e) => setForm((prev) => ({ ...prev, odontologoId: e.target.value }))} className="field mt-2">
              <option value="">Selecciona odontólogo</option>
              {odontologos.map((odontologo) => (
                <option key={odontologo.id} value={odontologo.id}>{odontologo.name}</option>
              ))}
            </select>
          </div>
          {form.tratamientoId && (
            <div>
              <label className="block text-sm font-medium text-ink-700">Pieza dental (opcional)</label>
              <input type="number" min={11} max={85} value={form.pieza} onChange={(e) => setForm((prev) => ({ ...prev, pieza: e.target.value }))} placeholder="Ej. 36" className="field mt-2" />
            </div>
          )}
          {form.tratamientoId && (
            <div>
              <label className="block text-sm font-medium text-ink-700">Precio</label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={form.precio}
                disabled={!puedeCambiarPrecio}
                onChange={(e) => setForm((prev) => ({ ...prev, precio: e.target.value }))}
                title={!puedeCambiarPrecio ? 'Solo un ADMIN o SUPERVISOR puede cambiar el precio de catálogo' : 'Precio acordado con el paciente'}
                className="field mt-2 disabled:bg-ink-100 disabled:text-ink-500"
              />
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-ink-700">Notas (opcional)</label>
          <input value={form.notas} onChange={(e) => setForm((prev) => ({ ...prev, notas: e.target.value }))} className="field mt-2" />
        </div>

        <button type="button" disabled={saving} onClick={() => void iniciarAtencion()} className="btn-brand w-full disabled:opacity-60">
          {saving ? 'Guardando...' : 'Registrar atención'}
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {error && <p className="rounded-2xl bg-danger-50 px-4 py-3 text-sm text-danger-900">{error}</p>}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-ink-50 px-4 py-3">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <PacienteHistorialLink
            pacienteId={atencion.paciente.id}
            nombre={atencion.paciente.nombre}
            className="text-lg font-bold text-ink-800 underline decoration-dotted underline-offset-2 hover:text-brand-700"
          />
          <p className="text-sm text-ink-500">Visita iniciada a las {formatearHora(atencion.horaInicio)}</p>
        </div>
        <PacienteHistorialLink pacienteId={atencion.paciente.id} nombre="Ver historial" className="text-xs font-semibold text-brand-700 underline decoration-dotted underline-offset-2 hover:text-brand-900" />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {atencion.tratamientos.map((linea) => {
          const inactiva = linea.estado === 'CANCELADA' || linea.estado === 'FINALIZADA'
          return (
            <div key={linea.id} className={`rounded-2xl border border-ink-200 p-3 ${inactiva ? 'bg-ink-50/60' : 'bg-white'}`}>
              <div className="flex gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-[11px] uppercase tracking-wide text-ink-400">
                    <span>Inicio <span className="font-semibold normal-case tracking-normal text-ink-600">{formatearHora(linea.horaInicio)}</span></span>
                    <span>Fin <span className="font-semibold normal-case tracking-normal text-ink-600">{formatearHora(linea.horaFin)}</span></span>
                    <span>Duración <span className="font-semibold normal-case tracking-normal text-ink-600">{calcularDuracion(linea)}</span></span>
                  </div>
                  <p className={`mt-1.5 font-semibold leading-snug ${inactiva ? 'text-ink-500' : 'text-ink-800'}`}>{linea.tratamiento.nombre}</p>
                  <p className="mt-0.5 text-xs text-ink-500">{linea.odontologo.name}{linea.pieza ? ` · pieza ${linea.pieza}` : ''}</p>
                  {linea.precio != null && (
                    <p className="mt-1 flex items-center gap-2 text-xs text-ink-500">
                      <span>S/ {linea.precio.toFixed(2)}</span>
                      {precioFueModificado(linea.precio, linea.precioCatalogo) && (
                        <span
                          title={`Precio de catálogo: S/ ${linea.precioCatalogo!.toFixed(2)}`}
                          className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800"
                        >Precio modificado</span>
                      )}
                    </p>
                  )}
                </div>

                <div className="flex w-28 shrink-0 flex-col gap-1.5">
                  <span className={`rounded-full px-3 py-1 text-center text-xs font-semibold ${estadoStyles[linea.estado]}`}>{estadoLabels[linea.estado]}</span>
                  {puedeGestionar(linea) && linea.estado === 'PENDIENTE' && (
                    <button type="button" disabled={saving} onClick={() => void cambiarEstadoLinea(linea, 'iniciar')} className="rounded-full bg-brand-600 px-3 py-1 text-xs font-semibold text-white transition hover:brightness-110 disabled:opacity-60">Iniciar</button>
                  )}
                  {puedeGestionar(linea) && linea.estado === 'EN_CURSO' && (
                    <button type="button" disabled={saving} onClick={() => void cambiarEstadoLinea(linea, 'finalizar')} className="rounded-full bg-brand-600 px-3 py-1 text-xs font-semibold text-white transition hover:brightness-110 disabled:opacity-60">Finalizar</button>
                  )}
                  {puedeGestionar(linea) && (linea.estado === 'PENDIENTE' || linea.estado === 'EN_CURSO') && (
                    <button type="button" disabled={saving} onClick={() => void cambiarEstadoLinea(linea, 'cancelar')} className="rounded-full border border-danger-200 px-3 py-1 text-xs font-semibold text-danger-700 transition hover:bg-danger-50 disabled:opacity-60">Cancelar</button>
                  )}
                </div>
              </div>

              {linea.estado === 'FINALIZADA' && (
                <p className="mt-2 border-t border-ink-100 pt-2 text-xs text-ink-500">
                  Próximo tratamiento sugerido: {linea.diasProximoTratamiento ? `${linea.diasProximoTratamiento} días` : 'sin valor'}
                </p>
              )}

              {puedeGestionar(linea) && linea.estado === 'EN_CURSO' && (
                <div className="mt-2 flex items-center gap-2 border-t border-ink-100 pt-2">
                  <label className="whitespace-nowrap text-xs font-medium text-ink-700">Próx. tratamiento en (días)</label>
                  <input
                    type="number"
                    min={1}
                    value={diasProximoTratamientoPorLinea[linea.id] ?? (linea.tratamiento.diasProximoTratamiento ? String(linea.tratamiento.diasProximoTratamiento) : '')}
                    onChange={(e) => setDiasProximoTratamientoPorLinea((prev) => ({ ...prev, [linea.id]: e.target.value }))}
                    placeholder="Sin valor"
                    className="field !mt-0 w-20 !py-1 text-sm"
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>

      {(rol === 'ADMIN' || rol === 'SUPERVISOR' || rol === 'ODONTOLOGO') && (
        <div className="rounded-2xl border border-ink-200 p-3">
          <p className="text-sm font-semibold text-ink-700">Agregar tratamiento o producto</p>
          <div className="mt-2 flex flex-wrap items-end gap-2">
            <div className="min-w-[14rem] flex-[2]">
              <label className="block text-xs font-medium text-ink-700">Item</label>
              <SearchSelect
                value={nuevoItemValue}
                placeholder="Selecciona..."
                options={[
                  ...tratamientos.map((tratamiento) => ({ value: `t:${tratamiento.id}`, label: `${tratamiento.nombre} · S/ ${tratamiento.precio.toFixed(2)}`, group: 'Tratamientos' })),
                  ...productos.map((producto) => ({ value: `p:${producto.id}`, label: `${producto.nombre} · S/ ${producto.precioVenta.toFixed(2)} · stock ${producto.stock}`, group: 'Productos' })),
                ]}
                onChange={(value) => {
                  setNuevoItemValue(value)
                  setNuevoOdontologoId('')
                  setNuevaComision('')
                  setComisionOdontologoId('')
                  setNuevaCantidad(1)
                  const [tipo, id] = value ? (value.split(':') as [string, string]) : ['', '']
                  const precioCatalogo = tipo === 't'
                    ? tratamientos.find((t) => t.id === id)?.precio
                    : tipo === 'p'
                      ? productos.find((p) => p.id === id)?.precioVenta
                      : undefined
                  setNuevoPrecio(precioCatalogo != null ? String(precioCatalogo) : '')
                }}
                className="field !mt-1"
              />
            </div>
            {tipoNuevoItem === 't' && (
              <div className="min-w-[10rem] flex-1">
                <label className="block text-xs font-medium text-ink-700">Odontólogo</label>
                <select value={nuevoOdontologoId} onChange={(e) => setNuevoOdontologoId(e.target.value)} className="field !mt-1">
                  <option value="">Selecciona</option>
                  {odontologos.map((odontologo) => (
                    <option key={odontologo.id} value={odontologo.id}>{odontologo.name}</option>
                  ))}
                </select>
              </div>
            )}
            {tipoNuevoItem === 't' && (
              <div className="w-24">
                <label className="block text-xs font-medium text-ink-700">Pieza</label>
                <input type="number" min={11} max={85} value={nuevaPieza} onChange={(e) => setNuevaPieza(e.target.value)} placeholder="Ej. 36" className="field !mt-1" />
              </div>
            )}
            {tipoNuevoItem === 'p' && (
              <div className="w-20">
                <label className="block text-xs font-medium text-ink-700">Cant.</label>
                <input type="number" min={1} value={nuevaCantidad} onChange={(e) => setNuevaCantidad(Number(e.target.value) || 1)} className="field !mt-1" />
              </div>
            )}
            {idNuevoItem && (
              <div className="w-28">
                <label className="block text-xs font-medium text-ink-700">Precio</label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={nuevoPrecio}
                  disabled={!puedeCambiarPrecio}
                  onChange={(e) => setNuevoPrecio(e.target.value)}
                  title={!puedeCambiarPrecio ? 'Solo un ADMIN o SUPERVISOR puede cambiar el precio de catálogo' : 'Precio acordado con el paciente'}
                  className="field !mt-1 disabled:bg-ink-100 disabled:text-ink-500"
                />
              </div>
            )}
            {idNuevoItem && (
              <div className="w-28">
                <label className="block text-xs font-medium text-ink-700">Comisión S/</label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={nuevaComision}
                  onChange={(e) => setNuevaComision(e.target.value)}
                  placeholder="0.00"
                  title="Opcional: se paga a el odontólogo al momento y se registra como gasto en el cierre"
                  className="field !mt-1"
                />
              </div>
            )}
            {tipoNuevoItem === 'p' && nuevaComision !== '' && Number(nuevaComision) > 0 && (
              <div className="min-w-[10rem] flex-1">
                <label className="block text-xs font-medium text-ink-700">Comisiona a</label>
                <select value={comisionOdontologoId} onChange={(e) => setComisionOdontologoId(e.target.value)} className="field !mt-1">
                  <option value="">Selecciona</option>
                  {odontologos.map((odontologo) => (
                    <option key={odontologo.id} value={odontologo.id}>{odontologo.name}</option>
                  ))}
                </select>
              </div>
            )}
            <button
              type="button"
              disabled={agregandoItem || !idNuevoItem || (tipoNuevoItem === 't' && !nuevoOdontologoId) || (tipoNuevoItem === 'p' && Number(nuevaComision) > 0 && !comisionOdontologoId)}
              onClick={() => void agregarItem()}
              className="rounded-xl border border-ink-200 px-4 py-2 text-sm font-semibold text-ink-700 transition hover:bg-ink-50 disabled:opacity-60"
            >
              {agregandoItem ? 'Agregando...' : 'Agregar'}
            </button>
          </div>
        </div>
      )}

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <AtencionFotos atencionId={atencion.id} />

        <div className="rounded-3xl border border-ink-200 p-4">
          <p className="text-sm font-semibold text-ink-700">Productos agregados</p>
          <div className="mt-2 space-y-1.5">
            {productosAtencion.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-3 text-sm text-ink-600">
                <span className="min-w-0 truncate">
                  {item.producto.nombre} × {item.cantidad}
                  {precioFueModificado(item.precioUnit, item.precioCatalogo) && (
                    <span
                      title={`Precio de catálogo: S/ ${item.precioCatalogo!.toFixed(2)}`}
                      className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800"
                    >Precio modificado</span>
                  )}
                </span>
                <span className="shrink-0">S/ {(item.cantidad * item.precioUnit).toFixed(2)}</span>
              </div>
            ))}
            {productosAtencion.length === 0 && <p className="text-sm text-ink-500">Aún no se agregaron productos.</p>}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 border-t border-ink-100 pt-4">
        <button type="button" onClick={() => router.push(`/facturacion?pacienteId=${atencion.paciente.id}`)} className="btn-brand flex-1">Ir a facturación</button>
        {(rol === 'ADMIN' || rol === 'SUPERVISOR') && (
          <button type="button" disabled={saving} onClick={() => void cancelarAtencionCompleta()} className="flex-1 rounded-xl border border-danger-200 px-5 py-2.5 text-sm font-semibold text-danger-700 transition hover:bg-danger-50 disabled:opacity-60">Cancelar visita</button>
        )}
      </div>
    </div>
  )
}
