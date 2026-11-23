// Generador mínimo de PDF (una página A5, Helvetica) para adjuntar el comprobante por WhatsApp. Sin dependencias.
export interface DatosPdf {
  empresa: string
  ruc?: string | null
  tipo: string
  numero: string
  fecha: string
  cliente: string
  documento?: string | null
  items: { texto: string; total: number }[]
  gravadas?: number | null
  igv?: number | null
  total: number
  montoLetras?: string | null
}

const latin1 = (t: string) => t.replace(/[\\()]/g, '\\$&').replace(/[^\x20-\xFF]/g, '?')

export function generarPdfComprobante(d: DatosPdf): Buffer {
  const lineas: { x: number; y: number; size: number; bold?: boolean; texto: string }[] = []
  let y = 540
  const add = (texto: string, size = 10, bold = false, x = 40) => {
    lineas.push({ x, y, size, bold, texto })
    y -= size + 6
  }
  // Monto alineado a la derecha en la última línea escrita.
  const monto = (valor: number, size = 10, bold = false) => lineas.push({ x: 330, y: y + size + 6, size, bold, texto: `S/ ${valor.toFixed(2)}` })

  add(d.empresa, 14, true)
  if (d.ruc) add(`RUC: ${d.ruc}`)
  y -= 6
  add(d.tipo, 12, true)
  add(d.numero, 12, true)
  add(`Fecha: ${d.fecha}`)
  add(`Cliente: ${d.cliente}`)
  if (d.documento) add(d.documento)
  y -= 8
  add('Detalle', 10, true)
  for (const it of d.items) {
    add(it.texto.slice(0, 55))
    monto(it.total)
  }
  y -= 8
  if (d.gravadas != null) { add('Op. gravada'); monto(d.gravadas) }
  if (d.igv != null) { add('IGV (18%)'); monto(d.igv) }
  add('TOTAL', 12, true)
  monto(d.total, 12, true)
  if (d.montoLetras) add(`Son: ${d.montoLetras}`.slice(0, 80), 9)
  y -= 10
  add('Gracias por su preferencia', 10)

  const contenido = lineas.map((l) => `BT /${l.bold ? 'F2' : 'F1'} ${l.size} Tf ${l.x} ${l.y} Td (${latin1(l.texto)}) Tj ET`).join('\n')
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 420 595] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>',
    `<< /Length ${Buffer.byteLength(contenido, 'latin1')} >>\nstream\n${contenido}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
  ]
  let out = '%PDF-1.4\n'
  const offs: number[] = []
  objs.forEach((o, i) => {
    offs.push(Buffer.byteLength(out, 'latin1'))
    out += `${i + 1} 0 obj\n${o}\nendobj\n`
  })
  const xref = Buffer.byteLength(out, 'latin1')
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + offs.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`
  return Buffer.from(out, 'latin1')
}
