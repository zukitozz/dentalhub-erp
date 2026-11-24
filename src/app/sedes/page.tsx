'use client'

import { useCallback, useEffect, useState } from 'react'
import { Spinner } from '@/components/Spinner'
import { useToast } from '@/components/Toast'

interface Sede { id: string; nombre: string; direccion: string | null }
interface Serie { id: string; tipoComprobante: string; serie: string; estado: number; codigoProposito: string }
interface FilaTratamiento { id: string; nombre: string; categoria: string | null; precio: number; precioSede: number | null; activoSede: boolean }
interface FilaProducto { id: string; nombre: string; precioVenta: number; precioSede: number | null }

const TIPOS_SERIE: { codigo: string; nombre: string; prefijo: string }[] = [
  { codigo: '03', nombre: 'Boleta', prefijo: 'B' },
  { codigo: '01', nombre: 'Factura', prefijo: 'F' },
  { codigo: '07', nombre: 'Nota de crédito', prefijo: 'FC/BC' },
  { codigo: '08', nombre: 'Nota de débito', prefijo: 'FD/BD' },
  { codigo: '50', nombre: 'Nota de despacho', prefijo: 'ND' },
  { codigo: '51', nombre: 'Nota de venta', prefijo: 'NV' },
]
const nombreTipo = (codigo: string) => TIPOS_SERIE.find((t) => t.codigo === codigo)?.nombre ?? codigo

const soles = (n: number) => `S/ ${n.toFixed(2)}`

