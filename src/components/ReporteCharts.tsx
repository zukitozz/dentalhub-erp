'use client'

import { useMemo, useRef, useState } from 'react'

// Paleta validada (slots 1 y 2: azul / naranja). Gastos = naranja en todos los gráficos.
export const COLOR_INGRESOS = '#257de0'
export const COLOR_GASTOS = '#f47230'

export interface PuntoDia { fecha: string; ingresos: number; gastos: number }

const soles = (n: number) => `S/ ${n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const compacto = (n: number) => (n >= 1000 ? `${(n / 1000).toLocaleString('es-PE', { maximumFractionDigits: 1 })}k` : String(Math.round(n)))

/** Máximo "redondo" del eje (1, 2, 5 × 10^n) y su paso. */
function escala(max: number) {
  if (max <= 0) return { tope: 100, paso: 25 }
  const bruto = max / 4
  const magnitud = 10 ** Math.floor(Math.log10(bruto))
  const norm = bruto / magnitud
  const paso = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10) * magnitud
  return { tope: Math.ceil(max / paso) * paso, paso }
}

const W = 720
const H = 260
const M = { l: 48, r: 14, t: 14, b: 28 }

export function GraficoDiario({ datos }: { datos: PuntoDia[] }) {
  const [hover, setHover] = useState<number | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  const { tope, paso } = useMemo(() => escala(Math.max(0, ...datos.flatMap((d) => [d.ingresos, d.gastos]))), [datos])
  const n = datos.length
  const x = (i: number) => M.l + (n <= 1 ? 0 : (i * (W - M.l - M.r)) / (n - 1))
  const y = (v: number) => H - M.b - (v / tope) * (H - M.t - M.b)
  const linea = (clave: 'ingresos' | 'gastos') => datos.map((d, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(d[clave]).toFixed(1)}`).join(' ')
  const ticks = Array.from({ length: Math.round(tope / paso) + 1 }, (_, i) => i * paso)
  const cadaX = n > 20 ? 5 : n > 10 ? 2 : 1

  const alMover = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect || n === 0) return
    const px = ((e.clientX - rect.left) / rect.width) * W
    const i = Math.round(((px - M.l) / (W - M.l - M.r)) * (n - 1))
    setHover(Math.min(n - 1, Math.max(0, i)))
  }

  const punto = hover !== null ? datos[hover] : null
  const izquierda = hover !== null && hover > n / 2

  return (
    <div className="relative">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label="Ingresos y gastos por día del mes"
        onMouseMove={alMover}
        onMouseLeave={() => setHover(null)}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={M.l} x2={W - M.r} y1={y(t)} y2={y(t)} stroke={t === 0 ? '#c2c2c2' : '#e7e7e7'} strokeWidth={1} />
            <text x={M.l - 8} y={y(t) + 4} textAnchor="end" fontSize={11} fill="#666666">{compacto(t)}</text>
          </g>
        ))}
        {datos.map((d, i) => (i % cadaX === 0 || i === n - 1) && (
          <text key={d.fecha} x={x(i)} y={H - 8} textAnchor="middle" fontSize={11} fill="#666666">{Number(d.fecha.slice(8))}</text>
        ))}
        <path d={linea('gastos')} fill="none" stroke={COLOR_GASTOS} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        <path d={linea('ingresos')} fill="none" stroke={COLOR_INGRESOS} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {punto && hover !== null && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={M.t} y2={H - M.b} stroke="#c2c2c2" strokeWidth={1} />
            <circle cx={x(hover)} cy={y(punto.gastos)} r={4} fill={COLOR_GASTOS} stroke="#ffffff" strokeWidth={2} />
            <circle cx={x(hover)} cy={y(punto.ingresos)} r={4} fill={COLOR_INGRESOS} stroke="#ffffff" strokeWidth={2} />
          </g>
        )}
      </svg>
      {punto && hover !== null && (
        <div
          className="pointer-events-none absolute top-2 z-10 min-w-[10rem] rounded-xl border border-ink-100 bg-white px-3 py-2 text-xs shadow-soft"
          style={izquierda ? { right: `${100 - (x(hover) / W) * 100 + 2}%` } : { left: `${(x(hover) / W) * 100 + 2}%` }}
        >
          <p className="font-semibold text-ink-900">{new Date(`${punto.fecha}T12:00:00`).toLocaleDateString('es-PE', { weekday: 'short', day: 'numeric', month: 'short' })}</p>
          <p className="mt-1 flex items-center justify-between gap-4 text-ink-700"><span className="flex items-center gap-1.5"><i className="inline-block h-2 w-2 rounded-full" style={{ background: COLOR_INGRESOS }} />Ingresos</span><b>{soles(punto.ingresos)}</b></p>
          <p className="flex items-center justify-between gap-4 text-ink-700"><span className="flex items-center gap-1.5"><i className="inline-block h-2 w-2 rounded-full" style={{ background: COLOR_GASTOS }} />Gastos</span><b>{soles(punto.gastos)}</b></p>
        </div>
      )}
      <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-ink-600">
        <span className="flex items-center gap-1.5"><i className="inline-block h-0.5 w-4 rounded" style={{ background: COLOR_INGRESOS }} />Ingresos</span>
        <span className="flex items-center gap-1.5"><i className="inline-block h-0.5 w-4 rounded" style={{ background: COLOR_GASTOS }} />Gastos</span>
      </div>
      <details className="mt-3 text-sm print:hidden">
        <summary className="cursor-pointer font-semibold text-brand-700">Ver tabla de datos</summary>
        <div className="mt-2 max-h-64 overflow-y-auto">
          <table className="w-full text-left text-xs">
            <thead><tr className="border-b border-ink-200 text-ink-500"><th className="py-1.5">Día</th><th className="py-1.5 text-right">Ingresos</th><th className="py-1.5 text-right">Gastos</th></tr></thead>
            <tbody>
              {datos.filter((d) => d.ingresos > 0 || d.gastos > 0).map((d) => (
                <tr key={d.fecha} className="border-b border-ink-100"><td className="py-1.5">{d.fecha.slice(8)}/{d.fecha.slice(5, 7)}</td><td className="py-1.5 text-right tabular-nums">{soles(d.ingresos)}</td><td className="py-1.5 text-right tabular-nums">{soles(d.gastos)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  )
}

export interface Barra { etiqueta: string; valor: number }

/** Barras horizontales ordenadas de mayor a menor, con valor y porcentaje directos. */
export function BarrasHorizontales({ datos, color, vacio, formato = soles }: { datos: Barra[]; color: string; vacio: string; formato?: (n: number) => string }) {
  const filas = useMemo(() => [...datos].filter((d) => d.valor > 0).sort((a, b) => b.valor - a.valor), [datos])
  const total = filas.reduce((s, f) => s + f.valor, 0)
  const max = filas[0]?.valor ?? 0
  if (filas.length === 0) return <p className="mt-4 text-sm text-ink-500">{vacio}</p>

  return (
    <ul className="mt-5 space-y-3">
      {filas.map((f) => (
        <li key={f.etiqueta} className="group" title={`${f.etiqueta}: ${formato(f.valor)} (${((f.valor / total) * 100).toFixed(1)}%)`}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate font-medium text-ink-800">{f.etiqueta}</span>
            <span className="shrink-0 tabular-nums text-ink-700"><b>{formato(f.valor)}</b> <span className="text-xs text-ink-500">· {((f.valor / total) * 100).toFixed(0)}%</span></span>
          </div>
          <div className="mt-1 h-2.5 w-full rounded-full bg-ink-100">
            <div className="h-full rounded-r-[4px] rounded-l-full transition-opacity group-hover:opacity-80" style={{ width: `${(f.valor / max) * 100}%`, background: color }} />
          </div>
        </li>
      ))}
    </ul>
  )
}
