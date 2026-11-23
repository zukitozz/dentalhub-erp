import { prisma } from '@/lib/prisma'
import { obtenerCorrelativo, resolverPrefijo } from '@/lib/correlativos'
import { numeroALetras } from '@/lib/numeroALetras'
import { CODIGO_SUNAT_TIPO_COMPROBANTE, TIPO_DOCUMENTO_CORRELATIVO } from '@/lib/comprobantes'
import { enviarFacturaASunat } from '@/lib/enviarFactura'
import { asegurarPdfComprobante } from '@/lib/comprobantePdf'
import type { MetodoPago } from '@/generated/prisma/client'

const IGV_PORCENTAJE = Number(process.env.IGV_PORCENTAJE || '18')

function round2(value: number) {
  return Math.round(value * 100) / 100
}

/** Error de validación de negocio (se traduce a un 400 en la API, a diferencia de un error inesperado). */
export class PlanError extends Error {}

export function calcularSaldo(precioTotal: number, abonosActivos: { total: number }[]) {
  const pagado = round2(abonosActivos.reduce((sum, abono) => sum + abono.total, 0))
  return { pagado, saldo: round2(precioTotal - pagado) }
}

export async function registrarSesion(params: { planId: string; fecha?: string; notas?: string; usuarioId: string }) {
  const plan = await prisma.plan.findUnique({
    where: { id: params.planId },
    include: { sesiones: true },
  })
  if (!plan) throw new PlanError('Plan no encontrado')
  if (!plan.activo) throw new PlanError('El plan no está activo')
  if (plan.sesiones.length >= plan.sesionesTotal) {
    throw new PlanError('Ya se registraron todas las sesiones del plan')
  }

  return prisma.planSesion.create({
    data: {
      plan: { connect: { id: plan.id } },
      numero: plan.sesiones.length + 1,
      fecha: params.fecha ? new Date(params.fecha) : new Date(),
      notas: params.notas || null,
      usuario: { connect: { id: params.usuarioId } },
    },
  })
}

export async function eliminarSesion(params: { planId: string; sesionId: string }) {
  const sesion = await prisma.planSesion.findUnique({ where: { id: params.sesionId } })
  if (!sesion || sesion.planId !== params.planId) {
    throw new PlanError('Sesión no encontrada en este plan')
  }
  await prisma.planSesion.delete({ where: { id: params.sesionId } })
}

/** Si todos los abonos comparten método de pago se usa ese; si no, 'MIXTO'. */
export function resolverMetodoPagoConsolidado(abonos: { metodoPago: string }[]): MetodoPago {
  const metodos = new Set(abonos.map((abono) => abono.metodoPago))
  return (metodos.size === 1 ? [...metodos][0] : 'MIXTO') as MetodoPago
}

export async function registrarAbono(params: { planId: string; monto: number; metodoPago: MetodoPago; usuarioId: string }) {
  const { planId, metodoPago, usuarioId } = params
  const monto = round2(Number(params.monto))
  if (!(monto > 0)) {
    throw new PlanError('El monto del abono debe ser mayor a 0')
  }

  const plan = await prisma.plan.findUnique({
    where: { id: planId },
    include: { facturas: { where: { tipo: 'NOTA_VENTA', activo: true } } },
  })
  if (!plan) throw new PlanError('Plan no encontrado')
  if (plan.estado !== 'ABIERTO') throw new PlanError('El plan ya está cerrado')

  const { saldo } = calcularSaldo(plan.precioTotal, plan.facturas)
  if (monto > saldo + 0.01) {
    throw new PlanError(`El monto excede el saldo pendiente (S/ ${saldo.toFixed(2)})`)
  }

  const configuracion = await prisma.configuracion.findUnique({ where: { id: 'default' }, select: { ruc: true } })
  if (!configuracion?.ruc) throw new PlanError('RUC del emisor no configurado')

  const tipoDocumento = TIPO_DOCUMENTO_CORRELATIVO.NOTA_VENTA
  const serieConfig = await prisma.serie.findFirst({ where: { tipoComprobante: tipoDocumento, estado: 1 } })
  if (!serieConfig) throw new PlanError('No hay serie configurada para nota de venta')

  const gravadas = round2(monto / (1 + IGV_PORCENTAJE / 100))
  const igv = round2(monto - gravadas)

  const abono = await prisma.$transaction(async (tx) => {
    const prefijo = resolverPrefijo(tipoDocumento)
    const numeracionComprobante = await obtenerCorrelativo(tx, {
      ruc: configuracion.ruc!,
      tipoDocumento,
      serie: serieConfig.serie,
      prefijo,
    })

    return tx.factura.create({
      data: {
        paciente: { connect: { id: plan.pacienteId } },
        plan: { connect: { id: plan.id } },
        tipo: 'NOTA_VENTA',
        total: monto,
        metodoPago,
        estado: 'PAGADO',
        items: {
          create: [{ nombre: `Abono - ${plan.nombre}`, cantidad: 1, precioUnit: monto, total: monto }],
        },
        tipoComprobante: CODIGO_SUNAT_TIPO_COMPROBANTE.NOTA_VENTA,
        numeracionComprobante,
        fechaHora: new Date(),
        fechaEmision: new Date(),
        totalVenta: String(monto),
        gravadas,
        igv,
        montoLetras: numeroALetras(monto),
        enviado: false,
        usuario: { connect: { id: usuarioId } },
        ruc: configuracion.ruc,
      },
      include: { paciente: true, items: true },
    })
  })
  await asegurarPdfComprobante(abono.id)
  return abono
}

