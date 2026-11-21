import { NextResponse } from 'next/server'
import type { Prisma } from '@/generated/prisma/client'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { requireApiAuth } from '@/lib/api-auth'

export const dynamic = 'force-dynamic'

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const guard = await requireApiAuth()
  if (guard) return guard

  const historia = await prisma.historiaClinica.findUnique({ where: { pacienteId: id } })
  return NextResponse.json(historia)
}

const TEXTOS = ['motivoConsulta', 'enfermedadActual', 'medicamentosActuales', 'alergias', 'antecedentesOdontologicos', 'habitos', 'examenClinico', 'observaciones'] as const

// Crea o actualiza la historia clínica (anamnesis) del paciente.
export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const guard = await requireApiAuth()
  if (guard) return guard
  const session = await auth()

  const paciente = await prisma.paciente.findUnique({ where: { id }, select: { id: true } })
  if (!paciente) return NextResponse.json({ error: 'Paciente no encontrado' }, { status: 404 })

  const body = await req.json()
  const data: Record<string, string | null> = {}
  for (const campo of TEXTOS) {
    const valor = body[campo]
    data[campo] = typeof valor === 'string' && valor.trim() ? valor.trim() : null
  }
  const antecedentes: Record<string, boolean> = {}
  if (body.antecedentes && typeof body.antecedentes === 'object') {
    for (const [clave, valor] of Object.entries(body.antecedentes as Record<string, unknown>)) {
      if (valor === true) antecedentes[clave] = true
    }
  }

  const campos = { ...data, antecedentes: antecedentes as Prisma.InputJsonValue, actualizadoPorId: session?.user?.id ?? null }
  const historia = await prisma.historiaClinica.upsert({
    where: { pacienteId: id },
    update: campos,
    create: { pacienteId: id, ...campos },
  })

  // Las alergias también viven en la ficha del paciente: así salen en alertas y documentos.
  await prisma.paciente.update({ where: { id }, data: { alergias: data.alergias } })
  return NextResponse.json(historia)
}
