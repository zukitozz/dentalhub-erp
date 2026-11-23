import { NextResponse } from 'next/server'
import { requireApiAuth } from '@/lib/api-auth'
import { urlPdfComprobante } from '@/lib/comprobantePdf'

export const dynamic = 'force-dynamic'

// Devuelve la URL firmada del PDF del comprobante; si no existe aún, lo crea y lo guarda en S3.
// Es independiente del estado en SUNAT (aceptado o rechazado).
export async function GET(req: Request) {
  const guard = await requireApiAuth()
  if (guard) return guard
  const facturaId = new URL(req.url).searchParams.get('facturaId')
  if (!facturaId) return NextResponse.json({ error: 'facturaId requerido' }, { status: 400 })
  const url = await urlPdfComprobante(facturaId)
  if (!url) return NextResponse.json({ error: 'No se pudo crear el PDF del comprobante' }, { status: 500 })
  return NextResponse.json({ url })
}
