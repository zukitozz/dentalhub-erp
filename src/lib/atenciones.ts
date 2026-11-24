import { Prisma } from '@/generated/prisma/client'
import { prisma } from '@/lib/prisma'
import { cambiarEstadoConsultorio } from '@/lib/consultorios'

type TxClient = Prisma.TransactionClient

const LINEAS_ABIERTAS = ['PENDIENTE', 'EN_CURSO'] as const

export const atencionEnCursoInclude = {
  paciente: { select: { id: true, nombre: true } },
  consultorio: { select: { id: true, nombre: true } },
  cita: { select: { id: true, fecha: true } },
  tratamientos: {
    orderBy: { orden: 'asc' as const },
    include: {
      tratamiento: { select: { id: true, nombre: true, diasProximoTratamiento: true } },
      odontologo: { select: { id: true, name: true } },
    },
  },
} satisfies Prisma.AtencionInclude

export type AtencionEnCurso = Prisma.AtencionGetPayload<{ include: typeof atencionEnCursoInclude }>

// Una línea sigue visible en el dashboard mientras esté abierta o, ya finalizada, hasta que se le
// emita un comprobante (factura, boleta o nota de venta): ahí se le asigna facturaId.
const lineaVisible: Prisma.AtencionTratamientoWhereInput = {
  OR: [{ estado: { in: [...LINEAS_ABIERTAS] } }, { estado: 'FINALIZADA', facturaId: null }],
}

export async function listarAtencionesEnCurso(role: string, userId: string, sedeId?: string | null) {
  const where: Prisma.AtencionWhereInput = {
    ...(sedeId ? { sedeId } : {}),
    tratamientos: { some: role === 'ODONTOLOGO' ? { AND: [lineaVisible, { odontologoId: userId }] } : lineaVisible },
  }

  return prisma.atencion.findMany({ where, include: atencionEnCursoInclude, orderBy: { horaInicio: 'asc' } })
}

/**
 * Tras iniciar/finalizar/cancelar una línea de tratamiento, revisa si a la
 * atención (visita) no le queda ninguna línea abierta; si es así, la cierra
 * y, si corresponde, libera el consultorio asociada.
 */
export async function cerrarSesionSiCorresponde(tx: TxClient, atencionId: string, usuarioId: string) {
  const atencion = await tx.atencion.findUnique({
    where: { id: atencionId },
    include: { tratamientos: { select: { estado: true } } },
  })
  if (!atencion) return

  const quedanAbiertos = atencion.tratamientos.some((t) => (LINEAS_ABIERTAS as readonly string[]).includes(t.estado))
  if (quedanAbiertos) return

  await tx.atencion.update({ where: { id: atencion.id }, data: { horaFin: new Date() } })

  if (!atencion.consultorioId) return
  const configuracion = await tx.configuracion.findUnique({ where: { id: 'default' } })
  if (!configuracion?.usaConsultorios) return

  const huboFinalizados = atencion.tratamientos.some((t) => t.estado === 'FINALIZADA')
  await cambiarEstadoConsultorio(tx, {
    consultorioId: atencion.consultorioId,
    estadoNuevo: huboFinalizados ? 'LIMPIEZA' : 'DISPONIBLE',
    usuarioId,
    atencionId: atencion.id,
  })
}
