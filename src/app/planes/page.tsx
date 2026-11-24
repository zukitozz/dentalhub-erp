'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { PacienteHistorialLink } from '@/components/PacienteHistorialLink'
import { Spinner } from '@/components/Spinner'
import { Pagination } from '@/components/Pagination'
import { useToast } from '@/components/Toast'
import { useConfirm } from '@/components/ConfirmDialog'
import { SearchSelect } from '@/components/SearchSelect'

const PAGE_SIZE = 10

const NOMBRE_METODO_PAGO: Record<string, string> = {
  EFECTIVO: 'Efectivo',
  TARJETA: 'POS',
  YAPE: 'Yape',
  PLIN: 'Plin',
  TRANSFERENCIA: 'Transferencia',
  DEPOSITO: 'Depósito en cuenta',
  MIXTO: 'Mixto',
}

const METODOS_PAGO_ABONO = ['EFECTIVO', 'TARJETA', 'YAPE', 'PLIN', 'TRANSFERENCIA', 'DEPOSITO'] as const

interface Paciente {
  id: string
  nombre: string
}

interface Tratamiento {
  id: string
  nombre: string
  precio: number
  activo: boolean
}

interface LineaNuevoPlan {
  tratamientoId: string
  descripcion: string
  pieza: string
  cantidad: number
  precioUnit: number
}

const LINEA_VACIA: LineaNuevoPlan = { tratamientoId: '', descripcion: '', pieza: '', cantidad: 1, precioUnit: 0 }

interface Abono {
  id: string
  numeracionComprobante: string | null
  total: number
  metodoPago: string
  fechaHora: string | null
  activo: boolean
}

interface Sesion {
  id: string
  numero: number
  fecha: string
  notas: string | null
}

interface Plan {
  id: string
  nombre: string
  sesionesTotal: number
  precioTotal: number
  estado: 'ABIERTO' | 'CERRADO'
  pagado: number
  saldo: number
  paciente: Paciente
  tratamiento: Tratamiento | null
  facturas: Abono[]
  sesiones: Sesion[]
}

function hoyISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function PlanesContent() {
  const { data: session } = useSession()
  const searchParams = useSearchParams()
  const toast = useToast()
  const confirmar = useConfirm()
  const puedeEmitirComprobante = session?.user?.role === 'ADMIN' || session?.user?.role === 'SUPERVISOR'

  const [planes, setPlanes] = useState<Plan[]>([])
  const [pacientes, setPacientes] = useState<Paciente[]>([])
  const [tratamientos, setTratamientos] = useState<Tratamiento[]>([])
  const [loading, setLoading] = useState(true)
  const [pagina, setPagina] = useState(1)

  const [mostrarFormulario, setMostrarFormulario] = useState(false)
  const [creando, setCreando] = useState(false)
  const [nuevoPlan, setNuevoPlan] = useState({ pacienteNombre: '', tratamientoId: '', nombre: '', sesionesTotal: '10', precioTotal: '' })
  const [lineas, setLineas] = useState<LineaNuevoPlan[]>([{ ...LINEA_VACIA }])
  const lineasValidas = lineas.filter((l) => l.descripcion.trim())
  const totalLineas = lineasValidas.reduce((acc, l) => acc + l.cantidad * l.precioUnit, 0)

  const [planAbiertoId, setPlanAbiertoId] = useState<string | null>(null)
  const [abonoForm, setAbonoForm] = useState({ monto: '', metodoPago: 'EFECTIVO' })
  const [notasSeleccionadas, setNotasSeleccionadas] = useState<Set<string>>(new Set())
  const [tipoComprobante, setTipoComprobante] = useState<'BOLETA' | 'FACTURA'>('BOLETA')
  const [enviando, setEnviando] = useState(false)
  const [sesionForm, setSesionForm] = useState({ fecha: hoyISO(), notas: '' })
  const [registrandoSesion, setRegistrandoSesion] = useState(false)
  const [eliminandoSesionId, setEliminandoSesionId] = useState<string | null>(null)

  const loadData = async () => {
    const [planesRes, pacientesRes, tratamientosRes] = await Promise.all([
      fetch('/api/planes'),
      fetch('/api/pacientes'),
      fetch('/api/tratamientos'),
    ])
    const [planesData, pacientesData, tratamientosData] = await Promise.all([
      planesRes.json(),
      pacientesRes.json(),
      tratamientosRes.json(),
    ])
    setPlanes(Array.isArray(planesData) ? planesData : [])
    setPacientes(Array.isArray(pacientesData) ? pacientesData : [])
    setTratamientos(Array.isArray(tratamientosData) ? tratamientosData.filter((t: Tratamiento) => t.activo) : [])
    setLoading(false)
  }

  useEffect(() => {
    void loadData()
  }, [])

  // Desde el expediente: /planes?pacienteId=…&nuevo=1 abre el formulario con el paciente elegido.
  const pacienteQuery = searchParams.get('pacienteId')
  const abrirNuevoDesdeQuery = searchParams.get('nuevo') === '1'
  useEffect(() => {
    if (!abrirNuevoDesdeQuery || pacientes.length === 0) return
    const p = pacientes.find((x) => x.id === pacienteQuery)
    if (p) setNuevoPlan((prev) => ({ ...prev, pacienteNombre: p.nombre }))
    setMostrarFormulario(true)
  }, [abrirNuevoDesdeQuery, pacienteQuery, pacientes])

  const totalPaginas = Math.max(1, Math.ceil(planes.length / PAGE_SIZE))
  const paginaActual = Math.min(pagina, totalPaginas)
  const planesPagina = planes.slice((paginaActual - 1) * PAGE_SIZE, paginaActual * PAGE_SIZE)

  const planAbierto = useMemo(() => planes.find((p) => p.id === planAbiertoId) || null, [planes, planAbiertoId])

  const totalNotasSeleccionadas = useMemo(() => {
    if (!planAbierto) return 0
    return planAbierto.facturas.filter((factura) => notasSeleccionadas.has(factura.id)).reduce((sum, factura) => sum + factura.total, 0)
  }, [planAbierto, notasSeleccionadas])

  const abrirDetalle = (plan: Plan) => {
    setPlanAbiertoId(plan.id)
    setAbonoForm({ monto: plan.saldo.toFixed(2), metodoPago: 'EFECTIVO' })
    setNotasSeleccionadas(new Set(plan.facturas.map((factura) => factura.id)))
    setTipoComprobante('BOLETA')
    setSesionForm({ fecha: hoyISO(), notas: '' })
  }

  const cerrarDetalle = () => {
    setPlanAbiertoId(null)
  }

  const handleCrearPlan = async () => {
    const paciente = pacientes.find((c) => c.nombre.toLowerCase() === nuevoPlan.pacienteNombre.trim().toLowerCase())
    if (!paciente) {
      toast.error('Selecciona un paciente válido de la lista')
      return
    }
    if (!nuevoPlan.nombre.trim()) {
      toast.error('Ingresa un nombre para el plan')
      return
    }
    const sesionesTotal = lineasValidas.length > 0 ? lineasValidas.reduce((acc, l) => acc + l.cantidad, 0) : Number(nuevoPlan.sesionesTotal)
    const precioTotal = lineasValidas.length > 0 ? Math.round(totalLineas * 100) / 100 : Number(nuevoPlan.precioTotal)
    if (!Number.isInteger(sesionesTotal) || sesionesTotal <= 0) {
      toast.error('El número de sesiones debe ser un entero mayor a 0')
      return
    }
    if (!Number.isFinite(precioTotal) || precioTotal <= 0) {
      toast.error('El precio total debe ser mayor a 0')
      return
    }

    const aceptado = await confirmar({
      title: 'Crear plan',
      mensaje: 'Se creará el plan con el precio total indicado.',
      detalle: [
        `Paciente: ${paciente.nombre}`,
        `Plan: ${nuevoPlan.nombre.trim()} (${sesionesTotal} ${lineasValidas.length > 0 ? 'tratamientos' : 'sesiones'})`,
        `Precio total: S/ ${precioTotal.toFixed(2)}`,
      ],
      textoConfirmar: 'Crear plan',
    })
    if (!aceptado) return

    setCreando(true)
    const response = await fetch('/api/planes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pacienteId: paciente.id,
        tratamientoId: nuevoPlan.tratamientoId || undefined,
        nombre: nuevoPlan.nombre.trim(),
        sesionesTotal,
        precioTotal,
        items: lineasValidas.map((l) => ({ descripcion: l.descripcion, pieza: l.pieza, cantidad: l.cantidad, precioUnit: l.precioUnit, tratamientoId: l.tratamientoId || undefined })),
      }),
    })
    const data = await response.json().catch(() => null)
    setCreando(false)

    if (!response.ok) {
      toast.error(data?.error || 'No se pudo crear el plan')
      return
    }

    toast.success('Plan creado correctamente')
    setMostrarFormulario(false)
    setNuevoPlan({ pacienteNombre: '', tratamientoId: '', nombre: '', sesionesTotal: '10', precioTotal: '' })
    setLineas([{ ...LINEA_VACIA }])
    await loadData()
  }

  const handleRegistrarAbono = async (planId: string) => {
    const monto = Number(abonoForm.monto)
    if (!Number.isFinite(monto) || monto <= 0) {
      toast.error('Ingresa un monto válido')
      return
    }

    const plan = planes.find((p) => p.id === planId)
    const aceptado = await confirmar({
      title: 'Registrar abono',
      mensaje: 'Se registrará el cobro y quedará pendiente del próximo cierre de turno.',
      detalle: [
        `Paciente: ${plan?.paciente.nombre ?? '—'}`,
        `Plan: ${plan?.nombre ?? '—'}`,
        `Abono: S/ ${monto.toFixed(2)} (${abonoForm.metodoPago})`,
      ],
      textoConfirmar: 'Registrar abono',
    })
    if (!aceptado) return

    setEnviando(true)
    const response = await fetch(`/api/planes/${planId}/abonos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ monto, metodoPago: abonoForm.metodoPago }),
    })
    const data = await response.json().catch(() => null)
    setEnviando(false)

    if (!response.ok) {
      toast.error(data?.error || 'No se pudo registrar el abono')
      return
    }

    toast.success('Abono registrado correctamente')
    setAbonoForm({ monto: '', metodoPago: 'EFECTIVO' })
    await loadData()
  }

  const handleRegistrarSesion = async (planId: string) => {
    setRegistrandoSesion(true)
    const response = await fetch(`/api/planes/${planId}/sesiones`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fecha: sesionForm.fecha, notas: sesionForm.notas || undefined }),
    })
    const data = await response.json().catch(() => null)
    setRegistrandoSesion(false)

    if (!response.ok) {
      toast.error(data?.error || 'No se pudo registrar la sesión')
      return
    }

    toast.success('Sesión registrada correctamente')
    setSesionForm({ fecha: hoyISO(), notas: '' })
    await loadData()
  }

  const handleEliminarSesion = async (planId: string, sesionId: string) => {
    setEliminandoSesionId(sesionId)
    const response = await fetch(`/api/planes/${planId}/sesiones/${sesionId}`, { method: 'DELETE' })
    const data = await response.json().catch(() => null)
    setEliminandoSesionId(null)

    if (!response.ok) {
      toast.error(data?.error || 'No se pudo eliminar la sesión')
      return
    }

    toast.success('Sesión eliminada')
    await loadData()
  }

  const handleEmitirComprobante = async (planId: string) => {
    if (notasSeleccionadas.size === 0) {
      toast.error('Selecciona al menos una nota de venta')
      return
    }

    const plan = planes.find((p) => p.id === planId)
    const aceptado = await confirmar({
      title: 'Emitir comprobante final',
      mensaje: 'Se emitirá el comprobante que consolida las notas de venta seleccionadas y se enviará a SUNAT.',
      detalle: [
        `Paciente: ${plan?.paciente.nombre ?? '—'}`,
        `Tipo: ${tipoComprobante}`,
        `Notas de venta: ${notasSeleccionadas.size}`,
        `Total: S/ ${totalNotasSeleccionadas.toFixed(2)}`,
      ],
      textoConfirmar: 'Emitir',
    })
    if (!aceptado) return

    setEnviando(true)
    const response = await fetch(`/api/planes/${planId}/cerrar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipo: tipoComprobante, notaIds: [...notasSeleccionadas] }),
    })
    const data = await response.json().catch(() => null)
    setEnviando(false)

    if (!response.ok) {
      toast.error(data?.error || 'El comprobante se registró, pero falló el envío a SUNAT (puedes reintentarlo desde Facturación)')
      cerrarDetalle()
      await loadData()
      return
    }

    toast.success('Comprobante final emitido correctamente')
    cerrarDetalle()
    await loadData()
  }

  return (
    <div className="page-shell px-4 py-8 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="card-surface flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="eyebrow">Planes de tratamiento</p>
            <h1 className="page-heading mt-3 text-3xl">Tratamientos con pagos por etapas</h1>
            <p className="mt-2 text-ink-600">Registra abonos conforme el paciente va pagando y emite el comprobante final cuando complete el pago.</p>
          </div>
          <button type="button" onClick={() => setMostrarFormulario(true)} className="btn-brand shrink-0">
            Nuevo plan
          </button>
        </div>

        {mostrarFormulario && (
          <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 px-4 py-8">
            <div className="card-surface w-full max-w-2xl">
              <div className="flex items-center justify-between gap-4">
                <h2 className="text-xl font-bold text-ink-800">Nuevo plan</h2>
                <button type="button" onClick={() => setMostrarFormulario(false)} className="rounded-full p-2 text-ink-500 transition hover:bg-ink-100" aria-label="Cerrar">✕</button>
              </div>
              <div className="mt-6 space-y-4">
                <div>
                  <label htmlFor="plan-paciente" className="block text-sm font-medium text-ink-700">Paciente</label>
                  <input
                    id="plan-paciente"
                    list="plan-pacientes-datalist"
                    value={nuevoPlan.pacienteNombre}
                    onChange={(event) => setNuevoPlan((prev) => ({ ...prev, pacienteNombre: event.target.value }))}
                    placeholder="Escribe el nombre del paciente"
                    autoComplete="off"
                    className="field mt-2"
                  />
                  <datalist id="plan-pacientes-datalist">
                    {pacientes.map((paciente) => <option key={paciente.id} value={paciente.nombre} />)}
                  </datalist>
                </div>
                <div>
                  <label htmlFor="plan-nombre" className="block text-sm font-medium text-ink-700">Nombre del plan</label>
                  <input
                    id="plan-nombre"
                    value={nuevoPlan.nombre}
                    onChange={(event) => setNuevoPlan((prev) => ({ ...prev, nombre: event.target.value }))}
                    placeholder="Ej. Rehabilitación pieza 36 + limpieza"
                    className="field mt-2"
                  />
                </div>
                <div>
                  <p className="block text-sm font-medium text-ink-700">Tratamientos del plan</p>
                  <div className="mt-2 space-y-2">
                    {lineas.map((linea, i) => (
                      <div key={i} className="grid grid-cols-12 gap-2 rounded-xl border border-ink-100 p-2">
                        <select
                          aria-label="Tratamiento del catálogo"
                          className="field col-span-12"
                          value={linea.tratamientoId}
                          onChange={(event) => {
                            const t = tratamientos.find((x) => x.id === event.target.value)
                            setLineas((prev) => prev.map((x, j) => (j === i ? { ...x, tratamientoId: t?.id ?? '', descripcion: t ? t.nombre : x.descripcion, precioUnit: t ? t.precio : x.precioUnit } : x)))
                          }}
                        >
                          <option value="">Del catálogo…</option>
                          {tratamientos.map((t) => <option key={t.id} value={t.id}>{t.nombre} — S/ {t.precio.toFixed(2)}</option>)}
                        </select>
                        <input aria-label="Descripción" placeholder="Descripción" value={linea.descripcion} onChange={(event) => setLineas((prev) => prev.map((x, j) => (j === i ? { ...x, descripcion: event.target.value } : x)))} className="field col-span-12 sm:col-span-5" />
                        <input aria-label="Pieza dental" placeholder="Pieza" value={linea.pieza} onChange={(event) => setLineas((prev) => prev.map((x, j) => (j === i ? { ...x, pieza: event.target.value } : x)))} className="field col-span-4 sm:col-span-2" />
                        <input aria-label="Cantidad" type="number" min={1} value={linea.cantidad} onChange={(event) => setLineas((prev) => prev.map((x, j) => (j === i ? { ...x, cantidad: Number(event.target.value) } : x)))} className="field col-span-3 sm:col-span-2" />
                        <input aria-label="Precio unitario" type="number" min={0} step="0.01" value={linea.precioUnit} onChange={(event) => setLineas((prev) => prev.map((x, j) => (j === i ? { ...x, precioUnit: Number(event.target.value) } : x)))} className="field col-span-5 sm:col-span-3" />
                        {lineas.length > 1 && <button type="button" onClick={() => setLineas((prev) => prev.filter((_, j) => j !== i))} className="col-span-12 text-left text-xs font-semibold text-danger-600">Quitar línea</button>}
                      </div>
                    ))}
                    <button type="button" onClick={() => setLineas((prev) => [...prev, { ...LINEA_VACIA }])} className="text-sm font-semibold text-brand-700">+ Agregar tratamiento</button>
                  </div>
                </div>
                {lineasValidas.length > 0 ? (
                  <p className="rounded-xl bg-brand-50 px-4 py-3 text-sm text-brand-900">Total del plan: <strong>S/ {totalLineas.toFixed(2)}</strong> · {lineasValidas.reduce((acc, l) => acc + l.cantidad, 0)} tratamientos</p>
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="plan-sesiones" className="block text-sm font-medium text-ink-700">Sesiones</label>
                      <input id="plan-sesiones" type="number" min={1} value={nuevoPlan.sesionesTotal} onChange={(event) => setNuevoPlan((prev) => ({ ...prev, sesionesTotal: event.target.value }))} className="field mt-2" />
                    </div>
                    <div>
                      <label htmlFor="plan-precio" className="block text-sm font-medium text-ink-700">Precio total (S/)</label>
                      <input id="plan-precio" type="number" min={0} step="0.01" value={nuevoPlan.precioTotal} onChange={(event) => setNuevoPlan((prev) => ({ ...prev, precioTotal: event.target.value }))} className="field mt-2" />
                    </div>
                  </div>
                )}
                <button type="button" disabled={creando} onClick={() => void handleCrearPlan()} className="btn-brand w-full disabled:opacity-50">
                  {creando ? 'Creando...' : 'Crear plan'}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="card-surface">
          {loading ? (
            <p className="flex items-center gap-2 text-sm text-ink-500"><Spinner /> Cargando planes...</p>
          ) : planesPagina.length === 0 ? (
            <p className="text-sm text-ink-500">No hay planes registrados todavía.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead>
                  <tr className="text-xs font-semibold uppercase tracking-wide text-ink-500">
                    <th className="pb-3 pr-4">Paciente</th>
                    <th className="pb-3 pr-4">Plan</th>
                    <th className="pb-3 pr-4 text-right">Sesiones</th>
                    <th className="pb-3 pr-4 text-right">Total</th>
                    <th className="pb-3 pr-4 text-right">Pagado</th>
                    <th className="pb-3 pr-4 text-right">Saldo</th>
                    <th className="pb-3 pr-4">Estado</th>
                    <th className="pb-3">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {planesPagina.map((plan) => (
                    <tr
                      key={plan.id}
                      onClick={() => abrirDetalle(plan)}
                      className="cursor-pointer border-t border-ink-50 hover:bg-ink-50"
                    >
                      <td className="py-3 pr-4 font-semibold text-ink-800">
                        <PacienteHistorialLink pacienteId={plan.paciente.id} nombre={plan.paciente.nombre} className="hover:text-brand-700" />
                      </td>
                      <td className="py-3 pr-4 text-ink-600">
                        {plan.nombre}
                        {plan.tratamiento && <span className="block text-xs text-ink-400">{plan.tratamiento.nombre}</span>}
                      </td>
                      <td className="py-3 pr-4 text-right text-ink-600">{plan.sesiones.length} / {plan.sesionesTotal}</td>
                      <td className="py-3 pr-4 text-right font-semibold text-ink-800">S/ {plan.precioTotal.toFixed(2)}</td>
                      <td className="py-3 pr-4 text-right text-ink-600">S/ {plan.pagado.toFixed(2)}</td>
                      <td className={`py-3 pr-4 text-right font-semibold ${plan.saldo > 0.01 ? 'text-danger-700' : 'text-brand-600'}`}>
                        S/ {plan.saldo.toFixed(2)}
                      </td>
                      <td className="py-3 pr-4">
                        {plan.estado === 'CERRADO' ? (
                          <span className="font-semibold text-brand-600">Cerrado</span>
                        ) : plan.saldo > 0.01 ? (
                          <span className="font-semibold text-amber-700">Pago pendiente</span>
                        ) : (
                          <span className="font-semibold text-brand-700">Pagado, falta emitir</span>
                        )}
                      </td>
                      <td className="py-3 pr-4 text-xs font-semibold text-brand-700">Ver detalle</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-6">
            <Pagination page={paginaActual} totalPages={totalPaginas} onChange={setPagina} />
          </div>
        </div>
      </div>

      {planAbierto && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 px-4 py-8">
          <div className="card-surface w-full max-w-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-ink-800">{planAbierto.nombre}</h2>
                <p className="text-sm text-ink-500">
                  <PacienteHistorialLink pacienteId={planAbierto.paciente.id} nombre={planAbierto.paciente.nombre} className="hover:text-brand-700" />
                  {planAbierto.tratamiento && ` · ${planAbierto.tratamiento.nombre}`}
                </p>
              </div>
              <button type="button" onClick={cerrarDetalle} className="rounded-full p-2 text-ink-500 transition hover:bg-ink-100" aria-label="Cerrar">✕</button>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
              <div className="rounded-2xl bg-ink-50 p-3 text-center">
                <p className="text-xs text-ink-500">Total</p>
                <p className="font-semibold text-ink-800">S/ {planAbierto.precioTotal.toFixed(2)}</p>
              </div>
              <div className="rounded-2xl bg-ink-50 p-3 text-center">
                <p className="text-xs text-ink-500">Pagado</p>
                <p className="font-semibold text-ink-700">S/ {planAbierto.pagado.toFixed(2)}</p>
              </div>
              <div className="rounded-2xl bg-ink-50 p-3 text-center">
                <p className="text-xs text-ink-500">Saldo</p>
                <p className={`font-semibold ${planAbierto.saldo > 0.01 ? 'text-danger-700' : 'text-brand-600'}`}>S/ {planAbierto.saldo.toFixed(2)}</p>
              </div>
            </div>

            {/* Sesiones */}
            <div className="mt-6 border-t border-ink-100 pt-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold uppercase tracking-wide text-ink-500">Sesiones</h3>
                <span className="text-sm font-semibold text-ink-800">{planAbierto.sesiones.length} de {planAbierto.sesionesTotal}</span>
              </div>

              {planAbierto.sesiones.length > 0 && (
                <div className="mt-3 max-h-40 space-y-1 overflow-y-auto">
                  {planAbierto.sesiones.map((sesion) => (
                    <div key={sesion.id} className="flex items-center justify-between rounded-xl bg-ink-50 px-3 py-2 text-sm">
                      <span className="text-ink-700">
                        Sesión {sesion.numero} · {new Date(sesion.fecha).toLocaleDateString('es-PE')}
                        {sesion.notas && <span className="text-ink-400"> — {sesion.notas}</span>}
                      </span>
                      <button
                        type="button"
                        disabled={eliminandoSesionId === sesion.id}
                        onClick={() => void handleEliminarSesion(planAbierto.id, sesion.id)}
                        className="text-xs font-semibold text-danger-600 disabled:opacity-50"
                      >✕</button>
                    </div>
                  ))}
                </div>
              )}

              {planAbierto.sesiones.length < planAbierto.sesionesTotal ? (
                <div className="mt-3 flex flex-wrap items-end gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-ink-500">Fecha</label>
                    <input
                      type="date"
                      value={sesionForm.fecha}
                      onChange={(event) => setSesionForm((prev) => ({ ...prev, fecha: event.target.value }))}
                      className="mt-1 rounded-lg border border-ink-200 px-3 py-1.5 text-sm outline-none focus:border-brand-500"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs font-semibold text-ink-500">Notas (opcional)</label>
                    <input
                      type="text"
                      value={sesionForm.notas}
                      onChange={(event) => setSesionForm((prev) => ({ ...prev, notas: event.target.value }))}
                      className="mt-1 w-full rounded-lg border border-ink-200 px-3 py-1.5 text-sm outline-none focus:border-brand-500"
                    />
                  </div>
                  <button
                    type="button"
                    disabled={registrandoSesion}
                    onClick={() => void handleRegistrarSesion(planAbierto.id)}
                    className="btn-brand disabled:opacity-50"
                  >
                    {registrandoSesion ? 'Registrando...' : 'Registrar sesión'}
                  </button>
                </div>
              ) : (
                <p className="mt-3 text-xs font-semibold text-brand-700">Todas las sesiones fueron registradas.</p>
              )}
            </div>

            {/* Abonos */}
            <div className="mt-6 border-t border-ink-100 pt-4">
              <h3 className="text-sm font-bold uppercase tracking-wide text-ink-500">Abonos</h3>

              {planAbierto.facturas.length > 0 && (
                <div className="mt-3 space-y-1">
                  {planAbierto.facturas.map((factura) => (
                    <div key={factura.id} className="flex items-center justify-between rounded-xl bg-ink-50 px-3 py-2 text-xs text-ink-600">
                      <span className="font-mono">{factura.numeracionComprobante || '—'}</span>
                      <span>{factura.fechaHora ? new Date(factura.fechaHora).toLocaleDateString('es-PE') : '—'}</span>
                      <span>{NOMBRE_METODO_PAGO[factura.metodoPago] || factura.metodoPago}</span>
                      <span className="font-semibold text-ink-700">S/ {factura.total.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              )}

              {planAbierto.estado === 'ABIERTO' && planAbierto.saldo > 0.01 && (
                <div className="mt-3 flex flex-wrap items-end gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-ink-500">Monto (S/)</label>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={abonoForm.monto}
                      onChange={(event) => setAbonoForm((prev) => ({ ...prev, monto: event.target.value }))}
                      className="mt-1 w-32 rounded-lg border border-ink-200 px-3 py-1.5 text-sm outline-none focus:border-brand-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-ink-500">Método de pago</label>
                    <select
                      value={abonoForm.metodoPago}
                      onChange={(event) => setAbonoForm((prev) => ({ ...prev, metodoPago: event.target.value }))}
                      className="mt-1 rounded-lg border border-ink-200 px-3 py-1.5 text-sm outline-none focus:border-brand-500"
                    >
                      {METODOS_PAGO_ABONO.map((metodo) => <option key={metodo} value={metodo}>{NOMBRE_METODO_PAGO[metodo]}</option>)}
                    </select>
                  </div>
                  <button type="button" disabled={enviando} onClick={() => void handleRegistrarAbono(planAbierto.id)} className="btn-brand disabled:opacity-50">
                    {enviando ? 'Registrando...' : 'Confirmar abono'}
                  </button>
                </div>
              )}
            </div>

            {/* Cierre */}
            {planAbierto.estado === 'ABIERTO' && planAbierto.saldo <= 0.01 && puedeEmitirComprobante && (
              <div className="mt-6 border-t border-ink-100 pt-4">
                <h3 className="text-sm font-bold uppercase tracking-wide text-ink-500">Emitir comprobante final</h3>
                <p className="mt-1 text-xs text-ink-500">Deselecciona las notas de venta que no quieras incluir (quedan como notas de venta independientes).</p>
                <div className="mt-3 space-y-1">
                  {planAbierto.facturas.map((factura) => (
                    <label key={factura.id} className="flex items-center gap-3 text-sm text-ink-700">
                      <input
                        type="checkbox"
                        checked={notasSeleccionadas.has(factura.id)}
                        onChange={(event) => {
                          setNotasSeleccionadas((prev) => {
                            const next = new Set(prev)
                            if (event.target.checked) next.add(factura.id)
                            else next.delete(factura.id)
                            return next
                          })
                        }}
                      />
                      <span className="w-28 font-mono text-xs">{factura.numeracionComprobante || '—'}</span>
                      <span className="font-semibold">S/ {factura.total.toFixed(2)}</span>
                    </label>
                  ))}
                </div>
                <div className="mt-3 flex flex-wrap items-end gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-ink-500">Tipo de comprobante</label>
                    <select
                      value={tipoComprobante}
                      onChange={(event) => setTipoComprobante(event.target.value as 'BOLETA' | 'FACTURA')}
                      className="mt-1 rounded-lg border border-ink-200 px-3 py-1.5 text-sm outline-none focus:border-brand-500"
                    >
                      <option value="BOLETA">Boleta</option>
                      <option value="FACTURA">Factura</option>
                    </select>
                  </div>
                  <p className="font-semibold text-ink-800">Total a emitir: S/ {totalNotasSeleccionadas.toFixed(2)}</p>
                  <button type="button" disabled={enviando || notasSeleccionadas.size === 0} onClick={() => void handleEmitirComprobante(planAbierto.id)} className="btn-brand disabled:opacity-50">
                    {enviando ? 'Emitiendo...' : 'Emitir comprobante final'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default function PlanesPage() {
  return (
    <Suspense fallback={null}>
      <PlanesContent />
    </Suspense>
  )
}
