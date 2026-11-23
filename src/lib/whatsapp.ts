import { prisma } from '@/lib/prisma'
import { generarPdfComprobante } from '@/lib/pdfComprobante'
import { subirPdfComprobante } from '@/lib/storage'

// Cliente del servicio de notificaciones por WhatsApp. Es un extra: nunca debe romper la emisión del comprobante.
const TIPO_TEXTO: Record<string, string> = { '01': 'factura', '03': 'boleta', '07': 'nota de crédito', '08': 'nota de débito' }
const TIPO_TITULO: Record<string, string> = {
  '01': 'FACTURA ELECTRÓNICA',
  '03': 'BOLETA DE VENTA ELECTRÓNICA',
  '07': 'NOTA DE CRÉDITO ELECTRÓNICA',
  '08': 'NOTA DE DÉBITO ELECTRÓNICA',
}
const TIMEOUT_MS = 10_000

export function whatsappConfigurado() {
  return Boolean(
    process.env.NOTIF_BASE_URL && process.env.NOTIF_TOKEN_URL && process.env.NOTIF_CLIENT_ID && process.env.NOTIF_CLIENT_SECRET && process.env.NOTIF_PROYECTO,
  )
}

/** Normaliza a E.164 peruano (+51 y 9 dígitos); null si no es un celular válido. */
export function normalizarTelefono(valor: string | null | undefined): string | null {
  if (!valor) return null
  let d = valor.replace(/[\s\-().]/g, '')
  if (d.startsWith('+')) d = d.slice(1)
  if (d.startsWith('51') && d.length === 11) d = d.slice(2)
  return /^9\d{8}$/.test(d) ? `+51${d}` : null
}

let tokenCache: { token: string; expira: number } | null = null

async function obtenerToken(forzar = false): Promise<string> {
  if (!forzar && tokenCache && tokenCache.expira > Date.now() + 5 * 60_000) return tokenCache.token
  const res = await fetch(process.env.NOTIF_TOKEN_URL!, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${process.env.NOTIF_CLIENT_ID}:${process.env.NOTIF_CLIENT_SECRET}`).toString('base64')}`,
    },
    body: `grant_type=client_credentials&scope=${encodeURIComponent(process.env.NOTIF_SCOPE || 'notificaciones-api/envios.write')}`,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  if (!res.ok) throw new Error(`No se pudo autenticar con el servicio de notificaciones (HTTP ${res.status})`)
  const data = (await res.json()) as { access_token: string; expires_in: number }
  tokenCache = { token: data.access_token, expira: Date.now() + data.expires_in * 1000 }
  return tokenCache.token
}

