import { NextResponse } from 'next/server'
import type { Prisma } from '@/generated/prisma/client'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { requireApiAuth } from '@/lib/api-auth'
import { siguienteNumeroDocumento } from '@/lib/documentosDb'
import { TIPOS_DOCUMENTO, totalPresupuesto, type DatosPresupuesto } from '@/lib/documentos'

export const dynamic = 'force-dynamic'

const include = {
  paciente: { select: { id: true, nombre: true, dni: true } },
  odontologo: { select: { id: true, name: true } },
} satisfies Prisma.DocumentoInclude

export async function GET(req: Request) {
  const guard = await requireApiAuth()
  if (guard) return guard

  const url = new URL(req.url)
  const tipo = url.searchParams.get('tipo')
  const pacienteId = url.searchParams.get('pacienteId')
  const q = url.searchParams.get('q')?.trim()

  const where: Prisma.DocumentoWhereInput = {}
  if (tipo && TIPOS_DOCUMENTO.some((t) => t.codigo === tipo)) where.tipo = tipo as 'CONSENTIMIENTO' | 'RECETA' | 'PRESUPUESTO' | 'OTRO'
  if (pacienteId) where.pacienteId = pacienteId
  if (q) {
    where.OR = [
      { numero: { contains: q, mode: 'insensitive' } },
      { titulo: { contains: q, mode: 'insensitive' } },
      { paciente: { nombre: { contains: q, mode: 'insensitive' } } },
      { paciente: { dni: { contains: q } } },
    ]
  }

  const documentos = await prisma.documento.findMany({ where, include, orderBy: { creadoAt: 'desc' }, take: 300 })
  return NextResponse.json(documentos)
}

const texto = (valor: unknown) => (typeof valor === 'string' && valor.trim() ? valor.trim() : null)

export async function POST(req: Request) {
  const guard = await requireApiAuth()
  if (guard) return guard
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Usuario autenticado requerido' }, { status: 401 })

  const body = await req.json()
  const tipo = TIPOS_DOCUMENTO.find((t) => t.codigo === body.tipo)
  const pacienteId = texto(body.pacienteId)
  const titulo = texto(body.titulo)
  const contenido = typeof body.contenido === 'string' ? body.contenido : ''

  if (!tipo) return NextResponse.json({ error: 'Tipo de documento inválido' }, { status: 400 })
  if (!pacienteId) return NextResponse.json({ error: 'Selecciona el paciente' }, { status: 400 })
  if (!titulo) return NextResponse.json({ error: 'El documento necesita un título' }, { status: 400 })

  const paciente = await prisma.paciente.findUnique({ where: { id: pacienteId }, select: { id: true } })
  if (!paciente) return NextResponse.json({ error: 'Paciente no encontrado' }, { status: 404 })

  const datos = body.datos && typeof body.datos === 'object' ? body.datos : null
  if (tipo.codigo === 'RECETA') {
    const meds = Array.isArray(datos?.medicamentos) ? datos.medicamentos.filter((m: { medicamento?: string }) => m?.medicamento?.trim()) : []
    if (meds.length === 0) return NextResponse.json({ error: 'Agrega al menos un medicamento a la receta' }, { status: 400 })
  }
  let total: number | null = null
  if (tipo.codigo === 'PRESUPUESTO') {
    const items = Array.isArray(datos?.items) ? (datos as DatosPresupuesto).items.filter((i) => i?.descripcion?.trim()) : []
    if (items.length === 0) return NextResponse.json({ error: 'Agrega al menos un tratamiento al presupuesto' }, { status: 400 })
    total = totalPresupuesto(items)
  }
  if (tipo.codigo === 'CONSENTIMIENTO' && !contenido.trim()) {
    return NextResponse.json({ error: 'El consentimiento no tiene contenido' }, { status: 400 })
  }

  // Un odontólogo firma sus propios documentos; recepción/gerente indican quién.
  const odontologoId = session.user.role === 'ODONTOLOGO' ? session.user.id : texto(body.odontologoId)

  const documento = await prisma.$transaction(async (tx) => {
    const numero = await siguienteNumeroDocumento(tx, tipo.codigo)
    return tx.documento.create({
      data: {
        numero,
        tipo: tipo.codigo,
        titulo,
        pacienteId,
        plantillaId: texto(body.plantillaId),
        odontologoId,
        atencionId: texto(body.atencionId),
        contenido,
        datos: datos as Prisma.InputJsonValue | undefined,
        total,
      },
      include,
    })
  })
  return NextResponse.json(documento, { status: 201 })
}
