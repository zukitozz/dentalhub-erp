import QRCode from 'qrcode'

// Generador de PDF A4 del comprobante (formato habitual de representación impresa SUNAT), sin dependencias de PDF.
export interface DatosPdf {
  empresa: string
  nombreComercial?: string | null
  ruc?: string | null
  direccion?: string | null
  tipo: string
  numero: string
  fecha: string
  cliente: string
  documento?: string | null
  direccionCliente?: string | null
  moneda?: string
  items: { cantidad: number; descripcion: string; precioUnit: number; total: number }[]
  gravadas?: number | null
  igv?: number | null
  total: number
  montoLetras?: string | null
  metodoPago?: string | null
  qr?: string | null
  hash?: string | null
  /** Nota de venta: sin QR ni leyenda SUNAT. */
  electronico: boolean
}

// Anchos Helvetica (AFM) de ASCII 32-126, en milésimas de em; el resto se aproxima.
const W = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556,
  1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469,
  556, 333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584,
]
const ancho = (t: string, size: number, bold: boolean) => {
  let w = 0
  for (const ch of t) {
    const c = ch.charCodeAt(0)
    w += c >= 32 && c <= 126 ? W[c - 32] : 556
  }
  return (w / 1000) * size * (bold ? 1.06 : 1)
}

const esc = (t: string) => t.replace(/[\\()]/g, '\\$&').replace(/[^\x20-\xFF]/g, '?')
const col = (hex: string) => hex.match(/\w\w/g)!.map((h) => (parseInt(h, 16) / 255).toFixed(3)).join(' ')

const INK = '1F2937'
const MUTED = '6B7280'
const BRAND = '0B5D4B'
const LINE = 'D1D5DB'
const SOFT = 'F3F4F6'

