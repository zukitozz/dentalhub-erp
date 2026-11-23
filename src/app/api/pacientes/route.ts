import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireApiAuth } from '@/lib/api-auth'

export const dynamic = 'force-dynamic'

/** RUC peruano: 11 dígitos, prefijo 10/15/16/17/20 y dígito verificador módulo 11 (SUNAT rechaza los que no cumplen). */
function rucValido(ruc: string): boolean {
  if (!/^(10|15|16|17|20)\d{9}$/.test(ruc)) return false
  const pesos = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2]
  const suma = pesos.reduce((acc, p, i) => acc + p * Number(ruc[i]), 0)
  return (11 - (suma % 11)) % 10 === Number(ruc[10])
}

function errorRuc(body: Record<string, unknown>) {
  const ruc = typeof body.ruc === 'string' ? body.ruc.trim() : ''
  if (ruc && !rucValido(ruc)) {
    return NextResponse.json({ error: 'RUC inválido: debe tener 11 dígitos reales (SUNAT rechaza RUC inexistentes al enviar el comprobante)' }, { status: 400 })
  }
  return null
}

export async function GET() {
  const guard = await requireApiAuth()
  if (guard) return guard
  const pacientes = await prisma.paciente.findMany({
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(pacientes)
}

function pacienteData(body: Record<string, unknown>) {
  return {
    nombre: body.nombre as string,
    dni: (body.dni as string) || null,
    ruc: (body.ruc as string) || null,
    carnetExtranjeria: (body.carnetExtranjeria as string) || null,
    razonSocial: (body.razonSocial as string) || null,
    celular: (body.celular as string) || null,
    distrito: (body.distrito as string) || null,
    email: (body.email as string) || null,
    fechaNacimiento: body.fechaNacimiento ? new Date(body.fechaNacimiento as string) : null,
    direccion: (body.direccion as string) || null,
    sexo: (body.sexo as string) || null,
    ocupacion: (body.ocupacion as string) || null,
    apoderado: (body.apoderado as string) || null,
    contactoEmergencia: (body.contactoEmergencia as string) || null,
    alergias: (body.alergias as string) || null,
    notas: (body.notas as string) || null,
  }
}

export async function POST(req: Request) {
  const guard = await requireApiAuth()
  if (guard) return guard
  const body = await req.json()
  const rucError = errorRuc(body)
  if (rucError) return rucError

  const dni = typeof body.dni === 'string' ? body.dni.trim() : ''
  if (dni) {
    const pacienteExistente = await prisma.paciente.findUnique({ where: { dni } })
    if (pacienteExistente) {
      return NextResponse.json({ error: 'El DNI ya está registrado en otro paciente' }, { status: 409 })
    }
  }

  try {
    const paciente = await prisma.paciente.create({ data: pacienteData(body) })
    return NextResponse.json(paciente, { status: 201 })
  } catch (error) {
    if (error instanceof Error && 'code' in error && (error as { code?: string }).code === 'P2002') {
      return NextResponse.json({ error: 'Ese DNI, RUC o Carnet de Extranjería ya está registrado en otro paciente' }, { status: 409 })
    }
    throw error
  }
}

export async function PUT(req: Request) {
  const guard = await requireApiAuth()
  if (guard) return guard
  const body = await req.json()
  const rucError = errorRuc(body)
  if (rucError) return rucError

  if (!body.id) {
    return NextResponse.json({ error: 'ID requerido' }, { status: 400 })
  }

  try {
    const updated = await prisma.paciente.update({
      where: { id: body.id },
      data: pacienteData(body),
    })
    return NextResponse.json(updated)
  } catch (error) {
    if (error instanceof Error && 'code' in error && (error as { code?: string }).code === 'P2002') {
      return NextResponse.json({ error: 'Ese DNI, RUC o Carnet de Extranjería ya está registrado en otro paciente' }, { status: 409 })
    }
    throw error
  }
}

export async function DELETE(req: Request) {
  const guard = await requireApiAuth(['ADMIN', 'SUPERVISOR'])
  if (guard) return guard
  const url = new URL(req.url)
  const id = url.searchParams.get('id')

  if (!id) {
    return NextResponse.json({ error: 'ID requerido' }, { status: 400 })
  }

  await prisma.paciente.delete({ where: { id } })

  return NextResponse.json({ success: true })
}
