import { PrismaPg } from '@prisma/adapter-pg'
import bcrypt from 'bcryptjs'
import { PrismaClient, type Prisma } from '../src/generated/prisma/client'
import { PLANTILLAS_BASE } from '../src/lib/documentos'

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: process.env.DATABASE_SSL_STRICT === 'true' } : undefined,
  }),
})

async function main() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase()
  const password = process.env.ADMIN_PASSWORD
  const name = process.env.ADMIN_NAME || 'Gerente'

  if (!email || !password) {
    throw new Error('Define ADMIN_EMAIL y ADMIN_PASSWORD antes de ejecutar el seed.')
  }

  const passwordHash = await bcrypt.hash(password, 12)
  const user = await prisma.user.upsert({
    where: { email },
    update: { name, password: passwordHash, role: 'SUPERVISOR', activo: true },
    create: { name, email, password: passwordHash, role: 'SUPERVISOR' },
  })
  console.log(`Gerente listo: ${user.email}`)

  await prisma.configuracion.upsert({ where: { id: 'default' }, update: {}, create: { id: 'default' } })

  if ((await prisma.documentoPlantilla.count()) === 0) {
    await prisma.documentoPlantilla.createMany({
      data: PLANTILLAS_BASE.map((p) => ({ tipo: p.tipo, nombre: p.nombre, contenido: p.contenido, campos: p.campos as unknown as Prisma.InputJsonValue, sistema: true })),
    })
    console.log(`Plantillas de documentos cargadas: ${PLANTILLAS_BASE.length}`)
  }
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => prisma.$disconnect())
