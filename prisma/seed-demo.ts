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
  // Series de comprobantes habilitadas (el prefijo F/B/NV se resuelve aparte; aquí va el correlativo de 3 dígitos).
  const SERIES = [
    { tipoComprobante: '01', codigoProposito: 'FACTURA', serie: '001', descripcion: 'Facturas electrónicas (F001)' },
    { tipoComprobante: '03', codigoProposito: 'BOLETA', serie: '001', descripcion: 'Boletas electrónicas (B001)' },
    { tipoComprobante: '07', codigoProposito: 'NOTA_CREDITO', serie: '001', descripcion: 'Notas de crédito' },
    { tipoComprobante: '08', codigoProposito: 'NOTA_DEBITO', serie: '001', descripcion: 'Notas de débito' },
    { tipoComprobante: '50', codigoProposito: 'NOTA_DESPACHO', serie: '001', descripcion: 'Notas de despacho (ND)' },
    { tipoComprobante: '51', codigoProposito: 'NOTA_VENTA', serie: '001', descripcion: 'Notas de venta / despacho' },
  ]
  for (const s of SERIES) {
    const existe = await prisma.serie.findFirst({ where: { tipoComprobante: s.tipoComprobante, serie: s.serie } })
    if (existe) await prisma.serie.update({ where: { id: existe.id }, data: { estado: 1 } })
    else await prisma.serie.create({ data: { ...s, estado: 1 } })
  }

  const config = await prisma.configuracion.upsert({ where: { id: 'default' }, update: {}, create: { id: 'default' } })
  if (!config.ruc) await prisma.configuracion.update({ where: { id: 'default' }, data: { ruc: '20123456789', razonSocial: 'HubDental S.A.C.' } })
  const ruc = config.ruc ?? '20123456789'

  // Citas, atenciones y comprobantes de ejemplo para hoy (solo si aún no hay citas de hoy).
  const inicioDia = new Date()
  inicioDia.setHours(0, 0, 0, 0)
  const finDia = new Date(inicioDia.getTime() + 24 * 3600 * 1000)
  const odontologo = await prisma.user.findUniqueOrThrow({ where: { email: 'odontologo@hubdental.pe' } })
  const admin = await prisma.user.findUniqueOrThrow({ where: { email: 'recepcion@hubdental.pe' } })
  const pacientes = await prisma.paciente.findMany({ take: 3, orderBy: { createdAt: 'asc' } })
  const consultorios = await prisma.consultorio.findMany({ orderBy: { nombre: 'asc' } })
  const trats = await prisma.tratamiento.findMany()
  const trat = (n: string) => trats.find((t) => t.nombre.startsWith(n))!
  const hoy = (h: number, m = 0) => new Date(inicioDia.getTime() + (h * 60 + m) * 60000)

  if (pacientes.length === 3 && (await prisma.cita.count({ where: { fecha: { gte: inicioDia, lt: finDia } } })) === 0) {
    const plan = [
      { p: pacientes[0], t: 'Consulta', h: 9, estado: 'ATENDIDA' as const },
      { p: pacientes[1], t: 'Profilaxis', h: 10, m: 30, estado: 'ATENDIDA' as const },
      { p: pacientes[2], t: 'Control de ortodoncia', h: 12, estado: 'CONFIRMADA' as const },
      { p: pacientes[0], t: 'Aplicación de flúor', h: 15, estado: 'PENDIENTE' as const },
      { p: pacientes[1], t: 'Resina compuesta (1', h: 17, estado: 'PENDIENTE' as const },
    ]
    const citas = []
    for (const c of plan) {
      const t = trat(c.t)
      citas.push(await prisma.cita.create({
        data: { pacienteId: c.p.id, fecha: hoy(c.h, c.m ?? 0), tratamiento: t.nombre, duracionMin: t.duracionMin, odontologoId: odontologo.id, estado: c.estado, registrado: c.estado === 'ATENDIDA' },
      }))
    }

    const comprobantes = [
      { cita: citas[0], t: 'Consulta', tipo: 'BOLETA' as const, cod: '03', pref: 'B', metodo: 'EFECTIVO' as const },
      { cita: citas[1], t: 'Profilaxis', tipo: 'FACTURA' as const, cod: '01', pref: 'F', metodo: 'TARJETA' as const },
    ]
    for (const [i, c] of comprobantes.entries()) {
      const t = trat(c.t)
      const precio = t.precio
      const atencion = await prisma.atencion.create({
        data: { pacienteId: c.cita.pacienteId!, citaId: c.cita.id, consultorioId: consultorios[i % Math.max(consultorios.length, 1)]?.id, horaInicio: c.cita.fecha, horaFin: new Date(c.cita.fecha.getTime() + (t.duracionMin ?? 30) * 60000) },
      })
      const corr = await prisma.correlativo.upsert({
        where: { ruc_tipoDocumento_serie_prefijo: { ruc, tipoDocumento: c.cod, serie: '001', prefijo: c.pref } },
        update: { numeracion: { increment: 1 } },
        create: { ruc, tipoDocumento: c.cod, serie: '001', prefijo: c.pref, numeracion: 1 },
      })
      const gravadas = Math.round((precio / 1.18) * 100) / 100
      const factura = await prisma.factura.create({
        data: {
          pacienteId: c.cita.pacienteId!, tipo: c.tipo, total: precio, metodoPago: c.metodo, estado: 'PAGADO', usuarioId: admin.id,
          tipoComprobante: c.cod, numeracionComprobante: `${c.pref}001-${String(corr.numeracion).padStart(8, '0')}`,
          fechaHora: c.cita.fecha, fechaEmision: c.cita.fecha, totalVenta: String(precio), gravadas, igv: Math.round((precio - gravadas) * 100) / 100,
          ruc, pagoEfectivo: c.metodo === 'EFECTIVO' ? precio : null, pagoTarjeta: c.metodo === 'TARJETA' ? precio : null,
          items: { create: [{ nombre: t.nombre, cantidad: 1, precioUnit: precio, total: precio, precioCatalogo: precio }] },
        },
      })
      await prisma.atencionTratamiento.create({
        data: { atencionId: atencion.id, tratamientoId: t.id, odontologoId: odontologo.id, estado: 'FINALIZADA', precio, precioCatalogo: precio, horaInicio: atencion.horaInicio, horaFin: atencion.horaFin, facturaId: factura.id },
      })
    }
  }
  console.log('Datos de demostración listos (usuarios: odontologo@hubdental.pe / recepcion@hubdental.pe, clave Odontologo123!).')
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => prisma.$disconnect())
