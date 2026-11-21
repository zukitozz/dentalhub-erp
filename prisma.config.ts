import 'dotenv/config'
import { defineConfig } from 'prisma/config'

// Prisma 7: la URL de conexión vive aquí (no en schema.prisma). Se lee de .env.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations', seed: 'tsx prisma/seed.ts' },
  datasource: { url: process.env.DATABASE_URL ?? 'postgresql://user:pass@localhost:5432/hubdental' },
})
