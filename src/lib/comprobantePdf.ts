import { prisma } from '@/lib/prisma'
import { generarPdfComprobante } from '@/lib/pdfComprobante'
import { subirPdfComprobante, urlFirmada } from '@/lib/storage'

const TITULO: Record<string, string> = {
  FACTURA: 'FACTURA ELECTRÓNICA',
  BOLETA: 'BOLETA DE VENTA ELECTRÓNICA',
  NOTA_VENTA: 'NOTA DE VENTA',
}
const PREFIJO_ARCHIVO: Record<string, string> = { FACTURA: 'factura', BOLETA: 'boleta', NOTA_VENTA: 'nota_de_venta' }

/**
 * Crea el PDF del comprobante y lo guarda en S3 si aún no existe. Devuelve la key o null si falla
 * (nunca lanza: emitir el comprobante no debe depender del PDF, que se reintenta al visualizarlo).
 */
export async function asegurarPdfComprobante(facturaId: string): Promise<string | null> {
  try {
    const factura = await prisma.factura.findUnique({ where: { id: facturaId }, include: { paciente: true, items: true } })
    if (!factura) return null
    if (factura.pdfKey) return factura.pdfKey

    const config = await prisma.configuracion.findUnique({ where: { id: 'default' } })
    const p = factura.paciente
    const fecha = factura.fechaHora || factura.fechaEmision || factura.creadoAt
    const esFactura = factura.tipo === 'FACTURA'
    const docCliente = esFactura && p.ruc ? `RUC ${p.ruc}` : p.dni ? `DNI ${p.dni}` : p.carnetExtranjeria ? `CE ${p.carnetExtranjeria}` : p.ruc ? `RUC ${p.ruc}` : null
    const pdf = generarPdfComprobante({
      empresa: config?.razonSocial || config?.nombreEmpresa || 'HubDental',
      ruc: factura.ruc,
      direccion: config?.direccionFiscal,
      tipo: TITULO[factura.tipo] ?? factura.tipo,
      numero: factura.numeracionComprobante || 'Sin numeración',
      fecha: fecha.toLocaleString('es-PE', { timeZone: 'America/Lima' }),
      cliente: (esFactura && p.ruc && p.razonSocial) || p.nombre,
      documento: docCliente,
      direccionCliente: p.direccion,
      metodoPago: factura.metodoPago.charAt(0) + factura.metodoPago.slice(1).toLowerCase(),
      items: factura.items.map((i) => ({ codigo: i.codigoProducto, cantidad: i.cantidad, descripcion: i.nombre, precioUnit: i.precioUnit, total: i.total })),
      gravadas: factura.gravadas,
      igv: factura.igv,
      total: factura.total,
      montoLetras: factura.montoLetras,
      qr: factura.cadenaParaCodigoQr,
      hash: factura.codigoHash,
      electronico: factura.tipo !== 'NOTA_VENTA',
    })
    const nombre = `${PREFIJO_ARCHIVO[factura.tipo] ?? 'comprobante'}_${factura.numeracionComprobante || factura.id}.pdf`
    const key = await subirPdfComprobante(nombre, pdf)
    await prisma.factura.update({ where: { id: facturaId }, data: { pdfKey: key } })
    return key
  } catch (error) {
    console.error('No se pudo crear el PDF del comprobante', error)
    return null
  }
}

/** URL https firmada del PDF (12 h), creándolo y almacenándolo en S3 si todavía no existe. */
export async function urlPdfComprobante(facturaId: string): Promise<string | null> {
  const key = await asegurarPdfComprobante(facturaId)
  return key ? urlFirmada(key) : null
}
