import { Prisma, ConsultorioEstado } from '@/generated/prisma/client'

type TxClient = Prisma.TransactionClient

export async function cambiarEstadoConsultorio(
  tx: TxClient,
  params: {
    consultorioId: string
    estadoNuevo: ConsultorioEstado
    usuarioId: string
    atencionId?: string | null
    motivo?: string | null
  }
) {
  const consultorio = await tx.consultorio.findUnique({ where: { id: params.consultorioId } })
  if (!consultorio) {
    throw new Error('Consultorio no encontrada')
  }

  const actualizada = await tx.consultorio.update({
    where: { id: params.consultorioId },
    data: { estado: params.estadoNuevo },
  })

  await tx.consultorioEstadoLog.create({
    data: {
      consultorioId: params.consultorioId,
      estadoAnterior: consultorio.estado,
      estadoNuevo: params.estadoNuevo,
      usuarioId: params.usuarioId,
      atencionId: params.atencionId ?? null,
      motivo: params.motivo ?? null,
    },
  })

  return actualizada
}

export const atencionActualInclude = {
  atenciones: {
    where: { tratamientos: { some: { estado: { in: ['PENDIENTE', 'EN_CURSO'] } } } },
    include: {
      paciente: { select: { id: true, nombre: true } },
      tratamientos: {
        orderBy: { orden: 'asc' as const },
        include: {
          tratamiento: { select: { id: true, nombre: true, diasProximoTratamiento: true } },
          odontologo: { select: { id: true, name: true } },
        },
      },
    },
    take: 1,
  },
} satisfies Prisma.ConsultorioInclude

type ConsultorioConAtenciones = Prisma.ConsultorioGetPayload<{ include: typeof atencionActualInclude }>

export function mapConsultorioConAtencion(consultorio: ConsultorioConAtenciones) {
  const { atenciones, ...resto } = consultorio
  return { ...resto, atencionActual: atenciones[0] ?? null }
}
