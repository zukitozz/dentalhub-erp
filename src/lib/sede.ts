import { cookies } from 'next/headers'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const COOKIE_SEDE = 'hubdental.sede'
export const SEDE_TODAS = 'todas'

export interface SedeCtx {
  userId: string
  role: 'SUPERVISOR' | 'ADMIN' | 'ODONTOLOGO'
  /** Sede por la que se filtran las lecturas; null = todas (solo el gerente). */
  sedeLectura: string | null
  /** Sede con la que se registran los datos nuevos. */
  sedeEscritura: string | null
  /** Filtro listo para usar en `where` de Prisma. */
  filtro: { sedeId?: string }
}

/**
 * Contexto de sede del usuario autenticado. Recepción y odontólogos quedan fijos a su sede;
 * el gerente (sin sede) elige con un selector (cookie) una sede o "todas" para consultar.
 */
export async function getSedeCtx(): Promise<SedeCtx | null> {
  const session = await auth()
  if (!session?.user?.id) return null
  const role = session.user.role
  const usuario = await prisma.user.findUnique({ where: { id: session.user.id }, select: { sedeId: true } })

  if (role !== 'SUPERVISOR') {
    const sedeId = usuario?.sedeId ?? null
    return { userId: session.user.id, role, sedeLectura: sedeId, sedeEscritura: sedeId, filtro: sedeId ? { sedeId } : {} }
  }

  const elegida = (await cookies()).get(COOKIE_SEDE)?.value
  let sedeLectura: string | null = null
  if (elegida && elegida !== SEDE_TODAS) {
    const existe = await prisma.sede.findFirst({ where: { id: elegida, activo: true }, select: { id: true } })
    sedeLectura = existe?.id ?? null
  }
  // Con "todas", lo nuevo que registre el gerente va a la primera sede activa.
  const sedeEscritura = sedeLectura ?? (await prisma.sede.findFirst({ where: { activo: true }, orderBy: { creadoAt: 'asc' }, select: { id: true } }))?.id ?? null
  return { userId: session.user.id, role, sedeLectura, sedeEscritura, filtro: sedeLectura ? { sedeId: sedeLectura } : {} }
}

/** Precio efectivo de un tratamiento en una sede (precio propio de la sede o el base). */
export async function preciosTratamientoSede(sedeId: string | null) {
  if (!sedeId) return new Map<string, { precio: number | null; activo: boolean }>()
  const filas = await prisma.tratamientoSede.findMany({ where: { sedeId } })
  return new Map(filas.map((f) => [f.tratamientoId, { precio: f.precio, activo: f.activo }]))
}

export async function precioTratamiento(tratamientoId: string, precioBase: number, sedeId: string | null): Promise<number> {
  if (!sedeId) return precioBase
  const fila = await prisma.tratamientoSede.findUnique({ where: { tratamientoId_sedeId: { tratamientoId, sedeId } } })
  return fila?.precio ?? precioBase
}

export async function precioProducto(productoId: string, precioBase: number, sedeId: string | null): Promise<number> {
  if (!sedeId) return precioBase
  const fila = await prisma.productoSede.findUnique({ where: { productoId_sedeId: { productoId, sedeId } } })
  return fila?.precioVenta ?? precioBase
}

/** Serie activa para un tipo de documento: la propia de la sede o, si no tiene, una general (sin sede). */
export async function buscarSerie(tipoComprobante: string, sedeId: string | null) {
  return (
    (sedeId ? await prisma.serie.findFirst({ where: { tipoComprobante, estado: 1, sedeId } }) : null) ??
    (await prisma.serie.findFirst({ where: { tipoComprobante, estado: 1, sedeId: null } })) ??
    (!sedeId ? await prisma.serie.findFirst({ where: { tipoComprobante, estado: 1 } }) : null)
  )
}
