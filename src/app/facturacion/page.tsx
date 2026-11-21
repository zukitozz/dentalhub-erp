'use client'

import { nuevoId } from '@/lib/id'
import { Fragment, Suspense, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { PacienteHistorialLink } from '@/components/PacienteHistorialLink'
import { Spinner } from '@/components/Spinner'
import { Pagination } from '@/components/Pagination'
import { useToast } from '@/components/Toast'
import { useConfirm } from '@/components/ConfirmDialog'
import { imprimirTicket, puedeImprimirTicket, type TicketEmpresaInfo } from '@/lib/ticket'
import { SearchSelect } from '@/components/SearchSelect'

const FACTURAS_PAGE_SIZE = 10

interface Paciente {
  id: string
  nombre: string
  dni?: string | null
  ruc?: string | null
  carnetExtranjeria?: string | null
  razonSocial?: string | null
}

interface Producto {
  id: string
  nombre: string
  precioVenta: number
  stock: number
}

interface Tratamiento {
  id: string
  nombre: string
  precio: number
  activo: boolean
}

interface FacturaItemForm {
  id: string
  productoId: string
  tratamientoId: string
  nombre: string
  cantidad: number
  precioUnit: number
  odontologoId: string
  comision: string
}

interface FacturaItem {
  id: string
  nombre: string
  cantidad: number
  precioUnit: number
  total: number
  precioCatalogo: number | null
}

interface Factura {
  id: string
  paciente: Paciente
  tipo: 'BOLETA' | 'FACTURA' | 'NOTA_VENTA'
  total: number
  metodoPago: string
  estado: string
  items: FacturaItem[]
  numeracionComprobante: string | null
  enviado: boolean
  errors: string | null
  url: string | null
  fechaHora: string | null
  montoLetras: string | null
  gravadas: number | null
  igv: number | null
  pagoEfectivo: number | null
  pagoTarjeta: number | null
  pagoYape: number | null
  pagoTransferencia: number | null
  pagoDeposito: number | null
}

interface PendienteProducto {
  id: string
  cantidad: number
  precioUnit: number
  precioCatalogo: number
  producto: { id: string; nombre: string }
}

interface PendienteTratamiento {
  id: string
  nombre: string
  precio: number
  precioCatalogo: number
}

interface Pendiente {
  id: string
  horaInicio: string
  consultorio: { id: string; nombre: string } | null
  tratamientos: PendienteTratamiento[]
  productos: PendienteProducto[]
}

const createInitialItem = (): FacturaItemForm => ({ id: nuevoId(), productoId: '', tratamientoId: '', nombre: '', cantidad: 1, precioUnit: 0, odontologoId: '', comision: '' })

const createInitialPago = () => ({ id: nuevoId(), metodo: 'EFECTIVO', monto: '' })

const metodoPagoLabels: Record<string, string> = {
  EFECTIVO: 'Efectivo',
  TARJETA: 'Tarjeta',
  YAPE: 'Yape',
  PLIN: 'Plin',
  TRANSFERENCIA: 'Transferencia',
  DEPOSITO: 'Depósito',
  MIXTO: 'Mixto',
}

function desglosePago(factura: Pick<Factura, 'pagoEfectivo' | 'pagoTarjeta' | 'pagoYape' | 'pagoTransferencia' | 'pagoDeposito'>) {
  return [
    ['Efectivo', factura.pagoEfectivo],
    ['Tarjeta', factura.pagoTarjeta],
    ['Yape/Plin', factura.pagoYape],
    ['Transferencia', factura.pagoTransferencia],
    ['Depósito', factura.pagoDeposito],
  ].filter((fila): fila is [string, number] => typeof fila[1] === 'number' && fila[1] > 0)
}

function hoyISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** true si el precio acordado difiere del precio de catálogo (no es un descuento, es un cambio de precio base). */
function precioFueModificado(precio: number, precioCatalogo: number) {
  return Math.abs(precio - precioCatalogo) > 0.005
}

function FacturacionContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const toast = useToast()
  const confirmar = useConfirm()
  const [atencionIdOrigen] = useState(() => searchParams.get('atencionId') || '')
  const [mostrarFormulario, setMostrarFormulario] = useState(
    () => Boolean(searchParams.get('atencionId') || searchParams.get('pacienteId')),
  )

  const [pacientes, setPacientes] = useState<Paciente[]>([])
  const [productos, setProductos] = useState<Producto[]>([])
  const [tratamientos, setTratamientos] = useState<Tratamiento[]>([])
  const [odontologos, setOdontologos] = useState<{ id: string; name: string }[]>([])
  const [facturas, setFacturas] = useState<Factura[]>([])
  const [pendientes, setPendientes] = useState<Pendiente[]>([])
  const [empresa, setEmpresa] = useState<TicketEmpresaInfo>({ nombreEmpresa: 'HubDental Centro Estético' })
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [guardandoPendiente, setGuardandoPendiente] = useState(false)
  const [reenviandoId, setReenviandoId] = useState<string | null>(null)

  const [form, setForm] = useState({
    pacienteId: searchParams.get('pacienteId') || '',
    tipo: 'BOLETA',
    metodoPago: 'EFECTIVO',
    pagoMixto: false,
    pagos: [createInitialPago()],
    items: [createInitialItem()],
  })
  const [busquedaFactura, setBusquedaFactura] = useState('')
  const [paginaFactura, setPaginaFactura] = useState(1)
  const [fechaFactura, setFechaFactura] = useState(() => hoyISO())

  const [pacienteQuery, setPacienteQuery] = useState('')
  const [showPacienteDropdown, setShowPacienteDropdown] = useState(false)
  const [nuevoPacienteAbierto, setNuevoPacienteAbierto] = useState(false)
  const [nuevoPaciente, setNuevoPaciente] = useState({ nombre: '', tipoDocumento: 'DNI' as 'DNI' | 'RUC' | 'CE', numeroDocumento: '' })
  const [creandoPaciente, setCreandoPaciente] = useState(false)

  // Precio editado en caja para una línea pendiente puntual (tratamiento o producto ya
  // registrado en la atención). Si no se toca, se cobra el precio acordado al asignarlo.
  const [preciosTratamientoOverride, setPreciosTratamientoOverride] = useState<Record<string, string>>({})
  const [preciosProductoOverride, setPreciosProductoOverride] = useState<Record<string, string>>({})
  const [facturaExpandida, setFacturaExpandida] = useState<string | null>(null)

  const itemsValidos = useMemo(() => form.items.filter((item) => item.productoId || item.tratamientoId), [form.items])

  const precioTratamientoEfectivo = (linea: PendienteTratamiento) => {
    const override = preciosTratamientoOverride[linea.id]
    return override !== undefined && override !== '' ? Number(override) || 0 : linea.precio
  }
  const precioProductoEfectivo = (item: PendienteProducto) => {
    const override = preciosProductoOverride[item.id]
    return override !== undefined && override !== '' ? Number(override) || 0 : item.precioUnit
  }

  const subtotalPendientes = useMemo(
    () =>
      pendientes.reduce(
        (sum, pendiente) =>
          sum +
          pendiente.tratamientos.reduce((s, item) => s + precioTratamientoEfectivo(item), 0) +
          pendiente.productos.reduce((s, item) => s + item.cantidad * precioProductoEfectivo(item), 0),
        0,
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pendientes, preciosTratamientoOverride, preciosProductoOverride],
  )
  const subtotalManual = useMemo(
    () => itemsValidos.reduce((sum, item) => sum + item.cantidad * item.precioUnit, 0),
    [itemsValidos],
  )
  const subtotal = subtotalPendientes + subtotalManual
  const total = subtotal

  const pagosDescuadrados = form.pagoMixto && Math.abs(total - form.pagos.reduce((sum, p) => sum + (Number(p.monto) || 0), 0)) > 0.01

  const pacientesFiltrados = useMemo(() => {
    const query = pacienteQuery.trim().toLowerCase()
    if (!query) return []
    return pacientes.filter((paciente) => paciente.nombre.toLowerCase().includes(query)).slice(0, 8)
  }, [pacientes, pacienteQuery])

  const facturasFiltradas = useMemo(() => {
    const query = busquedaFactura.trim().toLowerCase()
    if (!query) return facturas
    return facturas.filter((factura) =>
      (factura.numeracionComprobante || '').toLowerCase().includes(query) ||
      factura.paciente.nombre.toLowerCase().includes(query),
    )
  }, [facturas, busquedaFactura])

  const totalPaginasFactura = Math.max(1, Math.ceil(facturasFiltradas.length / FACTURAS_PAGE_SIZE))
  const paginaFacturaActual = Math.min(paginaFactura, totalPaginasFactura)
  const facturasPagina = facturasFiltradas.slice(
    (paginaFacturaActual - 1) * FACTURAS_PAGE_SIZE,
    paginaFacturaActual * FACTURAS_PAGE_SIZE,
  )

  useEffect(() => { setPaginaFactura(1) }, [busquedaFactura])

  const recentInvoices = loading ? (
    <p className="flex items-center gap-2 text-sm text-ink-500"><Spinner /> Cargando facturas...</p>
  ) : facturasPagina.length === 0 ? (
    <p className="text-sm text-ink-500">{facturas.length === 0 ? 'No hay facturas registradas para este día.' : 'No se encontraron facturas.'}</p>
  ) : (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead>
          <tr className="text-xs font-semibold uppercase tracking-wide text-ink-500">
            <th className="pb-3 pr-4">Fecha y hora</th>
            <th className="pb-3 pr-4">Paciente</th>
            <th className="pb-3 pr-4">Tipo</th>
            <th className="pb-3 pr-4">Comprobante</th>
            <th className="pb-3 pr-4 text-right">Total</th>
            <th className="pb-3 pr-4">Estado</th>
            <th className="pb-3">Acción</th>
          </tr>
        </thead>
        <tbody>
          {facturasPagina.map((factura) => {
            const expandida = facturaExpandida === factura.id
            const algunPrecioModificado = factura.items.some(
              (item) => item.precioCatalogo != null && precioFueModificado(item.precioUnit, item.precioCatalogo),
            )
            return (
              <Fragment key={factura.id}>
                <tr
                  onClick={() => setFacturaExpandida(expandida ? null : factura.id)}
                  className="cursor-pointer border-t border-ink-50 hover:bg-ink-50"
                >
                  <td className="py-3 pr-4 whitespace-nowrap text-ink-600">
                    {factura.fechaHora ? new Date(factura.fechaHora).toLocaleString('es-PE') : '—'}
                  </td>
                  <td className="py-3 pr-4 font-semibold text-ink-800">
                    <PacienteHistorialLink pacienteId={factura.paciente.id} nombre={factura.paciente.nombre} className="hover:text-brand-700" />
                  </td>
                  <td className="py-3 pr-4 text-ink-600">{factura.tipo}</td>
                  <td className="py-3 pr-4 text-ink-600">
                    {factura.numeracionComprobante || 'Sin comprobante'}
                    {algunPrecioModificado && (
                      <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">Precio modificado</span>
                    )}
                    {factura.metodoPago === 'MIXTO' ? (
                      <span
                        title={desglosePago(factura).map(([nombre, monto]) => `${nombre}: S/ ${monto.toFixed(2)}`).join(' · ')}
                        className="ml-2 rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-semibold text-sky-800"
                      >
                        Mixto
                      </span>
                    ) : (
                      <span className="ml-2 rounded-full bg-ink-100 px-2 py-0.5 text-[10px] font-semibold text-ink-600">
                        {metodoPagoLabels[factura.metodoPago] || factura.metodoPago}
                      </span>
                    )}
                  </td>
                  <td className="py-3 pr-4 text-right font-semibold text-ink-800">S/ {factura.total.toFixed(2)}</td>
                  <td className="py-3 pr-4">
                    {factura.tipo === 'NOTA_VENTA' ? (
                      <span className="text-ink-500">No aplica</span>
                    ) : factura.enviado ? (
                      <span className="font-semibold text-brand-600">✓ Enviado a SUNAT</span>
                    ) : (
                      <span className="font-semibold text-danger-700">Error al enviar</span>
                    )}
                    {factura.errors && !factura.enviado && (
                      <p className="mt-1 max-w-xs text-xs text-danger-700">{factura.errors}</p>
                    )}
                  </td>
                  <td className="py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      {factura.enviado && factura.url ? (
                        <a
                          href={factura.url}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(event) => event.stopPropagation()}
                          className="rounded-full border border-brand-700 px-4 py-1.5 text-xs font-bold text-brand-700 transition hover:bg-brand-700 hover:text-white"
                        >
                          Ver PDF
                        </a>
                      ) : (
                        !puedeImprimirTicket(factura.tipo) && <span className="text-ink-400">—</span>
                      )}
                      {puedeImprimirTicket(factura.tipo) && (
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation()
                            void imprimirTicket(factura, empresa)
                          }}
                          className="rounded-full border border-ink-300 px-4 py-1.5 text-xs font-bold text-ink-700 transition hover:bg-ink-100"
                        >
                          Reimprimir
                        </button>
                      )}
                      {!factura.enviado && factura.tipo !== 'NOTA_VENTA' && (
                        <button
                          type="button"
                          disabled={reenviandoId === factura.id}
                          onClick={(event) => {
                            event.stopPropagation()
                            void handleReenviar(factura.id)
                          }}
                          className="rounded-full border border-danger-300 px-4 py-1.5 text-xs font-bold text-danger-700 transition hover:bg-danger-50 disabled:opacity-50"
                        >
                          {reenviandoId === factura.id ? 'Reenviando...' : 'Reenviar a SUNAT'}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
                {expandida && (
                  <tr className="border-t border-ink-50 bg-ink-50/60">
                    <td colSpan={7} className="py-3 pr-4">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="text-[10px] font-semibold uppercase tracking-wide text-ink-500">
                            <th className="pb-1 pr-3">Item</th>
                            <th className="pb-1 pr-3 text-right">Cant.</th>
                            <th className="pb-1 pr-3 text-right">Precio catálogo</th>
                            <th className="pb-1 pr-3 text-right">Precio cobrado</th>
                            <th className="pb-1 pr-3 text-right">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {factura.items.map((item) => {
                            const modificado = item.precioCatalogo != null && precioFueModificado(item.precioUnit, item.precioCatalogo)
                            return (
                              <tr key={item.id} className="border-t border-ink-200/70">
                                <td className="py-1.5 pr-3 text-ink-700">
                                  {item.nombre}
                                  {modificado && <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">Precio modificado</span>}
                                </td>
                                <td className="py-1.5 pr-3 text-right text-ink-600">{item.cantidad}</td>
                                <td className="py-1.5 pr-3 text-right text-ink-600">{item.precioCatalogo != null ? `S/ ${item.precioCatalogo.toFixed(2)}` : '—'}</td>
                                <td className={`py-1.5 pr-3 text-right ${modificado ? 'font-semibold text-amber-800' : 'text-ink-600'}`}>S/ {item.precioUnit.toFixed(2)}</td>
                                <td className="py-1.5 pr-3 text-right font-semibold text-ink-700">S/ {item.total.toFixed(2)}</td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </td>
                  </tr>
                )}
              </Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )

  const loadFacturas = async (fecha: string) => {
    const res = await fetch(`/api/facturacion?fecha=${fecha}`)
    const data = await res.json()
    setFacturas(Array.isArray(data) ? data : [])
    setLoading(false)
  }

  const loadData = async () => {
    const [pacientesRes, productosRes, tratamientosRes, ajustesRes, odontologosRes] = await Promise.all([
      fetch('/api/pacientes'),
      fetch('/api/productos'),
      fetch('/api/tratamientos'),
      fetch('/api/ajustes'),
      fetch('/api/usuarios/odontologos'),
    ])

    const [pacientesData, productosData, tratamientosData, ajustesData, odontologosData] = await Promise.all([
      pacientesRes.json(),
      productosRes.json(),
      tratamientosRes.json(),
      ajustesRes.ok ? ajustesRes.json() : Promise.resolve(null),
      odontologosRes.ok ? odontologosRes.json() : Promise.resolve([]),
    ])
    setOdontologos(Array.isArray(odontologosData) ? odontologosData : [])

    setPacientes(Array.isArray(pacientesData) ? pacientesData : [])
    setProductos(Array.isArray(productosData) ? productosData : [])
    setTratamientos(Array.isArray(tratamientosData) ? tratamientosData.filter((t: Tratamiento) => t.activo) : [])
    if (ajustesData) {
      setEmpresa({
        nombreEmpresa: ajustesData.nombreEmpresa || 'HubDental Centro Estético',
        ruc: ajustesData.ruc || null,
        razonSocial: ajustesData.razonSocial || null,
        direccionFiscal: ajustesData.direccionFiscal || null,
      })
    }
  }

  useEffect(() => {
    void loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    void loadFacturas(fechaFactura)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fechaFactura])

  useEffect(() => {
    setPreciosTratamientoOverride({})
    setPreciosProductoOverride({})
    if (!form.pacienteId) {
      setPendientes([])
      return
    }
    fetch(`/api/pacientes/${form.pacienteId}/pendientes`)
      .then((res) => res.json())
      .then((data) => setPendientes(Array.isArray(data) ? data : []))
  }, [form.pacienteId])

  useEffect(() => {
    if (!form.pacienteId || pacienteQuery) return
    const match = pacientes.find((paciente) => paciente.id === form.pacienteId)
    if (match) setPacienteQuery(match.nombre)
  }, [pacientes, form.pacienteId, pacienteQuery])

  const seleccionarPaciente = (paciente: Paciente) => {
    setForm((prev) => ({ ...prev, pacienteId: paciente.id }))
    setPacienteQuery(paciente.nombre)
    setShowPacienteDropdown(false)
    setNuevoPacienteAbierto(false)
  }

  const handlePacienteQueryChange = (value: string) => {
    setPacienteQuery(value)
    setShowPacienteDropdown(true)
    setNuevoPacienteAbierto(false)
    if (form.pacienteId) setForm((prev) => ({ ...prev, pacienteId: '' }))
  }

  const handleCrearPaciente = async () => {
    if (!nuevoPaciente.nombre.trim() || !nuevoPaciente.numeroDocumento.trim()) return
    setCreandoPaciente(true)
    const response = await fetch('/api/pacientes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nombre: nuevoPaciente.nombre,
        dni: nuevoPaciente.tipoDocumento === 'DNI' ? nuevoPaciente.numeroDocumento : null,
        ruc: nuevoPaciente.tipoDocumento === 'RUC' ? nuevoPaciente.numeroDocumento : null,
        carnetExtranjeria: nuevoPaciente.tipoDocumento === 'CE' ? nuevoPaciente.numeroDocumento : null,
      }),
    })
    const data = await response.json()
    setCreandoPaciente(false)

    if (!response.ok) {
      toast.error(data.error || 'No se pudo registrar el paciente')
      return
    }

    setPacientes((prev) => [data, ...prev])
    seleccionarPaciente(data)
  }

  const handleSeleccionarPacienteVarios = () => {
    const pacienteVarios = pacientes.find((paciente) => paciente.dni === '0')
    if (pacienteVarios) {
      seleccionarPaciente(pacienteVarios)
    } else {
      toast.error('No se encontró el paciente "Pacientes Varios". Contacta a soporte.')
    }
  }

  const updateItem = (index: number, changes: Partial<FacturaItemForm>) => {
    setForm((current) => ({
      ...current,
      items: current.items.map((item, idx) => (idx === index ? { ...item, ...changes } : item)),
    }))
  }

  const selectItem = (index: number, value: string) => {
    if (!value) {
      updateItem(index, { productoId: '', tratamientoId: '', nombre: '', precioUnit: 0 })
      return
    }
    const [tipo, id] = value.split(':')
    if (tipo === 'p') {
      const producto = productos.find((item) => item.id === id)
      updateItem(index, { productoId: id, tratamientoId: '', nombre: producto?.nombre || '', precioUnit: producto?.precioVenta || 0 })
    } else {
      const tratamiento = tratamientos.find((item) => item.id === id)
      updateItem(index, { productoId: '', tratamientoId: id, nombre: tratamiento?.nombre || '', precioUnit: tratamiento?.precio || 0 })
    }
  }

  const handleAddItem = () => {
    setForm((current) => ({ ...current, items: [...current.items, createInitialItem()] }))
  }

  const handleRemoveItem = (index: number) => {
    setForm((current) => ({ ...current, items: current.items.filter((_, idx) => idx !== index) }))
  }

  const resetForm = () => {
    setForm({
      pacienteId: '',
      tipo: 'BOLETA',
      metodoPago: 'EFECTIVO',
      pagoMixto: false,
      pagos: [createInitialPago()],
      items: [createInitialItem()],
    })
    setPacienteQuery('')
    setNuevoPacienteAbierto(false)
    setNuevoPaciente({ nombre: '', tipoDocumento: 'DNI', numeroDocumento: '' })
    setPreciosTratamientoOverride({})
    setPreciosProductoOverride({})
  }

  const handleSubmit = async () => {
    if (!form.pacienteId) return
    if (pendientes.length === 0 && itemsValidos.length === 0) return
    if (submitting) return
    const aceptado = await confirmar({
      title: 'Registrar comprobante',
      mensaje: form.tipo === 'NOTA_VENTA'
        ? 'Se registrará la nota de venta y el cobro quedará pendiente del próximo cierre de turno.'
        : 'Se registrará el comprobante, se enviará a SUNAT y el cobro quedará pendiente del próximo cierre de turno.',
      detalle: [
        `Paciente: ${pacienteQuery}`,
        `Tipo: ${form.tipo.replace('_', ' ')}`,
        `Pago: ${form.pagoMixto ? 'Mixto' : form.metodoPago}`,
        `Total: S/ ${total.toFixed(2)}`,
      ],
      textoConfirmar: 'Registrar',
    })
    if (!aceptado) return
    setSubmitting(true)

    const preciosTratamiento = Object.fromEntries(
      Object.entries(preciosTratamientoOverride)
        .filter(([, valor]) => valor !== '' && Number.isFinite(Number(valor)))
        .map(([id, valor]) => [id, Number(valor)]),
    )
    const preciosProducto = Object.fromEntries(
      Object.entries(preciosProductoOverride)
        .filter(([, valor]) => valor !== '' && Number.isFinite(Number(valor)))
        .map(([id, valor]) => [id, Number(valor)]),
    )

    const response = await fetch('/api/facturacion', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pacienteId: form.pacienteId,
        tratamientoLineIds: pendientes.flatMap((pendiente) => pendiente.tratamientos.map((t) => t.id)),
        productoLineIds: pendientes.flatMap((pendiente) => pendiente.productos.map((p) => p.id)),
        preciosTratamiento,
        preciosProducto,
        tipo: form.tipo,
        metodoPago: form.metodoPago,
        pagos: form.pagoMixto ? form.pagos.map((p) => ({ metodo: p.metodo, monto: Number(p.monto) || 0 })) : undefined,
        items: itemsValidos,
      }),
    })
    const data = await response.json().catch(() => null)
    setSubmitting(false)

    if (!response.ok) {
      toast.error(data?.error || 'No se pudo registrar la factura')
      return
    }

    resetForm()
    setMostrarFormulario(false)
    await loadData()

    if (data?.tipo !== 'NOTA_VENTA' && !data?.enviado) {
      toast.error(data?.errors || 'La factura se registró, pero falló el envío a SUNAT')
    } else {
      toast.success('Factura registrada correctamente')
    }

    if (data && puedeImprimirTicket(data.tipo)) {
      await imprimirTicket(data, empresa)
    }
  }

  const handleReenviar = async (facturaId: string) => {
    setReenviandoId(facturaId)
    try {
      const response = await fetch('/api/facturacion/enviar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ facturaId }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) {
        toast.error(data?.error || 'No se pudo reenviar el comprobante a SUNAT')
        return
      }
      toast.success('Comprobante reenviado correctamente')
      await loadData()
    } finally {
      setReenviandoId(null)
    }
  }

  const handleGuardarPendiente = async () => {
    const atencionDestino = atencionIdOrigen || pendientes[0]?.id
    if (!atencionDestino) return
    setGuardandoPendiente(true)

    for (const item of itemsValidos.filter((item) => item.productoId)) {
      const response = await fetch(`/api/atenciones/${atencionDestino}/productos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productoId: item.productoId, cantidad: item.cantidad }),
      })
      if (!response.ok) {
        const data = await response.json()
        toast.error(data.error || 'No se pudo guardar un producto pendiente')
        setGuardandoPendiente(false)
        return
      }
    }

    setGuardandoPendiente(false)
    router.push('/dashboard')
  }

  return (
    <div className="page-shell px-4 py-8 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="card-surface">
          <p className="eyebrow">Facturación</p>
          <h1 className="page-heading mt-3 text-3xl">Cobros y comprobantes</h1>
          <p className="mt-2 text-ink-600">Registra ventas, ajusta el precio cuando corresponda y genera comprobantes con métodos de pago.</p>
        </div>

        <div className="grid gap-6">
          {mostrarFormulario && (
            <div
              className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 px-4 py-8"
            >
              <div className="card-surface w-full max-w-3xl" onClick={(event) => event.stopPropagation()}>
                <div className="flex items-center justify-between gap-4">
                  <h2 className="text-xl font-bold text-ink-800">Nueva factura</h2>
                  <button
                    type="button"
                    onClick={() => setMostrarFormulario(false)}
                    className="rounded-full p-2 text-ink-500 transition hover:bg-ink-100"
                    aria-label="Cerrar"
                  >✕</button>
                </div>
            <div className="mt-6 space-y-4">
              <div className="relative">
                <label htmlFor="factura-paciente" className="block text-sm font-medium text-ink-700">Paciente</label>
                <input
                  id="factura-paciente"
                  value={pacienteQuery}
                  onChange={(event) => handlePacienteQueryChange(event.target.value)}
                  onFocus={() => setShowPacienteDropdown(true)}
                  onBlur={() => setTimeout(() => setShowPacienteDropdown(false), 150)}
                  autoComplete="off"
                  placeholder="Escribe el nombre del paciente"
                  className="field mt-2"
                />
                {showPacienteDropdown && pacienteQuery.trim() && !form.pacienteId && (
                  <div className="absolute z-10 mt-2 w-full overflow-hidden rounded-2xl border border-ink-200 bg-white shadow-lg">
                    {pacientesFiltrados.length > 0 ? (
                      pacientesFiltrados.map((paciente) => (
                        <button
                          key={paciente.id}
                          type="button"
                          onMouseDown={() => seleccionarPaciente(paciente)}
                          className="block w-full px-4 py-2.5 text-left text-sm hover:bg-brand-50"
                        >
                          {paciente.nombre}
                        </button>
                      ))
                    ) : (
                      <button
                        type="button"
                        onMouseDown={() => {
                          setNuevoPaciente({ nombre: pacienteQuery.trim(), tipoDocumento: 'DNI', numeroDocumento: '' })
                          setNuevoPacienteAbierto(true)
                          setShowPacienteDropdown(false)
                        }}
                        className="block w-full px-4 py-3 text-left text-sm font-semibold text-brand-700 hover:bg-brand-50"
                      >
                        No se encontró &quot;{pacienteQuery.trim()}&quot; · Registrar nuevo paciente
                      </button>
                    )}
                  </div>
                )}
                {!form.pacienteId && (
                  <button
                    type="button"
                    onMouseDown={handleSeleccionarPacienteVarios}
                    className="mt-2 text-xs font-semibold text-ink-500 hover:text-brand-700"
                  >Paciente no desea identificarse · Usar &quot;Pacientes Varios&quot;</button>
                )}
              </div>

              {nuevoPacienteAbierto && (
                <div className="rounded-3xl border border-brand-200 bg-brand-50 p-4">
                  <p className="text-sm font-semibold text-brand-900">Registrar nuevo paciente</p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-3">
                    <input
                      value={nuevoPaciente.nombre}
                      onChange={(event) => setNuevoPaciente((prev) => ({ ...prev, nombre: event.target.value }))}
                      placeholder="Nombre completo"
                      className="rounded-2xl border border-ink-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-brand-500"
                    />
                    <div className="flex overflow-hidden rounded-2xl border border-ink-200 bg-white text-sm">
                      <button
                        type="button"
                        onClick={() => setNuevoPaciente((prev) => ({ ...prev, tipoDocumento: 'DNI' }))}
                        className={`flex-1 px-3 py-2.5 font-semibold ${nuevoPaciente.tipoDocumento === 'DNI' ? 'bg-brand-700 text-white' : 'text-ink-500'}`}
                      >DNI</button>
                      <button
                        type="button"
                        onClick={() => setNuevoPaciente((prev) => ({ ...prev, tipoDocumento: 'CE' }))}
                        className={`flex-1 px-3 py-2.5 font-semibold ${nuevoPaciente.tipoDocumento === 'CE' ? 'bg-brand-700 text-white' : 'text-ink-500'}`}
                      >CE</button>
                      <button
                        type="button"
                        onClick={() => setNuevoPaciente((prev) => ({ ...prev, tipoDocumento: 'RUC' }))}
                        className={`flex-1 px-3 py-2.5 font-semibold ${nuevoPaciente.tipoDocumento === 'RUC' ? 'bg-brand-700 text-white' : 'text-ink-500'}`}
                      >RUC</button>
                    </div>
                    <input
                      value={nuevoPaciente.numeroDocumento}
                      onChange={(event) => setNuevoPaciente((prev) => ({ ...prev, numeroDocumento: event.target.value }))}
                      placeholder={nuevoPaciente.tipoDocumento === 'DNI' ? 'Número de DNI' : nuevoPaciente.tipoDocumento === 'CE' ? 'Número de Carnet de Extranjería' : 'Número de RUC'}
                      className="rounded-2xl border border-ink-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-brand-500"
                    />
                  </div>
                  <div className="mt-3 flex gap-3">
                    <button
                      type="button"
                      disabled={creandoPaciente || !nuevoPaciente.nombre.trim() || !nuevoPaciente.numeroDocumento.trim()}
                      onClick={() => void handleCrearPaciente()}
                      className="inline-flex items-center gap-2 rounded-2xl bg-brand-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                    >
                      {creandoPaciente && <Spinner />}
                      {creandoPaciente ? 'Registrando...' : 'Registrar y seleccionar'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setNuevoPacienteAbierto(false)}
                      className="rounded-2xl border border-ink-200 px-4 py-2 text-sm font-semibold text-ink-600"
                    >Cancelar</button>
                  </div>
                </div>
              )}

              {pendientes.length > 0 && (
                <div className="rounded-3xl border border-amber-200 bg-amber-50 p-4">
                  <p className="text-sm font-semibold text-amber-900">Pendientes de cobro de este paciente</p>
                  <div className="mt-3 space-y-3">
                    {pendientes.map((pendiente) => (
                      <div key={pendiente.id} className="rounded-2xl bg-white p-3">
                        <p className="text-xs text-ink-500">
                          {new Date(pendiente.horaInicio).toLocaleString('es-PE')}
                          {pendiente.consultorio ? ` · Consultorio ${pendiente.consultorio.nombre}` : ''}
                        </p>
                        {pendiente.tratamientos.map((item) => {
                          const precioEfectivo = precioTratamientoEfectivo(item)
                          return (
                            <div key={item.id} className="mt-2 flex items-center justify-between gap-3 text-sm">
                              <span className="flex items-center gap-2 font-medium text-ink-900">
                                {item.nombre}
                                {precioFueModificado(precioEfectivo, item.precioCatalogo) && (
                                  <span title={`Precio de catálogo: S/ ${item.precioCatalogo.toFixed(2)}`} className="rounded-full bg-amber-200 px-2 py-0.5 text-[10px] font-semibold text-amber-900">
                                    Precio modificado
                                  </span>
                                )}
                              </span>
                              <span className="flex items-center gap-1 text-ink-600">
                                S/
                                <input
                                  type="number"
                                  min={0}
                                  step="0.01"
                                  value={preciosTratamientoOverride[item.id] ?? String(item.precio)}
                                  onChange={(event) => setPreciosTratamientoOverride((prev) => ({ ...prev, [item.id]: event.target.value }))}
                                  className="w-24 rounded-lg border border-ink-200 px-2 py-1 text-right text-sm outline-none focus:border-brand-500"
                                />
                              </span>
                            </div>
                          )
                        })}
                        {pendiente.productos.map((item) => {
                          const precioEfectivo = precioProductoEfectivo(item)
                          return (
                            <div key={item.id} className="mt-2 flex items-center justify-between gap-3 text-xs text-ink-500">
                              <span className="flex items-center gap-2">
                                {item.producto.nombre} × {item.cantidad}
                                {precioFueModificado(precioEfectivo, item.precioCatalogo) && (
                                  <span title={`Precio de catálogo: S/ ${item.precioCatalogo.toFixed(2)}`} className="rounded-full bg-amber-200 px-2 py-0.5 text-[10px] font-semibold text-amber-900">
                                    Precio modificado
                                  </span>
                                )}
                              </span>
                              <span className="flex items-center gap-1">
                                S/
                                <input
                                  type="number"
                                  min={0}
                                  step="0.01"
                                  value={preciosProductoOverride[item.id] ?? String(item.precioUnit)}
                                  onChange={(event) => setPreciosProductoOverride((prev) => ({ ...prev, [item.id]: event.target.value }))}
                                  className="w-20 rounded-lg border border-ink-200 px-2 py-1 text-right text-xs outline-none focus:border-brand-500"
                                />
                                <span>c/u</span>
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 flex items-center justify-between text-sm font-semibold text-amber-900">
                    <span>Total pendiente</span>
                    <span>S/ {subtotalPendientes.toFixed(2)}</span>
                  </div>
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="factura-tipo" className="block text-sm font-medium text-ink-700">Tipo</label>
                  <select
                    id="factura-tipo"
                    value={form.tipo}
                    onChange={(event) => setForm((prev) => ({ ...prev, tipo: event.target.value }))}
                    className="field mt-2"
                  >
                    <option value="BOLETA">Boleta</option>
                    <option value="FACTURA">Factura</option>
                    <option value="NOTA_VENTA">Nota de venta (no se envía a SUNAT)</option>
                  </select>
                </div>
                <div>
                  <div className="flex items-center justify-between">
                    <label htmlFor="factura-metodo-pago" className="block text-sm font-medium text-ink-700">Método de pago</label>
                    <label className="flex items-center gap-2 text-xs font-semibold text-ink-500">
                      <input
                        type="checkbox"
                        checked={form.pagoMixto}
                        onChange={(event) => setForm((prev) => ({ ...prev, pagoMixto: event.target.checked, pagos: [createInitialPago()] }))}
                      />
                      Pago con métodos combinados
                    </label>
                  </div>
                  {!form.pagoMixto ? (
                    <select
                      id="factura-metodo-pago"
                      value={form.metodoPago}
                      onChange={(event) => setForm((prev) => ({ ...prev, metodoPago: event.target.value }))}
                      className="field mt-2"
                    >
                      <option value="EFECTIVO">Efectivo</option>
                      <option value="TARJETA">Tarjeta</option>
                      <option value="YAPE">Yape</option>
                      <option value="PLIN">Plin</option>
                      <option value="TRANSFERENCIA">Transferencia</option>
                      <option value="DEPOSITO">Depósito en cuenta</option>
                    </select>
                  ) : (
                    <div className="mt-2 space-y-2">
                      {form.pagos.map((pago, index) => (
                        <div key={pago.id} className="flex items-center gap-2">
                          <select
                            value={pago.metodo}
                            onChange={(event) => setForm((prev) => ({
                              ...prev,
                              pagos: prev.pagos.map((p, i) => (i === index ? { ...p, metodo: event.target.value } : p)),
                            }))}
                            className="field bg-white"
                          >
                            <option value="EFECTIVO">Efectivo</option>
                            <option value="TARJETA">Tarjeta</option>
                            <option value="YAPE">Yape</option>
                            <option value="PLIN">Plin</option>
                            <option value="TRANSFERENCIA">Transferencia</option>
                            <option value="DEPOSITO">Depósito en cuenta</option>
                          </select>
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            placeholder="Monto"
                            value={pago.monto}
                            onChange={(event) => setForm((prev) => ({
                              ...prev,
                              pagos: prev.pagos.map((p, i) => (i === index ? { ...p, monto: event.target.value } : p)),
                            }))}
                            className="field w-28 bg-white"
                          />
                          {form.pagos.length > 1 && (
                            <button
                              type="button"
                              onClick={() => setForm((prev) => ({ ...prev, pagos: prev.pagos.filter((_, i) => i !== index) }))}
                              className="text-xs font-semibold text-danger-600"
                            >✕</button>
                          )}
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => setForm((prev) => ({ ...prev, pagos: [...prev.pagos, createInitialPago()] }))}
                        className="text-xs font-semibold text-brand-700"
                      >+ Agregar método</button>
                      {(() => {
                        const asignado = form.pagos.reduce((sum, p) => sum + (Number(p.monto) || 0), 0)
                        const diferencia = Math.round((total - asignado) * 100) / 100
                        if (Math.abs(diferencia) <= 0.01) {
                          return <p className="text-xs font-semibold text-brand-700">Los montos cuadran con el total.</p>
                        }
                        return (
                          <p className="text-xs font-semibold text-amber-700">
                            {diferencia > 0 ? `Falta asignar S/ ${diferencia.toFixed(2)}` : `Sobra S/ ${Math.abs(diferencia).toFixed(2)}`}
                          </p>
                        )
                      })()}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <p className="text-sm font-medium text-ink-700">Productos adicionales</p>
                <div className="mt-3 space-y-4">
                  {form.items.map((item, index) => (
                    <div key={item.id} className="rounded-3xl border border-ink-200 bg-ink-50 p-4">
                      <div className="grid gap-4 sm:grid-cols-[1.2fr_0.9fr_0.9fr]">
                        <div>
                          <label htmlFor={`factura-item-${item.id}-producto`} className="block text-sm font-medium text-ink-700">Producto o tratamiento</label>
                          <SearchSelect
                            id={`factura-item-${item.id}-producto`}
                            value={item.productoId ? `p:${item.productoId}` : item.tratamientoId ? `t:${item.tratamientoId}` : ''}
                            onChange={(value) => selectItem(index, value)}
                            placeholder="Item manual"
                            options={[
                              ...productos.map((producto) => ({ value: `p:${producto.id}`, label: `${producto.nombre} · stock ${producto.stock}`, group: 'Productos' })),
                              ...tratamientos.map((tratamiento) => ({ value: `t:${tratamiento.id}`, label: tratamiento.nombre, group: 'Tratamientos' })),
                            ]}
                          />
                        </div>
                        <div>
                          <label htmlFor={`factura-item-${item.id}-cantidad`} className="block text-sm font-medium text-ink-700">Cantidad</label>
                          <input
                            id={`factura-item-${item.id}-cantidad`}
                            type="number"
                            min={1}
                            value={item.cantidad}
                            onChange={(event) => updateItem(index, { cantidad: Number(event.target.value) || 1 })}
                            className="field mt-2 bg-white"
                          />
                        </div>
                        <div>
                          <label htmlFor={`factura-item-${item.id}-precio`} className="block text-sm font-medium text-ink-700">Precio unitario</label>
                          <input
                            id={`factura-item-${item.id}-precio`}
                            type="number"
                            min={0}
                            value={item.precioUnit}
                            onChange={(event) => updateItem(index, { precioUnit: Number(event.target.value) || 0 })}
                            className="field mt-2 bg-white"
                          />
                        </div>
                      </div>
                      <div className="mt-3 grid gap-4 sm:grid-cols-2">
                        <div>
                          <label htmlFor={`factura-item-${item.id}-comision`} className="block text-sm font-medium text-ink-700">Comisión S/ (opcional)</label>
                          <input
                            id={`factura-item-${item.id}-comision`}
                            type="number"
                            min={0}
                            step="0.01"
                            value={item.comision}
                            onChange={(event) => updateItem(index, { comision: event.target.value })}
                            placeholder="0.00"
                            className="field mt-2 bg-white"
                          />
                        </div>
                        {Number(item.comision) > 0 && (
                          <div>
                            <label htmlFor={`factura-item-${item.id}-odontologo`} className="block text-sm font-medium text-ink-700">Comisiona a</label>
                            <select
                              id={`factura-item-${item.id}-odontologo`}
                              value={item.odontologoId}
                              onChange={(event) => updateItem(index, { odontologoId: event.target.value })}
                              className="field mt-2 bg-white"
                            >
                              <option value="">Selecciona</option>
                              {odontologos.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
                            </select>
                          </div>
                        )}
                      </div>
                      <div className="mt-3 flex items-center justify-between gap-4 text-sm text-ink-500">
                        <p>Total: S/ {(item.cantidad * item.precioUnit).toFixed(2)}</p>
                        {form.items.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(index)}
                            className="text-danger-600 underline"
                          >Eliminar</button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={handleAddItem}
                className="rounded-3xl border border-ink-200 bg-ink-100 px-4 py-3 text-sm font-semibold text-ink-900 hover:bg-ink-200"
              >Agregar otro item</button>

              <div className="rounded-3xl bg-ink-50 p-5">
                <div className="flex items-center justify-between text-sm text-ink-500">
                  <span>Subtotal</span>
                  <span>S/ {subtotal.toFixed(2)}</span>
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-dashed border-ink-100 pt-4">
                  <span className="text-[15px] font-extrabold text-ink-800">Total</span>
                  <span className="page-heading text-2xl">S/ {total.toFixed(2)}</span>
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  disabled={submitting || !form.pacienteId || subtotal === 0 || pagosDescuadrados}
                  onClick={() => void handleSubmit()}
                  className="btn-brand flex flex-1 items-center justify-center gap-2 disabled:opacity-60"
                >
                  {submitting && <Spinner />}
                  {submitting ? 'Registrando...' : 'Cobrar y emitir comprobante'}
                </button>
                {(pendientes.length > 0 || atencionIdOrigen) && (
                  <button
                    type="button"
                    disabled={guardandoPendiente}
                    onClick={() => void handleGuardarPendiente()}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-amber-300 px-5 py-2.5 text-sm font-semibold text-amber-800 transition hover:bg-amber-50 disabled:opacity-60"
                  >
                    {guardandoPendiente && <Spinner />}
                    {guardandoPendiente ? 'Guardando...' : 'Guardar como pendiente (otro tratamiento)'}
                  </button>
                )}
              </div>
            </div>
              </div>
            </div>
          )}

          <div className="card-surface">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <h2 className="text-xl font-bold text-ink-800">Facturas del día</h2>
              <div className="flex items-center gap-3">
                <input
                  type="date"
                  value={fechaFactura}
                  onChange={(event) => setFechaFactura(event.target.value)}
                  className="field"
                />
                <button
                  type="button"
                  onClick={() => setMostrarFormulario(true)}
                  className="rounded-full bg-brand-700 px-5 py-2 text-sm font-bold text-white transition hover:brightness-110"
                >
                  + Nueva factura
                </button>
              </div>
            </div>

            <input
              value={busquedaFactura}
              onChange={(event) => setBusquedaFactura(event.target.value)}
              placeholder="Buscar por número de comprobante o paciente..."
              className="field mt-4"
            />

            <div className="mt-6 space-y-4">
              {recentInvoices}
            </div>

            <Pagination page={paginaFacturaActual} totalPages={totalPaginasFactura} onChange={setPaginaFactura} />
          </div>
        </div>
      </div>
    </div>
  )
}

export default function FacturacionPage() {
  return (
    <Suspense fallback={<div className="page-shell" />}>
      <FacturacionContent />
    </Suspense>
  )
}