async function llamar(path: string, method: 'POST' | 'PUT', body: unknown, intento = 0): Promise<Response> {
  const token = await obtenerToken(intento > 0)
  const res = await fetch(`${process.env.NOTIF_BASE_URL!.replace(/\/$/, '')}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  if (res.status === 401 && intento === 0) return llamar(path, method, body, 1)
  if (res.status === 503 && intento < 2) return llamar(path, method, body, intento + 1)
  return res
}

const fechaLima = (f: Date) =>
  new Intl.DateTimeFormat('es-PE', { timeZone: 'America/Lima', day: '2-digit', month: '2-digit', year: 'numeric' }).format(f)

/** Registra el consentimiento del cliente para recibir comprobantes (PUT /v1/consentimientos). */
export async function registrarConsentimiento(telefono: string, aceptado: boolean, origen = 'caja') {
  if (!whatsappConfigurado()) return false
  const res = await llamar('/v1/consentimientos', 'PUT', { proyectoCodigo: process.env.NOTIF_PROYECTO, telefono, aceptado, origen })
  return res.status === 202
}

/**
 * Envía el comprobante por WhatsApp. Con `reenvio` genera una referencia nueva (:r2, :r3…).
 * Nunca lanza: devuelve el registro con el estado resultante, o null si no aplica.
 */
export async function enviarComprobanteWhatsapp(facturaId: string, opciones: { reenvio?: boolean; telefono?: string } = {}) {
  try {
    return await enviar(facturaId, opciones)
  } catch (error) {
    console.error('Error al enviar comprobante por WhatsApp', error)
    return null
  }
}

async function enviar(facturaId: string, opciones: { reenvio?: boolean; telefono?: string }) {
  if (!whatsappConfigurado()) return null
  const factura = await prisma.factura.findUnique({ where: { id: facturaId }, include: { paciente: true, items: true } })
  if (!factura || !factura.enviado || !factura.numeracionComprobante || !factura.tipoComprobante) return null
  if (!TIPO_TEXTO[factura.tipoComprobante] || factura.total <= 0) return null
  const telefono = normalizarTelefono(opciones.telefono ?? factura.paciente.celular)
  if (!telefono) return null

  const tipoRef = factura.tipoComprobante === '07' || factura.tipoComprobante === '08' ? 'NOTA' : 'EMISION'
  const previos = await prisma.envioWhatsapp.count({ where: { facturaId } })
  if (previos > 0 && !opciones.reenvio) return null
  const base = `${factura.numeracionComprobante}:${tipoRef}`
  const referencia = previos === 0 ? base : `${base}:r${previos + 1}`
  const registro = await prisma.envioWhatsapp.create({ data: { facturaId, referenciaExterna: referencia, telefono } })

  const actualizar = (data: { estado: string; solicitudId?: string; error?: string }) =>
    prisma.envioWhatsapp.update({ where: { id: registro.id }, data })

  try {
    const config = await prisma.configuracion.findUnique({ where: { id: 'default' } })
    const negocio = process.env.NOTIF_NEGOCIO_NOMBRE || config?.nombreEmpresa || 'HubDental'
    const fecha = factura.fechaHora || factura.fechaEmision || factura.creadoAt
    const p = factura.paciente
    const nombrePdf = `${TIPO_TEXTO[factura.tipoComprobante].replace(/ /g, '_')}_${factura.numeracionComprobante}.pdf`
    const pdf = generarPdfComprobante({
      empresa: config?.razonSocial || negocio,
      ruc: factura.ruc,
      tipo: TIPO_TITULO[factura.tipoComprobante],
      numero: factura.numeracionComprobante,
      fecha: fecha.toLocaleString('es-PE', { timeZone: 'America/Lima' }),
      cliente: (p.ruc && p.razonSocial) || p.nombre,
      documento: p.ruc ? `RUC: ${p.ruc}` : p.dni ? `DNI: ${p.dni}` : null,
      items: factura.items.map((i) => ({ texto: `${i.cantidad} x ${i.nombre}`, total: i.total })),
      gravadas: factura.gravadas,
      igv: factura.igv,
      total: factura.total,
      montoLetras: factura.montoLetras,
    })
    const adjuntoUrl = await subirPdfComprobante(nombrePdf, pdf)
    const nombre = p.nombre.split(/\s+/)[0] || 'cliente'

    const res = await llamar('/v1/envios', 'POST', {
      proyectoCodigo: process.env.NOTIF_PROYECTO,
      topicoCodigo: tipoRef === 'NOTA' ? 'NOTA_EMITIDA' : 'COMPROBANTE_EMITIDO',
      destinatario: { telefono },
      referenciaExterna: referencia,
      adjuntoUrl,
      adjuntoNombre: nombrePdf,
      variables: {
        nombre,
        negocio,
        tipo_comprobante: TIPO_TEXTO[factura.tipoComprobante],
        numero_comprobante: factura.numeracionComprobante,
        fecha_emision: fechaLima(fecha),
        monto: factura.total.toFixed(2),
      },
    })
    const data = (await res.json().catch(() => null)) as { solicitudId?: string; error?: string; campo?: string } | null
    if (res.status === 202) return await actualizar({ estado: 'PENDIENTE', solicitudId: data?.solicitudId })
    return await actualizar({ estado: 'ERROR', error: `${data?.error || `HTTP ${res.status}`}${data?.campo ? ` (${data.campo})` : ''}` })
  } catch (error) {
    return actualizar({ estado: 'ERROR', error: error instanceof Error ? error.message : 'Error desconocido' })
  }
}
