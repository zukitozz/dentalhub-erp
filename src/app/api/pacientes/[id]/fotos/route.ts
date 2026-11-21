import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireApiAuth } from '@/lib/api-auth'
import { FotoTipo } from '@/generated/prisma/enums'
import { guardarFotoPaciente, urlFirmada } from '@/lib/storage'

export const dynamic = 'force-dynamic'

// Todas las fotografías y radiografías del expediente del paciente (de atenciones o cargadas directamente).
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const guard = await requireApiAuth()
  if (guard) return guard

  const fotos = await prisma.atencionFoto.findMany({ where: { pacienteId: id }, orderBy: { creadoAt: 'desc' } })
  const conUrl = await Promise.all(fotos.map(async ({ key, ...foto }) => ({ ...foto, url: await urlFirmada(key) })))
  return NextResponse.json(conUrl)
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const guard = await requireApiAuth()
  if (guard) return guard

  const paciente = await prisma.paciente.findUnique({ where: { id }, select: { id: true } })
  if (!paciente) return NextResponse.json({ error: 'Paciente no encontrado' }, { status: 404 })

  const formData = await req.formData()
  const file = formData.get('file')
  const descripcion = formData.get('descripcion')
  const tipo = formData.get('tipo')
  const atencionId = formData.get('atencionId')
  if (!(file instanceof File)) return NextResponse.json({ error: 'Archivo requerido' }, { status: 400 })

  try {
    const key = await guardarFotoPaciente(paciente.id, file)
    const { key: _key, ...foto } = await prisma.atencionFoto.create({
      data: {
        pacienteId: paciente.id,
        atencionId: typeof atencionId === 'string' && atencionId ? atencionId : null,
        tipo: typeof tipo === 'string' && tipo in FotoTipo ? (tipo as keyof typeof FotoTipo) : null,
        descripcion: typeof descripcion === 'string' && descripcion ? descripcion : null,
        key,
      },
    })
    return NextResponse.json({ ...foto, url: await urlFirmada(key) }, { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.message === 'TIPO_NO_SOPORTADO') {
      return NextResponse.json({ error: 'Formato de imagen no soportado (usa JPG, PNG, WEBP o HEIC)' }, { status: 400 })
    }
    if (error instanceof Error && error.message === 'ARCHIVO_MUY_GRANDE') {
      return NextResponse.json({ error: 'La imagen supera el tamaño máximo permitido (8MB)' }, { status: 400 })
    }
    throw error
  }
}
