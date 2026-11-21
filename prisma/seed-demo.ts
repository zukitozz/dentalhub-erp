// Datos de demostración: catálogo de tratamientos, consultorios, un odontólogo y pacientes de ejemplo.
// Uso: npm run seed:demo   (después de npm run seed)
import { PrismaPg } from '@prisma/adapter-pg'
import bcrypt from 'bcryptjs'
import { PrismaClient } from '../src/generated/prisma/client'

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: process.env.DATABASE_SSL_STRICT === 'true' } : undefined,
  }),
})

const TRATAMIENTOS = [
  { nombre: 'Consulta y diagnóstico', categoria: 'Diagnóstico', precio: 60, duracionMin: 30 },
  { nombre: 'Profilaxis (limpieza dental)', categoria: 'Preventiva', precio: 120, duracionMin: 45, diasProximoTratamiento: 180 },
  { nombre: 'Aplicación de flúor', categoria: 'Preventiva', precio: 70, duracionMin: 20, diasProximoTratamiento: 180 },
  { nombre: 'Sellante de fosas y fisuras', categoria: 'Preventiva', precio: 80, duracionMin: 30 },
  { nombre: 'Resina compuesta (1 superficie)', categoria: 'Restauradora', precio: 130, duracionMin: 45 },
  { nombre: 'Resina compuesta (2 o más superficies)', categoria: 'Restauradora', precio: 180, duracionMin: 60 },
  { nombre: 'Endodoncia unirradicular', categoria: 'Endodoncia', precio: 450, duracionMin: 75, diasProximoTratamiento: 7 },
  { nombre: 'Endodoncia multirradicular', categoria: 'Endodoncia', precio: 650, duracionMin: 90, diasProximoTratamiento: 7 },
  { nombre: 'Corona de porcelana', categoria: 'Rehabilitación', precio: 900, duracionMin: 60 },
  { nombre: 'Extracción simple', categoria: 'Cirugía', precio: 150, duracionMin: 30 },
  { nombre: 'Extracción de tercer molar', categoria: 'Cirugía', precio: 400, duracionMin: 60 },
  { nombre: 'Blanqueamiento dental en consultorio', categoria: 'Estética', precio: 550, duracionMin: 90 },
  { nombre: 'Control de ortodoncia', categoria: 'Ortodoncia', precio: 100, duracionMin: 30, diasProximoTratamiento: 30 },
  { nombre: 'Instalación de brackets metálicos', categoria: 'Ortodoncia', precio: 1800, duracionMin: 90 },
]

async function main() {
  const hash = await bcrypt.hash('Odontologo123!', 12)
  await prisma.user.upsert({
    where: { email: 'odontologo@hubdental.pe' },
    update: {},
    create: { name: 'Dra. Camila Rojas', email: 'odontologo@hubdental.pe', password: hash, role: 'ODONTOLOGO', colegiatura: '34567', especialidad: 'Cirujano dentista' },
  })
  await prisma.user.upsert({
    where: { email: 'recepcion@hubdental.pe' },
    update: {},
    create: { name: 'Recepción', email: 'recepcion@hubdental.pe', password: hash, role: 'ADMIN' },
  })

  if ((await prisma.tratamiento.count()) === 0) await prisma.tratamiento.createMany({ data: TRATAMIENTOS })
  if ((await prisma.consultorio.count()) === 0) {
    await prisma.consultorio.createMany({ data: [{ nombre: 'Consultorio 1' }, { nombre: 'Consultorio 2' }] })
  }

  if ((await prisma.paciente.count()) === 0) {
    await prisma.paciente.createMany({
      data: [
        { nombre: 'Ana Martínez Quispe', dni: '45879632', celular: '987654321', distrito: 'Miraflores', fechaNacimiento: new Date('1990-10-14T12:00:00-05:00'), sexo: 'F' },
        { nombre: 'Luis Paredes Soto', dni: '40123987', celular: '954321876', distrito: 'San Isidro', fechaNacimiento: new Date('1985-03-02T12:00:00-05:00'), sexo: 'M', alergias: 'Penicilina' },
        { nombre: 'Mateo Flores Díaz', dni: '75412036', celular: '912345678', distrito: 'Surco', fechaNacimiento: new Date('2016-07-21T12:00:00-05:00'), sexo: 'M', apoderado: 'Rosa Díaz (madre)' },
      ],
    })
  }
  console.log('Datos de demostración listos (usuarios: odontologo@hubdental.pe / recepcion@hubdental.pe, clave Odontologo123!).')
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => prisma.$disconnect())
