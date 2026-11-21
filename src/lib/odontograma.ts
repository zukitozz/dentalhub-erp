// Odontograma en notación FDI (ISO 3950). Compartido entre cliente y servidor.

export const PERMANENTES_SUP = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28]
export const PERMANENTES_INF = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38]
export const TEMPORALES_SUP = [55, 54, 53, 52, 51, 61, 62, 63, 64, 65]
export const TEMPORALES_INF = [85, 84, 83, 82, 81, 71, 72, 73, 74, 75]

export const TODAS_LAS_PIEZAS = [...PERMANENTES_SUP, ...PERMANENTES_INF, ...TEMPORALES_SUP, ...TEMPORALES_INF]

export function esPiezaValida(pieza: number) {
  return TODAS_LAS_PIEZAS.includes(pieza)
}

/** Superficies de la pieza: V vestibular, L lingual/palatina, M mesial, D distal, O oclusal/incisal. */
export const SUPERFICIES = [
  { codigo: 'V', nombre: 'Vestibular' },
  { codigo: 'L', nombre: 'Lingual / Palatina' },
  { codigo: 'M', nombre: 'Mesial' },
  { codigo: 'D', nombre: 'Distal' },
  { codigo: 'O', nombre: 'Oclusal / Incisal' },
] as const

export type SuperficieCodigo = (typeof SUPERFICIES)[number]['codigo']

export interface CondicionDental {
  codigo: string
  nombre: string
  /** true: se marca por superficie; false: afecta a toda la pieza. */
  porSuperficie: boolean
  color: string
}

export const CONDICIONES: CondicionDental[] = [
  { codigo: 'CARIES', nombre: 'Caries', porSuperficie: true, color: '#dc2626' },
  { codigo: 'OBTURACION', nombre: 'Obturación / resina', porSuperficie: true, color: '#2563eb' },
  { codigo: 'SELLANTE', nombre: 'Sellante', porSuperficie: true, color: '#16a34a' },
  { codigo: 'FRACTURA', nombre: 'Fractura', porSuperficie: true, color: '#ea580c' },
  { codigo: 'DESGASTE', nombre: 'Desgaste / abrasión', porSuperficie: true, color: '#a16207' },
  { codigo: 'CORONA', nombre: 'Corona', porSuperficie: false, color: '#2563eb' },
  { codigo: 'ENDODONCIA', nombre: 'Endodoncia (tto. de conductos)', porSuperficie: false, color: '#7c3aed' },
  { codigo: 'IMPLANTE', nombre: 'Implante', porSuperficie: false, color: '#0f766e' },
  { codigo: 'PROTESIS_FIJA', nombre: 'Prótesis fija / puente', porSuperficie: false, color: '#0369a1' },
  { codigo: 'REMANENTE', nombre: 'Remanente radicular', porSuperficie: false, color: '#b91c1c' },
  { codigo: 'MOVILIDAD', nombre: 'Movilidad', porSuperficie: false, color: '#c2410c' },
  { codigo: 'EXTRACCION', nombre: 'Extracción indicada', porSuperficie: false, color: '#dc2626' },
  { codigo: 'AUSENTE', nombre: 'Ausente', porSuperficie: false, color: '#475569' },
  { codigo: 'SANO', nombre: 'Sano', porSuperficie: false, color: '#10869c' },
]

export const CONDICION_POR_CODIGO = Object.fromEntries(CONDICIONES.map((c) => [c.codigo, c])) as Record<string, CondicionDental>

export const ESTADOS_HALLAZGO = [
  { codigo: 'EXISTENTE', nombre: 'Existente (diagnóstico)' },
  { codigo: 'PLANIFICADO', nombre: 'Planificado (por realizar)' },
  { codigo: 'REALIZADO', nombre: 'Realizado' },
] as const

export function nombrePieza(pieza: number) {
  const unidad = pieza % 10
  const cuadrante = Math.floor(pieza / 10)
  const temporal = cuadrante >= 5
  const permanentes: Record<number, string> = {
    1: 'incisivo central', 2: 'incisivo lateral', 3: 'canino', 4: 'primer premolar',
    5: 'segundo premolar', 6: 'primer molar', 7: 'segundo molar', 8: 'tercer molar',
  }
  const temporales: Record<number, string> = {
    1: 'incisivo central', 2: 'incisivo lateral', 3: 'canino', 4: 'primer molar', 5: 'segundo molar',
  }
  const nombre = (temporal ? temporales : permanentes)[unidad] ?? 'pieza'
  const lado = [1, 2, 5, 6].includes(cuadrante) ? 'superior' : 'inferior'
  const derecha = [1, 4, 5, 8].includes(cuadrante) ? 'derecho' : 'izquierdo'
  return `${nombre} ${lado} ${derecha}${temporal ? ' (temporal)' : ''}`
}
