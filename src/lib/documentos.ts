// Documentos clínicos (consentimientos, recetas, presupuestos): tipos, variables y plantillas base.
// Módulo puro (sin acceso a base de datos) para poder usarlo en cliente y servidor.

export type DocumentoTipo = 'CONSENTIMIENTO' | 'RECETA' | 'PRESUPUESTO' | 'OTRO'

export const TIPOS_DOCUMENTO: { codigo: DocumentoTipo; nombre: string; plural: string; prefijo: string }[] = [
  { codigo: 'CONSENTIMIENTO', nombre: 'Consentimiento informado', plural: 'Consentimientos', prefijo: 'CON' },
  { codigo: 'RECETA', nombre: 'Receta', plural: 'Recetas', prefijo: 'REC' },
  { codigo: 'PRESUPUESTO', nombre: 'Presupuesto', plural: 'Presupuestos', prefijo: 'PRE' },
  { codigo: 'OTRO', nombre: 'Otro documento', plural: 'Otros', prefijo: 'DOC' },
]

export const NOMBRE_TIPO: Record<string, string> = Object.fromEntries(TIPOS_DOCUMENTO.map((t) => [t.codigo, t.nombre]))
export const PREFIJO_TIPO: Record<string, string> = Object.fromEntries(TIPOS_DOCUMENTO.map((t) => [t.codigo, t.prefijo]))

export interface CampoPlantilla {
  clave: string
  label: string
  tipo: 'texto' | 'area' | 'fecha' | 'numero'
}

export interface Medicamento {
  medicamento: string
  presentacion: string
  dosis: string
  frecuencia: string
  duracion: string
  indicaciones: string
}

export interface LineaPresupuesto {
  descripcion: string
  pieza: string
  cantidad: number
  precioUnit: number
  tratamientoId?: string | null
}

export interface DatosReceta {
  diagnostico: string
  medicamentos: Medicamento[]
}

export interface DatosPresupuesto {
  items: LineaPresupuesto[]
  validezDias: number
}

export interface DatosConsentimiento {
  campos: Record<string, string>
}

export const MEDICAMENTO_VACIO: Medicamento = { medicamento: '', presentacion: '', dosis: '', frecuencia: '', duracion: '', indicaciones: '' }
export const LINEA_VACIA: LineaPresupuesto = { descripcion: '', pieza: '', cantidad: 1, precioUnit: 0 }

export const totalPresupuesto = (items: LineaPresupuesto[]) =>
  Math.round(items.reduce((acc, i) => acc + (Number(i.cantidad) || 0) * (Number(i.precioUnit) || 0), 0) * 100) / 100

/** Variables disponibles en cualquier plantilla. */
export const VARIABLES_BASE: { clave: string; descripcion: string }[] = [
  { clave: 'paciente', descripcion: 'Nombre del paciente' },
  { clave: 'documento', descripcion: 'DNI / CE / RUC del paciente' },
  { clave: 'edad', descripcion: 'Edad del paciente' },
  { clave: 'apoderado', descripcion: 'Apoderado (menores de edad)' },
  { clave: 'fecha', descripcion: 'Fecha de emisión' },
  { clave: 'odontologo', descripcion: 'Odontólogo que atiende' },
  { clave: 'colegiatura', descripcion: 'N.º de colegiatura (COP)' },
  { clave: 'consultorio', descripcion: 'Nombre del consultorio' },
]

export function renderPlantilla(contenido: string, valores: Record<string, string | undefined>): string {
  return contenido.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_m, clave: string) => {
    const valor = valores[clave]
    if (clave.endsWith('_texto')) return valor ?? ''
    return valor && valor.trim() ? valor : '________________'
  })
}

export function edadDesde(fechaNacimiento: string | Date | null | undefined, hoy = new Date()): number | null {
  if (!fechaNacimiento) return null
  const nac = new Date(fechaNacimiento)
  if (Number.isNaN(nac.getTime())) return null
  let edad = hoy.getFullYear() - nac.getUTCFullYear()
  const cumplio = hoy.getMonth() > nac.getUTCMonth() || (hoy.getMonth() === nac.getUTCMonth() && hoy.getDate() >= nac.getUTCDate())
  if (!cumplio) edad -= 1
  return edad
}

