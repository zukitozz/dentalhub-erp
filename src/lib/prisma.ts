import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@/generated/prisma/client'

const globalForPrisma = global as unknown as { prisma?: PrismaClient }

function crearCliente(): PrismaClient {
  // DATABASE_POOL_MAX limita las conexiones por instancia (útil en serverless contra RDS).
  // Prisma 7 se conecta mediante un driver adapter. En AWS RDS el certificado lo firma la CA de
  // Amazon: define DATABASE_SSL=true para exigir TLS (rejectUnauthorized:false si no cargas el bundle de RDS).
  const ssl = process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: process.env.DATABASE_SSL_STRICT === 'true' } : undefined
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL, ssl, max: Number(process.env.DATABASE_POOL_MAX) || undefined })
  return new PrismaClient({ adapter })
}

export const prisma = globalForPrisma.prisma ?? crearCliente()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