export async function emitirComprobanteFinal(params: {
  planId: string
  notaIds: string[]
  tipo: 'BOLETA' | 'FACTURA'
  usuarioId: string
}) {
  const { planId, notaIds, tipo, usuarioId } = params
  if (notaIds.length === 0) {
    throw new PlanError('Selecciona al menos una nota de venta para emitir el comprobante')
  }

  const plan = await prisma.plan.findUnique({
    where: { id: planId },
    include: { facturas: { where: { tipo: 'NOTA_VENTA', activo: true } } },
  })
  if (!plan) throw new PlanError('Plan no encontrado')
  if (plan.estado !== 'ABIERTO') throw new PlanError('El plan ya fue cerrado')

  // El saldo se evalúa sobre TODOS los abonos activos, no solo los seleccionados: deseleccionar
  // una nota para excluirla del comprobante final no reabre el plan, solo decide qué se consolida.
  const { saldo } = calcularSaldo(plan.precioTotal, plan.facturas)
  if (Math.abs(saldo) > 0.01) {
    throw new PlanError('El plan aún tiene saldo pendiente; debe estar pagado al 100% para emitir el comprobante final')
  }

  const notasSeleccionadas = plan.facturas.filter((factura) => notaIds.includes(factura.id))
  if (notasSeleccionadas.length !== notaIds.length) {
    throw new PlanError('Alguna nota de venta seleccionada no pertenece a este plan o ya fue absorbida')
  }

  const total = round2(notasSeleccionadas.reduce((sum, nota) => sum + nota.total, 0))
  const metodoPago = resolverMetodoPagoConsolidado(notasSeleccionadas)

  const tipoDocumento = TIPO_DOCUMENTO_CORRELATIVO[tipo]
  const configuracion = await prisma.configuracion.findUnique({ where: { id: 'default' }, select: { ruc: true } })
  if (!configuracion?.ruc) throw new PlanError('RUC del emisor no configurado')

  const serieConfig = await prisma.serie.findFirst({ where: { tipoComprobante: tipoDocumento, estado: 1 } })
  if (!serieConfig) throw new PlanError(`No hay serie configurada para el tipo de documento ${tipoDocumento}`)

  const gravadas = round2(total / (1 + IGV_PORCENTAJE / 100))
  const igv = round2(total - gravadas)

  const factura = await prisma.$transaction(async (tx) => {
    const prefijo = resolverPrefijo(tipoDocumento)
    const numeracionComprobante = await obtenerCorrelativo(tx, {
      ruc: configuracion.ruc!,
      tipoDocumento,
      serie: serieConfig.serie,
      prefijo,
    })

    const creada = await tx.factura.create({
      data: {
        paciente: { connect: { id: plan.pacienteId } },
        plan: { connect: { id: plan.id } },
        tipo,
        total,
        metodoPago,
        estado: 'PAGADO',
        // Este dinero ya se contabilizó en caja cuando se cobró cada abono: no debe volver a
        // sumarse en el cierre de turno (ver src/lib/cierres.ts).
        cuentaParaCierre: false,
        items: {
          create: notasSeleccionadas.map((nota) => ({
            nombre: `Abono ${nota.numeracionComprobante ?? nota.id.slice(0, 8)}`,
            cantidad: 1,
            precioUnit: nota.total,
            total: nota.total,
          })),
        },
        tipoComprobante: CODIGO_SUNAT_TIPO_COMPROBANTE[tipo],
        numeracionComprobante,
        fechaHora: new Date(),
        fechaEmision: new Date(),
        totalVenta: String(total),
        gravadas,
        igv,
        montoLetras: numeroALetras(total),
        enviado: false,
        usuario: { connect: { id: usuarioId } },
        ruc: configuracion.ruc,
      },
      include: { paciente: true, items: true },
    })

    await tx.factura.updateMany({
      where: { id: { in: notasSeleccionadas.map((nota) => nota.id) } },
      data: { activo: false, comprobanteFinalId: creada.id },
    })

    await tx.plan.update({
      where: { id: plan.id },
      data: { estado: 'CERRADO', cerradoAt: new Date() },
    })

    return creada
  })

  await asegurarPdfComprobante(factura.id)
  return (await enviarFacturaASunat(factura.id)) ?? factura
}
