import type { Prisma, PrismaClient } from '@/generated/prisma/client'
import { prisma } from '@/lib/prisma'
import { PLANTILLAS_BASE, PREFIJO_TIPO } from '@/lib/documentos'

type ClientLike = PrismaClient | Prisma.TransactionClient

/** Siguiente número correlativo atómico por tipo: REC-000001, PRE-000001, CON-000001. */
export async function siguienteNumeroDocumento(client: ClientLike, tipo: string) {
  const prefijo = PREFIJO_TIPO[tipo] ?? 'DOC'
  const rows = await client.$queryRaw<{ valor: number }[]>`
    INSERT INTO "Secuencia" ("id", "valor") VALUES (${`DOC-${prefijo}`}, 1)
    ON CONFLICT ("id") DO UPDATE SET "valor" = "Secuencia"."valor" + 1
    RETURNING "valor"
  `
  return `${prefijo}-${String(rows[0].valor).padStart(6, '0')}`
}

/** Carga las plantillas base la primera vez (cuando todavía no hay ninguna). */
export async function asegurarPlantillasBase() {
  const total = await prisma.documentoPlantilla.count()
  if (total > 0) return
  await prisma.documentoPlantilla.createMany({
    data: PLANTILLAS_BASE.map((p) => ({ tipo: p.tipo, nombre: p.nombre, contenido: p.contenido, campos: p.campos as unknown as Prisma.InputJsonValue, sistema: true })),
  })
}
