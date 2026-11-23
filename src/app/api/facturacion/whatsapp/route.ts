import { NextResponse } from 'next/server'
import { requireApiAuth } from '@/lib/api-auth'
import { enviarComprobanteWhatsapp, normalizarTelefono, whatsappConfigurado } from '@/lib/whatsapp'

export const dynamic = 'force-dynamic'

// Envío (o reenvío manual con referencia nueva :r2, :r3…) del comprobante por WhatsApp.
export async function POST(req: Request) {
  const guard = await requireApiAuth(['ADMIN', 'SUPERVISOR'])
  if (guard) return guard
  if (!whatsappConfigurado()) {
    return NextResponse.json({ error: 'WhatsApp no está configurado (variables NOTIF_*)' }, { status: 400 })
  }
  const body = await req.json()
  if (!body.facturaId) return NextResponse.json({ error: 'facturaId requerido' }, { status: 400 })
  let telefono: string | undefined
  if (body.telefono) {
    const normalizado = normalizarTelefono(String(body.telefono))
    if (!normalizado) return NextResponse.json({ error: 'Teléfono inválido: debe ser un celular peruano de 9 dígitos' }, { status: 400 })
    telefono = normalizado
  }
  const envio = await enviarComprobanteWhatsapp(body.facturaId, { reenvio: true, telefono })
  if (!envio) {
    return NextResponse.json({ error: 'No se pudo enviar: el comprobante debe estar aceptado por SUNAT y el paciente debe tener un celular válido' }, { status: 400 })
  }
  if (envio.estado === 'ERROR') return NextResponse.json({ error: envio.error, envio }, { status: 502 })
  return NextResponse.json(envio)
}
