import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { requireApiAuth } from '@/lib/api-auth'
import { CONDICION_POR_CODIGO, ESTADOS_HALLAZGO, esPiezaValida, SUPERFICIES } from '@/lib/odontograma'

export const dynamic = 'force-dynamic'

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const guard = await requireApiAuth()
  if (guard) return guard

  const hallazgos = await prisma.odontogramaHallazgo.findMany({
    where: { pacienteId: id, activo: true },
    include: { odontologo: { select: { id: true, name: true } } },
    orderBy: { creadoAt: 'asc' },
  })
  return NextResponse.json(hallazgos)
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const guard = await requireApiAuth()
  if (guard) return guard
  const session = await auth()

  const body = await req.json()
  const pieza = Number(body.pieza)
  const condicion = typeof body.condicion === 'string' ? body.condicion : ''
  const estado = typeof body.estado === 'string' ? body.estado : 'EXISTENTE'
  const definicion = CONDICION_POR_CODIGO[condicion]

  if (!esPiezaValida(pieza)) return NextResponse.json({ error: 'Pieza dental inválida (notación FDI)' }, { status: 400 })
  if (!definicion) return NextResponse.json({ error: 'Condición inválida' }, { status: 400 })
  if (!ESTADOS_HALLAZGO.some((e) => e.codigo === estado)) return NextResponse.json({ error: 'Estado inválido' }, { status: 400 })

  // Las condiciones de toda la pieza no llevan superficie; las demás pueden marcar varias.
  const superficies = definicion.porSuperficie && Array.isArray(body.superficies)
    ? (body.superficies as unknown[]).filter((s): s is string => typeof s === 'string' && SUPERFICIES.some((x) => x.codigo === s))
    : []
  const lista: (string | null)[] = superficies.length > 0 ? superficies : [null]

  const paciente = await prisma.paciente.findUnique({ where: { id }, select: { id: true } })
  if (!paciente) return NextResponse.json({ error: 'Paciente no encontrado' }, { status: 404 })

  const notas = typeof body.notas === 'string' && body.notas.trim() ? body.notas.trim() : null
  const atencionId = typeof body.atencionId === 'string' && body.atencionId ? body.atencionId : null

  const creados = await prisma.$transaction(
    lista.map((superficie) =>
      prisma.odontogramaHallazgo.create({
        data: {
          pacienteId: id,
          pieza,
          superficie,
          condicion,
          estado: estado as 'EXISTENTE' | 'PLANIFICADO' | 'REALIZADO',
          notas,
          atencionId,
          odontologoId: session?.user?.role === 'ODONTOLOGO' ? session.user.id : null,
        },
      })
    )
  )
  return NextResponse.json(creados, { status: 201 })
}
