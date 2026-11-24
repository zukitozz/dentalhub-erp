import QRCode from 'qrcode'

// Generador de PDF A4 del comprobante, con el mismo diseño que la plantilla HTML de FuelHub
// (cabecera con caja RUC, bloque de cliente, tabla azul marino, totales y pie con QR/hash).
// Se dibuja directamente (sin Chromium) para que funcione en Vercel.
export interface DatosPdf {
  empresa: string
  ruc?: string | null
  direccion?: string | null
  tipo: string
  numero: string
  fecha: string
  cliente: string
  documento?: string | null
  direccionCliente?: string | null
  moneda?: string
  metodoPago?: string | null
  items: { codigo?: string | null; cantidad: number; unidad?: string; descripcion: string; precioUnit: number; total: number }[]
  gravadas?: number | null
  igv?: number | null
  total: number
  montoLetras?: string | null
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

const moneda = (v: number) => `S/ ${v.toFixed(2)}`
const esc = (t: string) => t.replace(/[\\()]/g, '\\$&').replace(/[^\x20-\xFF]/g, '?')
const col = (hex: string) => hex.match(/\w\w/g)!.map((h) => (parseInt(h, 16) / 255).toFixed(3)).join(' ')

const INK = '2D3748'
const MUTED = '4A5568'
const NAVY = '1A365D'
const LINE = 'E2E8F0'
const SOFT = 'F7FAFC'
const SOFT2 = 'F8FAFC'
const GRAY = '718096'

export function generarPdfComprobante(d: DatosPdf): Buffer {
  const ops: string[] = []
  const rect = (x: number, y: number, w: number, h: number, o: { fill?: string; stroke?: string; lw?: number; r?: number }) => {
    const r = o.r ?? 0
    const path = r
      ? `${x + r} ${y} m ${x + w - r} ${y} l ${x + w} ${y} ${x + w} ${y} ${x + w} ${y + r} c ${x + w} ${y + h - r} l ${x + w} ${y + h} ${x + w} ${y + h} ${x + w - r} ${y + h} c ${x + r} ${y + h} l ${x} ${y + h} ${x} ${y + h} ${x} ${y + h - r} c ${x} ${y + r} l ${x} ${y} ${x} ${y} ${x + r} ${y} c h`
      : `${x} ${y} ${w} ${h} re`
    if (o.fill) ops.push(`${col(o.fill)} rg ${path} f`)
    if (o.stroke) ops.push(`${col(o.stroke)} RG ${o.lw ?? 0.8} w ${path} S`)
  }
  const linea = (x1: number, y1: number, x2: number, y2: number, color = LINE, lw = 0.6, dash = false) =>
    ops.push(`${dash ? '[3 3] 0 d' : '[] 0 d'} ${col(color)} RG ${lw} w ${x1} ${y1} m ${x2} ${y2} l S [] 0 d`)
  const texto = (
    t: string,
    x: number,
    y: number,
    o: { size?: number; bold?: boolean; italic?: boolean; mono?: boolean; color?: string; align?: 'l' | 'r' | 'c' } = {},
  ) => {
    const size = o.size ?? 9
    const bold = o.bold ?? false
    const fuente = o.mono ? 'F4' : bold ? 'F2' : o.italic ? 'F3' : 'F1'
    const w = o.mono ? t.length * size * 0.6 : ancho(t, size, bold)
    const px = o.align === 'r' ? x - w : o.align === 'c' ? x - w / 2 : x
    ops.push(`BT ${col(o.color ?? INK)} rg /${fuente} ${size} Tf ${px.toFixed(2)} ${y.toFixed(2)} Td (${esc(t)}) Tj ET`)
  }
  const cortar = (t: string, max: number, size: number) => {
    if (ancho(t, size, false) <= max) return t
    let s = t
    while (s.length > 1 && ancho(`${s}...`, size, false) > max) s = s.slice(0, -1)
    return `${s}...`
  }

  const L = 34
  const R = 561

  // ── Cabecera: emisor a la izquierda, caja RUC a la derecha ──
  texto(d.empresa.toUpperCase(), L, 800, { size: 15, bold: true, color: NAVY })
  if (d.direccion) {
    texto('Dirección:', L, 783, { size: 9, bold: true, color: MUTED })
    texto(cortar(d.direccion, 250, 9), L + 46, 783, { size: 9, color: MUTED })
  }

  const bx = 333, bw = R - bx, by = 742, bh = 88
  rect(bx, by, bw, bh, { fill: SOFT, stroke: NAVY, lw: 1.6, r: 5 })
  texto(`RUC: ${d.ruc ?? ''}`, bx + bw / 2, by + 68, { size: 12, bold: true, color: NAVY, align: 'c' })
  rect(bx + 12, by + 36, bw - 24, 22, { fill: NAVY })
  texto(d.tipo.toUpperCase(), bx + bw / 2, by + 43, { size: 10, bold: true, color: 'FFFFFF', align: 'c' })
  texto(d.numero, bx + bw / 2, by + 14, { size: 12, bold: true, align: 'c' })

  // ── Información del cliente (etiqueta/valor sobre fondo suave) ──
  const filas: [string, string, string?, string?][] = [
    ['Señor(es):', d.cliente],
    ['Dirección:', d.direccionCliente || '---'],
    ['RUC / DNI:', d.documento || '---', 'Fecha Emisión:', d.fecha],
    ['Moneda:', d.moneda || 'SOLES', 'Método Pago:', d.metodoPago || '---'],
  ]
  const rowH = 20
  const iy = 722 - filas.length * rowH
  rect(L, iy, R - L, filas.length * rowH, { fill: SOFT2, stroke: LINE })
  filas.forEach(([k, v, k2, v2], i) => {
    const y = iy + (filas.length - 1 - i) * rowH + 7
    texto(k, L + 10, y, { size: 9, bold: true, color: MUTED })
    texto(cortar(v, k2 ? 190 : 400, 9), L + 100, y, { size: 9 })
    if (k2) {
      texto(k2, 330, y, { size: 9, bold: true, color: MUTED })
      texto(cortar(v2 || '', 125, 9), 420, y, { size: 9 })
    }
  })

  // ── Tabla de ítems ──
  let ty = iy - 32
  const cols = { cod: L + 38, cant: L + 120, uni: L + 175, desc: L + 215, pu: R - 85, imp: R - 10 }
  rect(L, ty - 7, R - L, 24, { fill: NAVY })
  texto('Código', cols.cod, ty, { size: 9, bold: true, color: 'FFFFFF', align: 'c' })
  texto('Cantidad', cols.cant, ty, { size: 9, bold: true, color: 'FFFFFF', align: 'c' })
  texto('Unidad', cols.uni, ty, { size: 9, bold: true, color: 'FFFFFF', align: 'c' })
  texto('Descripción', cols.desc, ty, { size: 9, bold: true, color: 'FFFFFF' })
  texto('P. Unitario', cols.pu, ty, { size: 9, bold: true, color: 'FFFFFF', align: 'r' })
  texto('Importe', cols.imp, ty, { size: 9, bold: true, color: 'FFFFFF', align: 'r' })
  ty -= 26
  for (const it of d.items) {
    texto(cortar(it.codigo || '-', 60, 9), cols.cod, ty, { size: 9, align: 'c' })
    texto(String(it.cantidad), cols.cant, ty, { size: 9, align: 'c' })
    texto(it.unidad || 'UND', cols.uni, ty, { size: 9, align: 'c' })
    texto(cortar(it.descripcion, 190, 9), cols.desc, ty, { size: 9 })
    texto(moneda(it.precioUnit), cols.pu, ty, { size: 9, align: 'r' })
    texto(moneda(it.total), cols.imp, ty, { size: 9, align: 'r' })
    linea(L, ty - 7, R, ty - 7)
    ty -= 22
  }

  // ── Son: (izquierda) y totales (derecha) ──
  ty -= 8
  const tx = 345
  const fila = (k: string, v: number | null | undefined, fuerte = false) => {
    if (v == null) return
    if (fuerte) rect(tx, ty - 7, R - tx, 22, { fill: SOFT })
    texto(k, tx + 10, ty, { size: 9, bold: fuerte, color: fuerte ? NAVY : INK })
    texto(moneda(v), R - 10, ty, { size: 9, bold: fuerte, color: fuerte ? NAVY : INK, align: 'r' })
    linea(tx, ty - 7, R, ty - 7)
    ty -= 22
  }
  const topeTotales = ty
  fila('Op. Gravada:', d.gravadas)
  fila('I.G.V. (18%):', d.igv)
  fila('Importe Total:', d.total, true)
  if (d.montoLetras) {
    rect(L, topeTotales - 12, 290, 26, { fill: SOFT })
    rect(L, topeTotales - 12, 3, 26, { fill: NAVY })
    texto(`Son: ${cortar(d.montoLetras, 255, 9)}`, L + 14, topeTotales - 2, { size: 9, italic: true })
  }

  // ── Pie: línea punteada, QR, hash y leyenda ──
  const py = Math.min(ty - 40, 200)
  linea(L, py + 108, R, py + 108, 'CBD5E0', 0.8, true)
  if (d.electronico) {
    const contenido = d.qr || `${d.ruc ?? ''}|${d.numero}|${d.igv ?? 0}|${d.total.toFixed(2)}|${d.fecha}`
    const qr = QRCode.create(contenido, { errorCorrectionLevel: 'M' })
    const n = qr.modules.size
    const cell = 92 / n
    ops.push(`${col('000000')} rg`)
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        if (qr.modules.get(r, c)) ops.push(`${(L + c * cell).toFixed(2)} ${(py + 98 - (r + 1) * cell).toFixed(2)} ${cell.toFixed(2)} ${cell.toFixed(2)} re f`)
      }
    }
    texto('Código Hash Digital:', L + 110, py + 84, { size: 8, bold: true, color: GRAY })
    rect(L + 110, py + 58, R - L - 110, 20, { fill: SOFT, stroke: LINE })
    texto(cortar(d.hash || '---', R - L - 130, 8), L + 116, py + 65, { size: 8, mono: true, color: GRAY })
    texto(`Representación impresa de la ${d.tipo.charAt(0) + d.tipo.slice(1).toLowerCase()}, generada en conformidad con las normas de SUNAT`, L + 110, py + 40, { size: 8, italic: true, color: GRAY })
    texto('desde el sistema de gestión del consultorio.', L + 110, py + 29, { size: 8, italic: true, color: GRAY })
  } else {
    texto('Documento interno: no es un comprobante de pago electrónico.', L, py + 80, { size: 9, italic: true, color: GRAY })
  }

  const contenido = ops.join('\n')
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R /F3 7 0 R /F4 8 0 R >> >> >>',
    `<< /Length ${Buffer.byteLength(contenido, 'latin1')} >>\nstream\n${contenido}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique /Encoding /WinAnsiEncoding >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>',
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