export default function SedesPage() {
  const toast = useToast()
  const [sedes, setSedes] = useState<Sede[]>([])
  const [sedeId, setSedeId] = useState('')
  const [cargando, setCargando] = useState(true)
  const [nueva, setNueva] = useState({ nombre: '', direccion: '' })
  const [series, setSeries] = useState<Serie[]>([])
  const [nuevaSerie, setNuevaSerie] = useState({ tipoComprobante: '03', serie: '' })
  const [tratamientos, setTratamientos] = useState<FilaTratamiento[]>([])
  const [productos, setProductos] = useState<FilaProducto[]>([])

  const cargarSedes = useCallback(async () => {
    const data = await fetch('/api/sedes').then((r) => r.json())
    setSedes(Array.isArray(data) ? data : [])
    setSedeId((actual) => actual || data?.[0]?.id || '')
    setCargando(false)
  }, [])

  const cargarSede = useCallback(async (id: string) => {
    if (!id) return
    const [s, p] = await Promise.all([
      fetch(`/api/sedes/series?sedeId=${id}`).then((r) => r.json()),
      fetch(`/api/sedes/precios?sedeId=${id}`).then((r) => r.json()),
    ])
    setSeries(Array.isArray(s) ? s : [])
    setTratamientos(p.tratamientos ?? [])
    setProductos(p.productos ?? [])
  }, [])

  useEffect(() => { void cargarSedes() }, [cargarSedes])
  useEffect(() => { void cargarSede(sedeId) }, [sedeId, cargarSede])

  const crearSede = async () => {
    const res = await fetch('/api/sedes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(nueva) })
    const data = await res.json()
    if (!res.ok) return toast.error(data.error || 'No se pudo crear la sede')
    setNueva({ nombre: '', direccion: '' })
    setSedeId(data.id)
    await cargarSedes()
    toast.success('Sede creada')
  }

  const agregarSerie = async () => {
    const res = await fetch('/api/sedes/series', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...nuevaSerie, sedeId }) })
    const data = await res.json()
    if (!res.ok) return toast.error(data.error || 'No se pudo habilitar la serie')
    setNuevaSerie({ ...nuevaSerie, serie: '' })
    await cargarSede(sedeId)
    toast.success('Serie habilitada')
  }

  const alternarSerie = async (serie: Serie) => {
    await fetch('/api/sedes/series', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: serie.id, estado: serie.estado !== 1 }) })
    await cargarSede(sedeId)
  }

  const guardarPrecio = async (tipo: 'tratamiento' | 'producto', id: string, precio: string, activo?: boolean) => {
    const res = await fetch('/api/sedes/precios', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sedeId, tipo, id, precio: precio === '' ? null : Number(precio), activo }),
    })
    if (!res.ok) return toast.error('No se pudo guardar el precio')
    toast.success('Guardado')
    await cargarSede(sedeId)
  }

  if (cargando) return <div className="flex justify-center py-20"><Spinner /></div>
  const sede = sedes.find((s) => s.id === sedeId)

  return (
    <main className="page-shell px-4 py-8 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="card-surface">
          <p className="eyebrow">Administración</p>
          <h1 className="mt-3 page-heading text-3xl">Sedes, series y precios</h1>
          <p className="mt-2 text-ink-600">Una misma razón social con varias sedes: cada sede tiene sus series de comprobantes, sus precios y sus tratamientos disponibles. El catálogo es único.</p>
        </div>

        <div className="card-surface space-y-4">
          <h2 className="text-xl font-semibold text-brand-900">Sedes</h2>
          <div className="flex flex-wrap gap-2">
            {sedes.map((s) => (
              <button key={s.id} type="button" onClick={() => setSedeId(s.id)} className={`rounded-full border px-4 py-2 text-sm font-semibold ${s.id === sedeId ? 'border-brand-700 bg-brand-700 text-white' : 'border-ink-300 text-ink-700'}`}>
                {s.nombre}
              </button>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
            <input aria-label="Nombre de la nueva sede" placeholder="Nombre de la nueva sede" value={nueva.nombre} onChange={(e) => setNueva({ ...nueva, nombre: e.target.value })} className="field" />
            <input aria-label="Dirección" placeholder="Dirección (opcional)" value={nueva.direccion} onChange={(e) => setNueva({ ...nueva, direccion: e.target.value })} className="field" />
            <button type="button" onClick={() => void crearSede()} disabled={!nueva.nombre.trim()} className="btn-brand disabled:opacity-50">Crear sede</button>
          </div>
        </div>

        {sede && (
          <>
            <div className="card-surface space-y-4">
              <h2 className="text-xl font-semibold text-brand-900">Series de comprobantes · {sede.nombre}</h2>
              <p className="text-sm text-ink-500">Cada sede emite con su propia serie (por ejemplo F001 en una sede y F002 en la otra). Si una sede no tiene serie propia, se usa la general.</p>
              <div className="flex flex-wrap gap-2">
                {series.length === 0 && <p className="text-sm text-ink-500">Esta sede aún no tiene series habilitadas.</p>}
                {series.map((s) => (
                  <button key={s.id} type="button" onClick={() => void alternarSerie(s)} title="Clic para habilitar o deshabilitar" className={`rounded-full border px-3 py-1.5 text-sm ${s.estado === 1 ? 'border-brand-600 bg-brand-50 text-brand-800' : 'border-ink-300 text-ink-400 line-through'}`}>
                    {nombreTipo(s.tipoComprobante)} · {s.serie}
                  </button>
                ))}
              </div>
              <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
                <select aria-label="Tipo de comprobante" value={nuevaSerie.tipoComprobante} onChange={(e) => setNuevaSerie({ ...nuevaSerie, tipoComprobante: e.target.value })} className="field">
                  {TIPOS_SERIE.map((t) => <option key={t.codigo} value={t.codigo}>{t.nombre}</option>)}
                </select>
                <input aria-label="Serie (3 dígitos)" placeholder="Serie de 3 dígitos, ej. 002" maxLength={3} value={nuevaSerie.serie} onChange={(e) => setNuevaSerie({ ...nuevaSerie, serie: e.target.value.replace(/\D/g, '') })} className="field" />
                <button type="button" onClick={() => void agregarSerie()} disabled={nuevaSerie.serie.length !== 3} className="btn-brand disabled:opacity-50">Habilitar serie</button>
              </div>
            </div>

            <div className="card-surface space-y-3">
              <h2 className="text-xl font-semibold text-brand-900">Tratamientos · {sede.nombre}</h2>
              <p className="text-sm text-ink-500">Deja el precio vacío para usar el precio base. Desactiva los tratamientos que esta sede no ofrece.</p>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead><tr className="text-ink-500"><th className="py-2 pr-4">Tratamiento</th><th className="py-2 pr-4 text-right">Precio base</th><th className="py-2 pr-4">Precio en esta sede</th><th className="py-2">Disponible</th></tr></thead>
                  <tbody>
                    {tratamientos.map((t) => (
                      <tr key={t.id} className="border-t border-ink-50">
                        <td className="py-2 pr-4">{t.nombre}{t.categoria ? <span className="ml-2 text-xs text-ink-400">{t.categoria}</span> : null}</td>
                        <td className="py-2 pr-4 text-right text-ink-600">{soles(t.precio)}</td>
                        <td className="py-2 pr-4">
                          <input key={`${sedeId}-${t.id}-${t.precioSede}`} type="number" min={0} step="0.01" defaultValue={t.precioSede ?? ''} placeholder="= base" aria-label={`Precio de ${t.nombre}`} onBlur={(e) => { if (e.target.value !== String(t.precioSede ?? '')) void guardarPrecio('tratamiento', t.id, e.target.value, t.activoSede) }} className="field w-32" />
                        </td>
                        <td className="py-2"><input type="checkbox" checked={t.activoSede} aria-label={`${t.nombre} disponible`} onChange={(e) => void guardarPrecio('tratamiento', t.id, t.precioSede == null ? '' : String(t.precioSede), e.target.checked)} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="card-surface space-y-3">
              <h2 className="text-xl font-semibold text-brand-900">Productos · {sede.nombre}</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead><tr className="text-ink-500"><th className="py-2 pr-4">Producto</th><th className="py-2 pr-4 text-right">Precio base</th><th className="py-2">Precio en esta sede</th></tr></thead>
                  <tbody>
                    {productos.map((p) => (
                      <tr key={p.id} className="border-t border-ink-50">
                        <td className="py-2 pr-4">{p.nombre}</td>
                        <td className="py-2 pr-4 text-right text-ink-600">{soles(p.precioVenta)}</td>
                        <td className="py-2">
                          <input key={`${sedeId}-${p.id}-${p.precioSede}`} type="number" min={0} step="0.01" defaultValue={p.precioSede ?? ''} placeholder="= base" aria-label={`Precio de ${p.nombre}`} onBlur={(e) => { if (e.target.value !== String(p.precioSede ?? '')) void guardarPrecio('producto', p.id, e.target.value) }} className="field w-32" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  )
}