export interface PlantillaBase {
  tipo: DocumentoTipo
  nombre: string
  contenido: string
  campos: CampoPlantilla[]
}

const CIERRE_CONSENTIMIENTO = `Declaro que he sido informado(a) de manera clara y comprensible sobre el diagnóstico, el procedimiento propuesto, sus beneficios, riesgos y alternativas, que pude hacer preguntas y que éstas fueron respondidas a mi satisfacción. Entiendo que puedo retirar mi consentimiento en cualquier momento antes del procedimiento.

Autorizo al(a) Cirujano(a) Dentista {{odontologo}} (COP {{colegiatura}}) y a su equipo a realizar el procedimiento descrito.`

/** Plantillas que se cargan la primera vez que se abre el módulo de documentos. */
export const PLANTILLAS_BASE: PlantillaBase[] = [
  {
    tipo: 'CONSENTIMIENTO',
    nombre: 'Consentimiento informado — Tratamiento odontológico general',
    campos: [
      { clave: 'tratamiento', label: 'Tratamiento a realizar', tipo: 'area' },
      { clave: 'piezas', label: 'Pieza(s) dental(es)', tipo: 'texto' },
    ],
    contenido: `Yo, {{paciente}}, identificado(a) con {{documento}}, de {{edad}} años de edad{{apoderado_texto}}, en pleno uso de mis facultades, otorgo mi consentimiento para que se realice el siguiente tratamiento:

Tratamiento: {{tratamiento}}
Pieza(s) dental(es): {{piezas}}

Riesgos y molestias posibles: sensibilidad temporal, dolor o inflamación posoperatoria, sangrado leve, reacción a la anestesia local y, en casos excepcionales, la necesidad de procedimientos adicionales.

${CIERRE_CONSENTIMIENTO}`,
  },
  {
    tipo: 'CONSENTIMIENTO',
    nombre: 'Consentimiento informado — Extracción dental',
    campos: [{ clave: 'piezas', label: 'Pieza(s) a extraer', tipo: 'texto' }],
    contenido: `Yo, {{paciente}}, identificado(a) con {{documento}}, autorizo la extracción de la(s) pieza(s) dental(es): {{piezas}}.

Se me explicó que el procedimiento se realiza bajo anestesia local y que puede presentar: dolor e inflamación posoperatoria, sangrado, equimosis, comunicación con el seno maxilar, lesión de estructuras vecinas, alveolitis (dolor tras la extracción) o fractura de la raíz que requiera un abordaje quirúrgico. Entiendo las indicaciones posoperatorias y la importancia de cumplirlas.

${CIERRE_CONSENTIMIENTO}`,
  },
  {
    tipo: 'CONSENTIMIENTO',
    nombre: 'Consentimiento informado — Endodoncia',
    campos: [{ clave: 'piezas', label: 'Pieza(s) a tratar', tipo: 'texto' }],
    contenido: `Yo, {{paciente}}, identificado(a) con {{documento}}, autorizo el tratamiento de conductos (endodoncia) en la(s) pieza(s): {{piezas}}.

Se me informó que el objetivo es conservar la pieza dental eliminando la pulpa infectada o dañada, que pueden requerirse varias citas y que existen riesgos como: dolor o inflamación posteriores, fractura de instrumentos dentro del conducto, perforación radicular, imposibilidad de completar el tratamiento y necesidad de retratamiento, cirugía o extracción. Tras la endodoncia la pieza requiere una restauración definitiva (resina o corona).

${CIERRE_CONSENTIMIENTO}`,
  },
  {
    tipo: 'CONSENTIMIENTO',
    nombre: 'Consentimiento informado — Ortodoncia',
    campos: [
      { clave: 'aparato', label: 'Tipo de aparatología', tipo: 'texto' },
      { clave: 'duracion', label: 'Duración estimada', tipo: 'texto' },
    ],
    contenido: `Yo, {{paciente}}, identificado(a) con {{documento}}, autorizo el tratamiento de ortodoncia con aparatología {{aparato}}, con una duración estimada de {{duracion}}.

Entiendo que el éxito depende de mi colaboración (higiene, uso de elásticos, asistencia a controles) y que existen riesgos como: descalcificación del esmalte, caries, recesión de encía, reabsorción radicular, molestias iniciales y recidiva si no uso la contención indicada. El tiempo de tratamiento puede variar.

${CIERRE_CONSENTIMIENTO}`,
  },
  {
    tipo: 'CONSENTIMIENTO',
    nombre: 'Consentimiento informado — Blanqueamiento dental',
    campos: [{ clave: 'tecnica', label: 'Técnica (consultorio / ambulatorio)', tipo: 'texto' }],
    contenido: `Yo, {{paciente}}, identificado(a) con {{documento}}, autorizo el blanqueamiento dental mediante la técnica {{tecnica}}.

Se me explicó que puede producirse sensibilidad dental transitoria e irritación de la encía, que el resultado varía según cada persona y que no modifica el color de restauraciones o prótesis existentes.

${CIERRE_CONSENTIMIENTO}`,
  },
  {
    tipo: 'RECETA',
    nombre: 'Receta médica estándar',
    campos: [],
    contenido: `Tomar los medicamentos según las indicaciones. No suspender el tratamiento sin consultar. Ante reacciones alérgicas, fiebre persistente o dolor intenso, comunicarse con el consultorio.`,
  },
  {
    tipo: 'PRESUPUESTO',
    nombre: 'Presupuesto de tratamiento estándar',
    campos: [],
    contenido: `Condiciones: el presupuesto tiene la vigencia indicada. Los precios incluyen IGV. El tratamiento puede pagarse por etapas mediante abonos; el plan puede variar si durante la atención se detectan nuevos hallazgos clínicos, lo cual se comunicará al paciente antes de realizarlos.`,
  },
]

