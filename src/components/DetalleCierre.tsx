'use client'

import { useEffect, useState } from 'react'
import { Modal } from '@/components/Modal'
import { Spinner } from '@/components/Spinner'

export interface CierreResumen {
  id: string
  fechaInicio: string
  fechaFin: string
  totalVentas: number
  totalGastos: number
  usuarioNombre: string
}

interface GastoCierre {
  id: string
  concepto: string
  monto: number
  odontologo?: { name: string } | null
}

const metodoLabels: Record<string, string> = {
  EFECTIVO: 'Efectivo',
  TARJETA: 'POS',
  YAPE: 'Yape',
  PLIN: 'Plin',
  TRANSFERENCIA: 'Transferencia',
  DEPOSITO: 'Depósito',
}

interface FacturaDetalle {
  id: string
  tipo: string
  numeracionComprobante: string | null
  metodoPago: string
  total: number
  creadoAt: string
  paciente: { id: string; nombre: string }
  items: { id: string; nombre: string; cantidad: number; precioUnit: number; total: number }[]
  atencionTratamientos: {
    id: string
    horaInicio: string | null
    horaFin: string | null
    precio: number | null
    tratamiento: { nombre: string }
    odontologo: { name: string }
    atencion: { consultorio: { nombre: string } | null }
  }[]
}

function hora(fecha: string | null) {
  return fecha ? new Date(fecha).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }) : '—'
}

export function DetalleCierre({ cierre, onClose }: { cierre: CierreResumen; onClose: () => void }) {
  const [facturas, setFacturas] = useState<FacturaDetalle[] | null>(null)
  const [gastos, setGastos] = useState<GastoCierre[]>([])

  useEffect(() => {
    fetch(`/api/cierres/${cierre.id}`)
      .then((res) => res.json())
      .then((data) => {
        setFacturas(Array.isArray(data?.facturas) ? data.facturas : [])
        setGastos(Array.isArray(data?.gastos) ? data.gastos : [])
      })
  }, [cierre.id])

  const totalAtenciones = facturas?.reduce((sum, f) => sum + f.atencionTratamientos.length, 0) ?? 0

  return (
    <Modal title={`Detalle del cierre · ${cierre.usuarioNombre}`} size="lg" onClose={onClose}>
      <p className="mt-1 text-sm text-ink-500">
        {new Date(cierre.fechaInicio).toLocaleString('es-PE')} → {new Date(cierre.fechaFin).toLocaleString('es-PE')}
      </p>
      {!facturas ? (
        <p className="mt-6 flex items-center gap-2 text-sm text-ink-500"><Spinner /> Cargando detalle...</p>
      ) : facturas.length === 0 ? (
        <p className="mt-6 text-sm text-ink-500">Este cierre no tiene comprobantes asociados.</p>
      ) : (
        <div className="mt-4 space-y-4">
          <p className="text-sm font-semibold text-ink-700">
            {facturas.length} comprobante(s) · {totalAtenciones} tratamiento(s) · Total S/ {cierre.totalVentas.toFixed(2)}
          </p>
          {gastos.length > 0 && (
            <div className="rounded-3xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm font-semibold text-amber-900">Gastos del turno · S/ {cierre.totalGastos.toFixed(2)}</p>
              <ul className="mt-2 space-y-0.5 text-xs text-amber-900">
                {gastos.map((gasto) => (
                  <li key={gasto.id} className="flex justify-between gap-3">
                    <span>{gasto.concepto}</span>
                    <span>S/ {gasto.monto.toFixed(2)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {facturas.map((factura) => (
            <div key={factura.id} className="rounded-3xl border border-ink-200 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-semibold text-ink-900">{factura.paciente.nombre}</p>
                  <p className="text-xs text-ink-500">
                    {new Date(factura.creadoAt).toLocaleString('es-PE')} · {factura.tipo.replace('_', ' ')}
                    {factura.numeracionComprobante ? ` ${factura.numeracionComprobante}` : ''} · {metodoLabels[factura.metodoPago] || factura.metodoPago}
                  </p>
                </div>
                <p className="text-lg font-semibold text-brand-900">S/ {factura.total.toFixed(2)}</p>
              </div>

              {factura.atencionTratamientos.length > 0 && (
                <div className="mt-3 overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead className="text-xs uppercase tracking-wide text-ink-400">
                      <tr><th className="py-1 pr-4">Tratamiento</th><th className="py-1 pr-4">Odontólogo</th><th className="py-1 pr-4">Consultorio</th><th className="py-1 pr-4">Horario</th><th className="py-1 text-right">Precio</th></tr>
                    </thead>
                    <tbody className="text-ink-700">
                      {factura.atencionTratamientos.map((linea) => (
                        <tr key={linea.id} className="border-t border-ink-100">
                          <td className="py-1.5 pr-4">{linea.tratamiento.nombre}</td>
                          <td className="py-1.5 pr-4">{linea.odontologo.name}</td>
                          <td className="py-1.5 pr-4">{linea.atencion.consultorio?.nombre ?? '—'}</td>
                          <td className="py-1.5 pr-4">{hora(linea.horaInicio)} - {hora(linea.horaFin)}</td>
                          <td className="py-1.5 text-right">{linea.precio != null ? `S/ ${linea.precio.toFixed(2)}` : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <ul className="mt-3 space-y-0.5 border-t border-ink-100 pt-2 text-xs text-ink-500">
                {factura.items.map((item) => (
                  <li key={item.id} className="flex justify-between gap-3">
                    <span>{item.cantidad} × {item.nombre} (S/ {item.precioUnit.toFixed(2)})</span>
                    <span>S/ {item.total.toFixed(2)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </Modal>
  )
}