export function generarPdfComprobante(d: DatosPdf): Buffer {
  const ops: string[] = []
  const rect = (x: number, y: number, w: number, h: number, o: { fill?: string; stroke?: string; lw?: number }) => {
    if (o.fill) ops.push(`${col(o.fill)} rg ${x} ${y} ${w} ${h} re f`)
    if (o.stroke) ops.push(`${col(o.stroke)} RG ${o.lw ?? 0.8} w ${x} ${y} ${w} ${h} re S`)
  }
  const linea = (x1: number, y1: number, x2: number, y2: number, color = LINE, lw = 0.6) =>
    ops.push(`${col(color)} RG ${lw} w ${x1} ${y1} m ${x2} ${y2} l S`)
  const texto = (t: string, x: number, y: number, o: { size?: number; bold?: boolean; color?: string; align?: 'l' | 'r' | 'c' } = {}) => {
    const size = o.size ?? 9
    const bold = o.bold ?? false
    const w = ancho(t, size, bold)
    const px = o.align === 'r' ? x - w : o.align === 'c' ? x - w / 2 : x
    ops.push(`BT ${col(o.color ?? INK)} rg /${bold ? 'F2' : 'F1'} ${size} Tf ${px.toFixed(2)} ${y.toFixed(2)} Td (${esc(t)}) Tj ET`)
  }
  const cortar = (t: string, max: number, size: number) => {
    if (ancho(t, size, false) <= max) return t
    let s = t
    while (s.length > 1 && ancho(`${s}…`, size, false) > max) s = s.slice(0, -1)
    return `${s}...`
  }

  const L = 40
  const R = 555

  // ── Cabecera: emisor a la izquierda, recuadro RUC/tipo/número a la derecha ──
  texto(d.empresa, L, 790, { size: 14, bold: true, color: BRAND })
  let yy = 774
  if (d.nombreComercial && d.nombreComercial !== d.empresa) { texto(d.nombreComercial, L, yy, { size: 9 }); yy -= 13 }
  if (d.direccion) { texto(cortar(d.direccion, 300, 8.5), L, yy, { size: 8.5, color: MUTED }); yy -= 12 }

  const bx = 380, bw = R - bx, by = 730, bh = 80
  rect(bx, by, bw, bh, { stroke: BRAND, lw: 1.2 })
  rect(bx, by + 24, bw, 26, { fill: BRAND })
  texto(d.ruc ? `R.U.C. ${d.ruc}` : 'R.U.C.', bx + bw / 2, by + 59, { size: 11, bold: true, align: 'c' })
  texto(d.tipo, bx + bw / 2, by + 33, { size: 9.5, bold: true, color: 'FFFFFF', align: 'c' })
  texto(d.numero, bx + bw / 2, by + 8, { size: 12, bold: true, align: 'c' })

  // ── Datos del cliente ──
  const cy = 640, ch = 74
  rect(L, cy, R - L, ch, { stroke: LINE })
  const filas: [string, string][] = [
    ['Fecha de emisión:', d.fecha],
    ['Señor(es):', d.cliente],
    ['Documento:', d.documento || '-'],
    ['Dirección:', d.direccionCliente || '-'],
  ]
  filas.forEach(([k, v], i) => {
    const y = cy + ch - 16 - i * 15
    texto(k, L + 10, y, { size: 8.5, bold: true, color: MUTED })
    texto(cortar(v, 340, 9), L + 100, y, { size: 9 })
  })
  texto('Moneda:', 390, cy + ch - 16, { size: 8.5, bold: true, color: MUTED })
  texto(d.moneda || 'SOLES', 435, cy + ch - 16, { size: 9 })
  if (d.metodoPago) {
    texto('Pago:', 390, cy + ch - 31, { size: 8.5, bold: true, color: MUTED })
    texto(d.metodoPago, 435, cy + ch - 31, { size: 9 })
  }

  // ── Tabla de ítems ──
  let ty = 612
  const cCant = L + 10, cDesc = L + 62, cPU = 450, cImp = R - 10
  rect(L, ty - 6, R - L, 22, { fill: BRAND })
  texto('CANT.', cCant, ty, { size: 8.5, bold: true, color: 'FFFFFF' })
  texto('DESCRIPCIÓN', cDesc, ty, { size: 8.5, bold: true, color: 'FFFFFF' })
  texto('P. UNIT.', cPU, ty, { size: 8.5, bold: true, color: 'FFFFFF', align: 'r' })
  texto('IMPORTE', cImp, ty, { size: 8.5, bold: true, color: 'FFFFFF', align: 'r' })
  ty -= 22
  d.items.forEach((it, i) => {
    if (i % 2 === 1) rect(L, ty - 6, R - L, 20, { fill: SOFT })
    texto(String(it.cantidad), cCant, ty, { size: 9 })
    texto(cortar(it.descripcion, 300, 9), cDesc, ty, { size: 9 })
    texto(it.precioUnit.toFixed(2), cPU, ty, { size: 9, align: 'r' })
    texto(it.total.toFixed(2), cImp, ty, { size: 9, align: 'r' })
    ty -= 20
  })
  linea(L, ty + 14, R, ty + 14)

  // ── Totales ──
  ty -= 8
  const tx = 360
  const fila = (k: string, v: number | null | undefined, fuerte = false) => {
    if (v == null) return
    if (fuerte) rect(tx, ty - 7, R - tx, 22, { fill: BRAND })
    texto(k, tx + 10, ty, { size: fuerte ? 10 : 9, bold: fuerte, color: fuerte ? 'FFFFFF' : INK })
    texto(`S/ ${v.toFixed(2)}`, R - 10, ty, { size: fuerte ? 10.5 : 9, bold: fuerte, color: fuerte ? 'FFFFFF' : INK, align: 'r' })
    ty -= fuerte ? 22 : 16
  }
  fila('Op. gravada', d.gravadas)
  fila('IGV (18%)', d.igv)
  ty -= 4
  fila('IMPORTE TOTAL', d.total, true)

  if (d.montoLetras) texto(`SON: ${d.montoLetras}`, L, ty + 22, { size: 8.5, bold: true })

  // ── Pie: QR y leyenda ──
  const py = Math.min(ty - 30, 170)
  linea(L, py + 100, R, py + 100)
  if (d.electronico) {
    const contenido = d.qr || `${d.ruc ?? ''}|${d.numero}|${d.total.toFixed(2)}|${d.fecha}`
    const qr = QRCode.create(contenido, { errorCorrectionLevel: 'M' })
    const n = qr.modules.size
    const cell = 80 / n
    rect(L, py + 6, 88, 88, { stroke: LINE })
    ops.push(`${col('000000')} rg`)
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        if (qr.modules.get(r, c)) ops.push(`${(L + 4 + c * cell).toFixed(2)} ${(py + 90 - (r + 1) * cell).toFixed(2)} ${cell.toFixed(2)} ${cell.toFixed(2)} re f`)
      }
    }
    texto(`Representación impresa de la ${d.tipo.charAt(0) + d.tipo.slice(1).toLowerCase()}`, L + 102, py + 80, { size: 9, bold: true })
    texto('Consulte su comprobante en www.sunat.gob.pe', L + 102, py + 66, { size: 8.5, color: MUTED })
    if (d.hash) {
      texto('Hash:', L + 102, py + 48, { size: 8, bold: true, color: MUTED })
      texto(cortar(d.hash, 360, 8), L + 128, py + 48, { size: 8, color: MUTED })
    }
  } else {
    texto('Documento interno: no es un comprobante de pago electrónico.', L, py + 70, { size: 8.5, color: MUTED })
  }
  texto('Gracias por su preferencia', 297.5, 40, { size: 9, color: MUTED, align: 'c' })

  const contenido = ops.join('\n')
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>',
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