/** Valores de plantilla derivados del paciente/odontólogo/consultorio. */
export function valoresBase(args: {
  paciente: { nombre: string; dni?: string | null; ruc?: string | null; carnetExtranjeria?: string | null; fechaNacimiento?: string | Date | null; apoderado?: string | null }
  odontologo?: { name: string; colegiatura?: string | null } | null
  consultorio?: string | null
  fecha?: Date
}): Record<string, string> {
  const { paciente, odontologo } = args
  const edad = edadDesde(paciente.fechaNacimiento)
  const documento = paciente.dni ? `DNI ${paciente.dni}` : paciente.carnetExtranjeria ? `CE ${paciente.carnetExtranjeria}` : paciente.ruc ? `RUC ${paciente.ruc}` : ''
  return {
    paciente: paciente.nombre,
    documento,
    edad: edad === null ? '' : String(edad),
    apoderado: paciente.apoderado ?? '',
    apoderado_texto: paciente.apoderado ? `, representado(a) por ${paciente.apoderado}` : '',
    fecha: (args.fecha ?? new Date()).toLocaleDateString('es-PE', { timeZone: 'America/Lima', day: '2-digit', month: 'long', year: 'numeric' }),
    odontologo: odontologo?.name ?? '',
    colegiatura: odontologo?.colegiatura ?? '',
    consultorio: args.consultorio ?? '',
  }
}

/** Limpia los campos personalizados que llegan de una plantilla (claves seguras, sin duplicados). */
export function normalizarCampos(valor: unknown): CampoPlantilla[] {
  if (!Array.isArray(valor)) return []
  const usadas = new Set<string>()
  const campos: CampoPlantilla[] = []
  for (const c of valor as Partial<CampoPlantilla>[]) {
    const clave = typeof c.clave === 'string' ? c.clave.trim().replace(/[^a-zA-Z0-9_]/g, '') : ''
    const label = typeof c.label === 'string' ? c.label.trim() : ''
    if (!clave || !label || usadas.has(clave)) continue
    usadas.add(clave)
    campos.push({ clave, label, tipo: ['texto', 'area', 'fecha', 'numero'].includes(c.tipo as string) ? (c.tipo as CampoPlantilla['tipo']) : 'texto' })
  }
  return campos
}

