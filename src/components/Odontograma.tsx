'use client'

import {
  CONDICION_POR_CODIGO,
  PERMANENTES_INF,
  PERMANENTES_SUP,
  TEMPORALES_INF,
  TEMPORALES_SUP,
} from '@/lib/odontograma'

export interface Hallazgo {
  id: string
  pieza: number
  superficie: string | null
  condicion: string
  estado: 'EXISTENTE' | 'PLANIFICADO' | 'REALIZADO'
  notas: string | null
  creadoAt: string
  odontologo?: { id: string; name: string } | null
}

export const COLOR_PLANIFICADO = '#f59e0b'
export const COLOR_REALIZADO = '#2563eb'

/** Color con el que se pinta un hallazgo: planificado (ámbar), realizado (azul) o el propio de la condición. */
export function colorHallazgo(h: Pick<Hallazgo, 'condicion' | 'estado'>) {
  if (h.estado === 'PLANIFICADO') return COLOR_PLANIFICADO
  if (h.estado === 'REALIZADO') return COLOR_REALIZADO
  return CONDICION_POR_CODIGO[h.condicion]?.color ?? '#64748b'
}

const LADO = 34

function Diente({
  pieza,
  hallazgos,
  seleccionada,
  onSelect,
}: {
  pieza: number
  hallazgos: Hallazgo[]
  seleccionada: boolean
  onSelect: (pieza: number) => void
}) {
  const cuadrante = Math.floor(pieza / 10)
  // En la mitad izquierda del gráfico (cuadrantes 1, 4, 5, 8) la línea media queda a la derecha del diente.
  const mesialDerecha = [1, 4, 5, 8].includes(cuadrante)
  const m = LADO * 0.28
  const a = LADO
  const poligonos: Record<string, string> = {
    V: `0,0 ${a},0 ${a - m},${m} ${m},${m}`,
    L: `0,${a} ${a},${a} ${a - m},${a - m} ${m},${a - m}`,
    I: `0,0 ${m},${m} ${m},${a - m} 0,${a}`,
    R: `${a},0 ${a},${a} ${a - m},${a - m} ${a - m},${m}`,
    O: `${m},${m} ${a - m},${m} ${a - m},${a - m} ${m},${a - m}`,
  }
  // Superficie M/D según el lado en que cae la línea media.
  const clave: Record<string, string> = { V: 'V', L: 'L', O: 'O', M: mesialDerecha ? 'R' : 'I', D: mesialDerecha ? 'I' : 'R' }

  const piezaCompleta = hallazgos.filter((h) => h.superficie === null)
  const ausente = piezaCompleta.some((h) => h.condicion === 'AUSENTE')
  const porSuperficie = hallazgos.filter((h) => h.superficie !== null)

  return (
    <button
      type="button"
      onClick={() => onSelect(pieza)}
      aria-label={`Pieza ${pieza}`}
      aria-pressed={seleccionada}
      className={`flex flex-col items-center gap-0.5 rounded-lg p-1 transition ${seleccionada ? 'bg-brand-100 ring-2 ring-brand-500' : 'hover:bg-ink-100'}`}
    >
      <span className="text-[10px] font-bold text-ink-500">{pieza}</span>
      <svg width={LADO} height={LADO} viewBox={`0 0 ${LADO} ${LADO}`} className={ausente ? 'opacity-40' : ''}>
        {Object.entries(poligonos).map(([k, puntos]) => {
          const h = [...porSuperficie].reverse().find((x) => clave[x.superficie as string] === k)
          return <polygon key={k} points={puntos} fill={h ? colorHallazgo(h) : '#fff'} stroke="#94a3b8" strokeWidth="1" />
        })}
        {piezaCompleta.map((h) => {
          const color = colorHallazgo(h)
          switch (h.condicion) {
            case 'AUSENTE':
            case 'EXTRACCION':
              return (
                <g key={h.id} stroke={h.condicion === 'AUSENTE' && h.estado === 'EXISTENTE' ? '#475569' : color} strokeWidth="2.5" strokeLinecap="round">
                  <line x1="3" y1="3" x2={LADO - 3} y2={LADO - 3} />
                  <line x1={LADO - 3} y1="3" x2="3" y2={LADO - 3} />
                </g>
              )
            case 'CORONA':
              return <circle key={h.id} cx={LADO / 2} cy={LADO / 2} r={LADO / 2 - 1.5} fill="none" stroke={color} strokeWidth="2.5" />
            case 'ENDODONCIA':
              return <line key={h.id} x1={LADO / 2} y1="2" x2={LADO / 2} y2={LADO - 2} stroke={color} strokeWidth="3" strokeLinecap="round" />
            case 'PROTESIS_FIJA':
              return <line key={h.id} x1="1" y1={LADO / 2} x2={LADO - 1} y2={LADO / 2} stroke={color} strokeWidth="3" />
            case 'FRACTURA':
              return <line key={h.id} x1="4" y1={LADO - 4} x2={LADO - 4} y2="4" stroke={color} strokeWidth="2" />
            default:
              return (
                <text key={h.id} x={LADO / 2} y={LADO / 2 + 4} textAnchor="middle" fontSize="11" fontWeight="800" fill={color}>
                  {h.condicion === 'IMPLANTE' ? 'I' : h.condicion === 'REMANENTE' ? 'RR' : h.condicion === 'MOVILIDAD' ? 'M' : h.condicion === 'SANO' ? '✓' : '•'}
                </text>
              )
          }
        })}
      </svg>
    </button>
  )
}

function Arcada({ piezas, hallazgos, seleccionada, onSelect }: { piezas: number[]; hallazgos: Hallazgo[]; seleccionada: number | null; onSelect: (p: number) => void }) {
  const mitad = piezas.length / 2
  return (
    <div className="flex items-end justify-center">
      {piezas.map((p, i) => (
        <div key={p} className={i === mitad ? 'ml-2 border-l-2 border-ink-200 pl-2' : ''}>
          <Diente pieza={p} hallazgos={hallazgos.filter((h) => h.pieza === p)} seleccionada={seleccionada === p} onSelect={onSelect} />
        </div>
      ))}
    </div>
  )
}

export function Odontograma({ hallazgos, seleccionada, onSelect }: { hallazgos: Hallazgo[]; seleccionada: number | null; onSelect: (pieza: number) => void }) {
  return (
    <div className="overflow-x-auto">
      <div className="mx-auto w-max space-y-3 py-2">
        <p className="text-center text-[10px] font-extrabold uppercase tracking-[0.2em] text-ink-400">Dentición permanente</p>
        <Arcada piezas={PERMANENTES_SUP} hallazgos={hallazgos} seleccionada={seleccionada} onSelect={onSelect} />
        <Arcada piezas={PERMANENTES_INF} hallazgos={hallazgos} seleccionada={seleccionada} onSelect={onSelect} />
        <p className="pt-2 text-center text-[10px] font-extrabold uppercase tracking-[0.2em] text-ink-400">Dentición temporal</p>
        <Arcada piezas={TEMPORALES_SUP} hallazgos={hallazgos} seleccionada={seleccionada} onSelect={onSelect} />
        <Arcada piezas={TEMPORALES_INF} hallazgos={hallazgos} seleccionada={seleccionada} onSelect={onSelect} />
      </div>
    </div>
  )
}
