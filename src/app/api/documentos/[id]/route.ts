import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { requireApiAuth } from '@/lib/api-auth'

export const dynamic = 'force-dynamic'

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const guard = await requireApiAuth()
  if (guard) return guard

  const documento = await prisma.documento.findUnique({
    where: { id },
    include: {
      paciente: true,
      odontologo: { select: { id: true, name: true, colegiatura: true, especialidad: true } },
    },
  })
  if (!documento) return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 })

  const configuracion = await prisma.configuracion.findUnique({
    where: { id: 'default' },
    select: { nombreEmpresa: true, ruc: true, razonSocial: true, direccionFiscal: true, telefono: true, email: true, pieDocumentos: true },
  })
  return NextResponse.json({ ...documento, configuracion })
}

// Cambios de estado: marcar como firmado o anular. El contenido emitido no se edita (trazabilidad clínica).
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const guard = await requireApiAuth()
  if (guard) return guard

  const body = await req.json()
  const documento = await prisma.documento.findUnique({ where: { id } })
  if (!documento) return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 })
  if (documento.estado === 'ANULADO') return NextResponse.json({ error: 'El documento está anulado' }, { status: 409 })

  if (body.estado === 'FIRMADO') {
    return NextResponse.json(await prisma.documento.update({ where: { id }, data: { estado: 'FIRMADO', firmadoAt: new Date() } }))
  }
  if (body.estado === 'ANULADO') {
    const session = await auth()
    if (session?.user?.role === 'ODONTOLOGO' && documento.odontologoId !== session.user.id) {
      return NextResponse.json({ error: 'Solo quien emitió el documento puede anularlo' }, { status: 403 })
    }
    return NextResponse.json(await prisma.documento.update({ where: { id }, data: { estado: 'ANULADO' } }))
  }
  return NextResponse.json({ error: 'Estado inválido' }, { status: 400 })
}
