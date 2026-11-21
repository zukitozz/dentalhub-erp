-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('SUPERVISOR', 'ADMIN', 'ODONTOLOGO');

-- CreateEnum
CREATE TYPE "CitaEstado" AS ENUM ('PENDIENTE', 'CONFIRMADA', 'ATENDIDA', 'CANCELADA', 'EXPIRADA');

-- CreateEnum
CREATE TYPE "CitaOrigen" AS ENUM ('APP', 'GOOGLE');

-- CreateEnum
CREATE TYPE "ConsultorioEstado" AS ENUM ('DISPONIBLE', 'ATENCION', 'LIMPIEZA', 'MANTENIMIENTO');

-- CreateEnum
CREATE TYPE "AtencionEstado" AS ENUM ('PENDIENTE', 'EN_CURSO', 'FINALIZADA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "FotoTipo" AS ENUM ('ANTES', 'DESPUES', 'EVOLUCION', 'RADIOGRAFIA', 'INTRAORAL', 'EXTRAORAL', 'OTRO');

-- CreateEnum
CREATE TYPE "MovimientoTipo" AS ENUM ('ENTRADA', 'SALIDA', 'AJUSTE');

-- CreateEnum
CREATE TYPE "FacturaTipo" AS ENUM ('BOLETA', 'FACTURA', 'NOTA_VENTA');

-- CreateEnum
CREATE TYPE "MetodoPago" AS ENUM ('EFECTIVO', 'TARJETA', 'YAPE', 'PLIN', 'TRANSFERENCIA', 'DEPOSITO', 'MIXTO');

-- CreateEnum
CREATE TYPE "PlanEstado" AS ENUM ('ABIERTO', 'CERRADO');

-- CreateEnum
CREATE TYPE "HallazgoEstado" AS ENUM ('EXISTENTE', 'PLANIFICADO', 'REALIZADO');

-- CreateEnum
CREATE TYPE "DocumentoTipo" AS ENUM ('CONSENTIMIENTO', 'RECETA', 'PRESUPUESTO', 'OTRO');

-- CreateEnum
CREATE TYPE "DocumentoEstado" AS ENUM ('BORRADOR', 'EMITIDO', 'FIRMADO', 'ANULADO');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'ADMIN',
    "celular1" TEXT,
    "celular2" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "colegiatura" TEXT,
    "especialidad" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Paciente" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "dni" TEXT,
    "ruc" TEXT,
    "carnetExtranjeria" TEXT,
    "razonSocial" TEXT,
    "celular" TEXT,
    "distrito" TEXT,
    "email" TEXT,
    "direccion" TEXT,
    "fechaNacimiento" TIMESTAMP(3),
    "sexo" TEXT,
    "ocupacion" TEXT,
    "apoderado" TEXT,
    "contactoEmergencia" TEXT,
    "alergias" TEXT,
    "notas" TEXT,
    "recordatorioPospuestoHasta" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Paciente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cita" (
    "id" TEXT NOT NULL,
    "pacienteId" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL,
    "tratamiento" TEXT NOT NULL,
    "duracionMin" INTEGER,
    "descripcion" TEXT,
    "montoPrepagado" DOUBLE PRECISION,
    "odontologoId" TEXT,
    "estado" "CitaEstado" NOT NULL DEFAULT 'PENDIENTE',
    "registrado" BOOLEAN NOT NULL DEFAULT false,
    "origen" "CitaOrigen" NOT NULL DEFAULT 'APP',
    "googleEventId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Cita_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Consultorio" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "estado" "ConsultorioEstado" NOT NULL DEFAULT 'DISPONIBLE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Consultorio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Atencion" (
    "id" TEXT NOT NULL,
    "consultorioId" TEXT,
    "pacienteId" TEXT NOT NULL,
    "citaId" TEXT,
    "horaInicio" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "horaFin" TIMESTAMP(3),
    "notas" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Atencion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AtencionTratamiento" (
    "id" TEXT NOT NULL,
    "atencionId" TEXT NOT NULL,
    "tratamientoId" TEXT NOT NULL,
    "odontologoId" TEXT NOT NULL,
    "estado" "AtencionEstado" NOT NULL DEFAULT 'PENDIENTE',
    "horaInicio" TIMESTAMP(3),
    "horaFin" TIMESTAMP(3),
    "notas" TEXT,
    "diasProximoTratamiento" INTEGER,
    "pieza" INTEGER,
    "superficie" TEXT,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "precio" DOUBLE PRECISION,
    "precioCatalogo" DOUBLE PRECISION,
    "comision" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "facturaId" TEXT,

    CONSTRAINT "AtencionTratamiento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AtencionProducto" (
    "id" TEXT NOT NULL,
    "atencionId" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "cantidad" INTEGER NOT NULL DEFAULT 1,
    "precioUnit" DOUBLE PRECISION NOT NULL,
    "precioCatalogo" DOUBLE PRECISION,
    "comision" DOUBLE PRECISION,
    "comisionOdontologoId" TEXT,
    "creadoAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "facturaId" TEXT,

    CONSTRAINT "AtencionProducto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AtencionFoto" (
    "id" TEXT NOT NULL,
    "atencionId" TEXT,
    "pacienteId" TEXT NOT NULL,
    "tipo" "FotoTipo",
    "key" TEXT NOT NULL,
    "descripcion" TEXT,
    "creadoAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AtencionFoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsultorioEstadoLog" (
    "id" TEXT NOT NULL,
    "consultorioId" TEXT NOT NULL,
    "estadoAnterior" "ConsultorioEstado" NOT NULL,
    "estadoNuevo" "ConsultorioEstado" NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "atencionId" TEXT,
    "motivo" TEXT,
    "creadoAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsultorioEstadoLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Producto" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "precioVenta" DOUBLE PRECISION NOT NULL,
    "precioCosto" DOUBLE PRECISION,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "alertaStock" INTEGER NOT NULL DEFAULT 5,
    "codigoBarras" TEXT,
    "imagenUrl" TEXT,
    "creadoAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Producto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MovimientoInventario" (
    "id" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "tipo" "MovimientoTipo" NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "stockAnterior" INTEGER NOT NULL,
    "stockNuevo" INTEGER NOT NULL,
    "motivo" TEXT,
    "usuarioId" TEXT NOT NULL,
    "creadoAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MovimientoInventario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tratamiento" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "categoria" TEXT,
    "precio" DOUBLE PRECISION NOT NULL,
    "duracionMin" INTEGER NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "diasProximoTratamiento" INTEGER,
    "creadoAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tratamiento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TratamientoProducto" (
    "id" TEXT NOT NULL,
    "tratamientoId" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "cantidad" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "unidad" TEXT NOT NULL DEFAULT 'unidad',

    CONSTRAINT "TratamientoProducto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Factura" (
    "id" TEXT NOT NULL,
    "pacienteId" TEXT NOT NULL,
    "tipo" "FacturaTipo" NOT NULL,
    "total" DOUBLE PRECISION NOT NULL,
    "metodoPago" "MetodoPago" NOT NULL,
    "estado" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tipoComprobante" TEXT,
    "numeracionComprobante" TEXT,
    "fechaEmision" TIMESTAMP(3),
    "tipoMoneda" TEXT DEFAULT 'PEN',
    "tipoOperacion" TEXT DEFAULT '0101',
    "tipoNota" TEXT,
    "tipoDocumentoAfectado" TEXT,
    "fechaDocumentoAfectado" TIMESTAMP(3),
    "numeracionDocumentoAfectado" TEXT,
    "motivoDocumentoAfectado" TEXT,
    "totalVenta" TEXT,
    "montoLetras" TEXT,
    "cadenaParaCodigoQr" TEXT,
    "codigoHash" TEXT,
    "pdfBytes" TEXT,
    "url" TEXT,
    "errors" TEXT,
    "comentario" TEXT,
    "pagoTarjeta" DOUBLE PRECISION,
    "pagoEfectivo" DOUBLE PRECISION,
    "pagoYape" DOUBLE PRECISION,
    "pagoTransferencia" DOUBLE PRECISION,
    "pagoDeposito" DOUBLE PRECISION,
    "billete" DOUBLE PRECISION,
    "ruc" TEXT,
    "enviado" BOOLEAN NOT NULL DEFAULT false,
    "estadoNotaDespacho" BOOLEAN NOT NULL DEFAULT false,
    "comprobanteNotaDespacho" TEXT,
    "fechaFacturadoNotaDespacho" TIMESTAMP(3),
    "usuarioId" TEXT,
    "cierreTurnoId" TEXT,
    "fechaHora" TIMESTAMP(3),
    "gravadas" DOUBLE PRECISION,
    "igv" DOUBLE PRECISION,
    "xmlEnvio" TEXT,
    "cdr" TEXT,
    "impresion" INTEGER NOT NULL DEFAULT 1,
    "cuentaParaCierre" BOOLEAN NOT NULL DEFAULT true,
    "planId" TEXT,
    "comprobanteFinalId" TEXT,

    CONSTRAINT "Factura_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Plan" (
    "id" TEXT NOT NULL,
    "pacienteId" TEXT NOT NULL,
    "tratamientoId" TEXT,
    "nombre" TEXT NOT NULL,
    "sesionesTotal" INTEGER NOT NULL,
    "precioTotal" DOUBLE PRECISION NOT NULL,
    "estado" "PlanEstado" NOT NULL DEFAULT 'ABIERTO',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "usuarioId" TEXT,
    "creadoAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cerradoAt" TIMESTAMP(3),

    CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanItem" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "tratamientoId" TEXT,
    "descripcion" TEXT NOT NULL,
    "pieza" INTEGER,
    "cantidad" INTEGER NOT NULL DEFAULT 1,
    "precioUnit" DOUBLE PRECISION NOT NULL,
    "realizado" BOOLEAN NOT NULL DEFAULT false,
    "realizadoAt" TIMESTAMP(3),
    "orden" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PlanItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanSesion" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notas" TEXT,
    "usuarioId" TEXT,
    "creadoAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlanSesion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FacturaItem" (
    "id" TEXT NOT NULL,
    "facturaId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "precioUnit" DOUBLE PRECISION NOT NULL,
    "total" DOUBLE PRECISION NOT NULL,
    "precioCatalogo" DOUBLE PRECISION,
    "codigoProducto" TEXT,
    "igv" DOUBLE PRECISION,
    "decCantidad" DOUBLE PRECISION,
    "decSubtotal" DOUBLE PRECISION,
    "decTotal" DOUBLE PRECISION,
    "valor" DOUBLE PRECISION,
    "precio" DOUBLE PRECISION,
    "igvVenta" DOUBLE PRECISION,
    "codigo" INTEGER,
    "productoId" TEXT,

    CONSTRAINT "FacturaItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CierreTurno" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "fechaInicio" TIMESTAMP(3) NOT NULL,
    "fechaFin" TIMESTAMP(3) NOT NULL,
    "totalVentas" DOUBLE PRECISION NOT NULL,
    "totalEfectivo" DOUBLE PRECISION NOT NULL,
    "totalTarjeta" DOUBLE PRECISION NOT NULL,
    "totalYape" DOUBLE PRECISION NOT NULL,
    "totalTransferencia" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalDeposito" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalGastos" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CierreTurno_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Configuracion" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "nombreEmpresa" TEXT NOT NULL DEFAULT 'HubDental Consultorio Odontológico',
    "telefono" TEXT,
    "email" TEXT,
    "pieDocumentos" TEXT,
    "ruc" VARCHAR(11),
    "razonSocial" TEXT,
    "direccionFiscal" TEXT,
    "codigoUbigeo" TEXT,
    "googleCalendarActivo" BOOLEAN NOT NULL DEFAULT false,
    "googleCalendarId" TEXT,
    "googleRefreshTokenEnc" TEXT,
    "googleCuentaEmail" TEXT,
    "googleSyncToken" TEXT,
    "facturacionEndpoint" TEXT,
    "facturacionActivo" BOOLEAN NOT NULL DEFAULT false,
    "horasExpiracionCita" INTEGER NOT NULL DEFAULT 24,
    "usaConsultorios" BOOLEAN NOT NULL DEFAULT true,
    "actualizadoAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Configuracion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Serie" (
    "id" TEXT NOT NULL,
    "codigoProposito" VARCHAR(50) NOT NULL,
    "tipoComprobante" VARCHAR(2) NOT NULL,
    "serie" VARCHAR(3) NOT NULL,
    "estado" INTEGER NOT NULL DEFAULT 1,
    "descripcion" VARCHAR(200),

    CONSTRAINT "Serie_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Gasto" (
    "id" TEXT NOT NULL,
    "concepto" TEXT NOT NULL,
    "categoria" TEXT,
    "monto" DOUBLE PRECISION NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "proveedor" TEXT,
    "numeroComprobante" TEXT,
    "notas" TEXT,
    "usuarioId" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "odontologoId" TEXT,
    "cierreTurnoId" TEXT,

    CONSTRAINT "Gasto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Correlativo" (
    "id" TEXT NOT NULL,
    "tipoDocumento" VARCHAR(2) NOT NULL,
    "serie" VARCHAR(3) NOT NULL,
    "prefijo" VARCHAR(2) NOT NULL,
    "numeracion" INTEGER NOT NULL DEFAULT 0,
    "estado" CHAR(1) NOT NULL DEFAULT 'A',
    "ruc" VARCHAR(11) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Correlativo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HistoriaClinica" (
    "id" TEXT NOT NULL,
    "pacienteId" TEXT NOT NULL,
    "motivoConsulta" TEXT,
    "enfermedadActual" TEXT,
    "antecedentes" JSONB,
    "medicamentosActuales" TEXT,
    "alergias" TEXT,
    "antecedentesOdontologicos" TEXT,
    "habitos" TEXT,
    "examenClinico" TEXT,
    "observaciones" TEXT,
    "actualizadoPorId" TEXT,
    "creadoAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HistoriaClinica_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OdontogramaHallazgo" (
    "id" TEXT NOT NULL,
    "pacienteId" TEXT NOT NULL,
    "pieza" INTEGER NOT NULL,
    "superficie" TEXT,
    "condicion" TEXT NOT NULL,
    "estado" "HallazgoEstado" NOT NULL DEFAULT 'EXISTENTE',
    "notas" TEXT,
    "atencionId" TEXT,
    "odontologoId" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OdontogramaHallazgo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Evolucion" (
    "id" TEXT NOT NULL,
    "pacienteId" TEXT NOT NULL,
    "atencionId" TEXT,
    "odontologoId" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "motivo" TEXT,
    "diagnostico" TEXT,
    "procedimiento" TEXT NOT NULL,
    "indicaciones" TEXT,
    "piezas" TEXT,
    "proximaCitaId" TEXT,
    "creadoAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Evolucion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentoPlantilla" (
    "id" TEXT NOT NULL,
    "tipo" "DocumentoTipo" NOT NULL,
    "nombre" TEXT NOT NULL,
    "contenido" TEXT NOT NULL,
    "campos" JSONB,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "sistema" BOOLEAN NOT NULL DEFAULT false,
    "creadoAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentoPlantilla_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Documento" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "tipo" "DocumentoTipo" NOT NULL,
    "titulo" TEXT NOT NULL,
    "pacienteId" TEXT NOT NULL,
    "plantillaId" TEXT,
    "odontologoId" TEXT,
    "atencionId" TEXT,
    "contenido" TEXT NOT NULL,
    "datos" JSONB,
    "total" DOUBLE PRECISION,
    "estado" "DocumentoEstado" NOT NULL DEFAULT 'EMITIDO',
    "firmadoAt" TIMESTAMP(3),
    "creadoAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Documento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Secuencia" (
    "id" TEXT NOT NULL,
    "valor" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Secuencia_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Paciente_dni_key" ON "Paciente"("dni");

-- CreateIndex
CREATE UNIQUE INDEX "Paciente_ruc_key" ON "Paciente"("ruc");

-- CreateIndex
CREATE UNIQUE INDEX "Paciente_carnetExtranjeria_key" ON "Paciente"("carnetExtranjeria");

-- CreateIndex
CREATE UNIQUE INDEX "Cita_googleEventId_key" ON "Cita"("googleEventId");

-- CreateIndex
CREATE INDEX "Cita_odontologoId_idx" ON "Cita"("odontologoId");

-- CreateIndex
CREATE INDEX "Atencion_consultorioId_idx" ON "Atencion"("consultorioId");

-- CreateIndex
CREATE INDEX "Atencion_pacienteId_idx" ON "Atencion"("pacienteId");

-- CreateIndex
CREATE INDEX "Atencion_citaId_idx" ON "Atencion"("citaId");

-- CreateIndex
CREATE INDEX "AtencionTratamiento_atencionId_idx" ON "AtencionTratamiento"("atencionId");

-- CreateIndex
CREATE INDEX "AtencionTratamiento_tratamientoId_idx" ON "AtencionTratamiento"("tratamientoId");

-- CreateIndex
CREATE INDEX "AtencionTratamiento_odontologoId_idx" ON "AtencionTratamiento"("odontologoId");

-- CreateIndex
CREATE INDEX "AtencionTratamiento_facturaId_idx" ON "AtencionTratamiento"("facturaId");

-- CreateIndex
CREATE INDEX "AtencionProducto_atencionId_idx" ON "AtencionProducto"("atencionId");

-- CreateIndex
CREATE INDEX "AtencionProducto_facturaId_idx" ON "AtencionProducto"("facturaId");

-- CreateIndex
CREATE INDEX "AtencionFoto_atencionId_idx" ON "AtencionFoto"("atencionId");

-- CreateIndex
CREATE INDEX "AtencionFoto_pacienteId_idx" ON "AtencionFoto"("pacienteId");

-- CreateIndex
CREATE INDEX "ConsultorioEstadoLog_consultorioId_creadoAt_idx" ON "ConsultorioEstadoLog"("consultorioId", "creadoAt");

-- CreateIndex
CREATE UNIQUE INDEX "Producto_codigoBarras_key" ON "Producto"("codigoBarras");

-- CreateIndex
CREATE INDEX "MovimientoInventario_productoId_creadoAt_idx" ON "MovimientoInventario"("productoId", "creadoAt");

-- CreateIndex
CREATE UNIQUE INDEX "TratamientoProducto_tratamientoId_productoId_key" ON "TratamientoProducto"("tratamientoId", "productoId");

-- CreateIndex
CREATE INDEX "Factura_planId_idx" ON "Factura"("planId");

-- CreateIndex
CREATE INDEX "Plan_pacienteId_idx" ON "Plan"("pacienteId");

-- CreateIndex
CREATE INDEX "PlanItem_planId_idx" ON "PlanItem"("planId");

-- CreateIndex
CREATE INDEX "PlanSesion_planId_idx" ON "PlanSesion"("planId");

-- CreateIndex
CREATE INDEX "Gasto_fecha_idx" ON "Gasto"("fecha");

-- CreateIndex
CREATE INDEX "Gasto_cierreTurnoId_idx" ON "Gasto"("cierreTurnoId");

-- CreateIndex
CREATE UNIQUE INDEX "Correlativo_ruc_tipoDocumento_serie_prefijo_key" ON "Correlativo"("ruc", "tipoDocumento", "serie", "prefijo");

-- CreateIndex
CREATE UNIQUE INDEX "HistoriaClinica_pacienteId_key" ON "HistoriaClinica"("pacienteId");

-- CreateIndex
CREATE INDEX "OdontogramaHallazgo_pacienteId_pieza_idx" ON "OdontogramaHallazgo"("pacienteId", "pieza");

-- CreateIndex
CREATE INDEX "Evolucion_pacienteId_fecha_idx" ON "Evolucion"("pacienteId", "fecha");

-- CreateIndex
CREATE UNIQUE INDEX "Documento_numero_key" ON "Documento"("numero");

-- CreateIndex
CREATE INDEX "Documento_pacienteId_creadoAt_idx" ON "Documento"("pacienteId", "creadoAt");

-- CreateIndex
CREATE INDEX "Documento_tipo_idx" ON "Documento"("tipo");

-- AddForeignKey
ALTER TABLE "Cita" ADD CONSTRAINT "Cita_pacienteId_fkey" FOREIGN KEY ("pacienteId") REFERENCES "Paciente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cita" ADD CONSTRAINT "Cita_odontologoId_fkey" FOREIGN KEY ("odontologoId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Atencion" ADD CONSTRAINT "Atencion_consultorioId_fkey" FOREIGN KEY ("consultorioId") REFERENCES "Consultorio"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Atencion" ADD CONSTRAINT "Atencion_pacienteId_fkey" FOREIGN KEY ("pacienteId") REFERENCES "Paciente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Atencion" ADD CONSTRAINT "Atencion_citaId_fkey" FOREIGN KEY ("citaId") REFERENCES "Cita"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AtencionTratamiento" ADD CONSTRAINT "AtencionTratamiento_atencionId_fkey" FOREIGN KEY ("atencionId") REFERENCES "Atencion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AtencionTratamiento" ADD CONSTRAINT "AtencionTratamiento_tratamientoId_fkey" FOREIGN KEY ("tratamientoId") REFERENCES "Tratamiento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AtencionTratamiento" ADD CONSTRAINT "AtencionTratamiento_odontologoId_fkey" FOREIGN KEY ("odontologoId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AtencionTratamiento" ADD CONSTRAINT "AtencionTratamiento_facturaId_fkey" FOREIGN KEY ("facturaId") REFERENCES "Factura"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AtencionProducto" ADD CONSTRAINT "AtencionProducto_atencionId_fkey" FOREIGN KEY ("atencionId") REFERENCES "Atencion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AtencionProducto" ADD CONSTRAINT "AtencionProducto_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AtencionProducto" ADD CONSTRAINT "AtencionProducto_facturaId_fkey" FOREIGN KEY ("facturaId") REFERENCES "Factura"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AtencionFoto" ADD CONSTRAINT "AtencionFoto_atencionId_fkey" FOREIGN KEY ("atencionId") REFERENCES "Atencion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AtencionFoto" ADD CONSTRAINT "AtencionFoto_pacienteId_fkey" FOREIGN KEY ("pacienteId") REFERENCES "Paciente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsultorioEstadoLog" ADD CONSTRAINT "ConsultorioEstadoLog_consultorioId_fkey" FOREIGN KEY ("consultorioId") REFERENCES "Consultorio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsultorioEstadoLog" ADD CONSTRAINT "ConsultorioEstadoLog_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsultorioEstadoLog" ADD CONSTRAINT "ConsultorioEstadoLog_atencionId_fkey" FOREIGN KEY ("atencionId") REFERENCES "Atencion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimientoInventario" ADD CONSTRAINT "MovimientoInventario_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimientoInventario" ADD CONSTRAINT "MovimientoInventario_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TratamientoProducto" ADD CONSTRAINT "TratamientoProducto_tratamientoId_fkey" FOREIGN KEY ("tratamientoId") REFERENCES "Tratamiento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TratamientoProducto" ADD CONSTRAINT "TratamientoProducto_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Factura" ADD CONSTRAINT "Factura_pacienteId_fkey" FOREIGN KEY ("pacienteId") REFERENCES "Paciente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Factura" ADD CONSTRAINT "Factura_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Factura" ADD CONSTRAINT "Factura_cierreTurnoId_fkey" FOREIGN KEY ("cierreTurnoId") REFERENCES "CierreTurno"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Factura" ADD CONSTRAINT "Factura_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Factura" ADD CONSTRAINT "Factura_comprobanteFinalId_fkey" FOREIGN KEY ("comprobanteFinalId") REFERENCES "Factura"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Plan" ADD CONSTRAINT "Plan_pacienteId_fkey" FOREIGN KEY ("pacienteId") REFERENCES "Paciente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Plan" ADD CONSTRAINT "Plan_tratamientoId_fkey" FOREIGN KEY ("tratamientoId") REFERENCES "Tratamiento"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Plan" ADD CONSTRAINT "Plan_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanItem" ADD CONSTRAINT "PlanItem_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanItem" ADD CONSTRAINT "PlanItem_tratamientoId_fkey" FOREIGN KEY ("tratamientoId") REFERENCES "Tratamiento"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanSesion" ADD CONSTRAINT "PlanSesion_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanSesion" ADD CONSTRAINT "PlanSesion_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FacturaItem" ADD CONSTRAINT "FacturaItem_facturaId_fkey" FOREIGN KEY ("facturaId") REFERENCES "Factura"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FacturaItem" ADD CONSTRAINT "FacturaItem_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CierreTurno" ADD CONSTRAINT "CierreTurno_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Gasto" ADD CONSTRAINT "Gasto_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Gasto" ADD CONSTRAINT "Gasto_odontologoId_fkey" FOREIGN KEY ("odontologoId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Gasto" ADD CONSTRAINT "Gasto_cierreTurnoId_fkey" FOREIGN KEY ("cierreTurnoId") REFERENCES "CierreTurno"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HistoriaClinica" ADD CONSTRAINT "HistoriaClinica_pacienteId_fkey" FOREIGN KEY ("pacienteId") REFERENCES "Paciente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OdontogramaHallazgo" ADD CONSTRAINT "OdontogramaHallazgo_pacienteId_fkey" FOREIGN KEY ("pacienteId") REFERENCES "Paciente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OdontogramaHallazgo" ADD CONSTRAINT "OdontogramaHallazgo_atencionId_fkey" FOREIGN KEY ("atencionId") REFERENCES "Atencion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OdontogramaHallazgo" ADD CONSTRAINT "OdontogramaHallazgo_odontologoId_fkey" FOREIGN KEY ("odontologoId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evolucion" ADD CONSTRAINT "Evolucion_pacienteId_fkey" FOREIGN KEY ("pacienteId") REFERENCES "Paciente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evolucion" ADD CONSTRAINT "Evolucion_atencionId_fkey" FOREIGN KEY ("atencionId") REFERENCES "Atencion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evolucion" ADD CONSTRAINT "Evolucion_odontologoId_fkey" FOREIGN KEY ("odontologoId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evolucion" ADD CONSTRAINT "Evolucion_proximaCitaId_fkey" FOREIGN KEY ("proximaCitaId") REFERENCES "Cita"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Documento" ADD CONSTRAINT "Documento_pacienteId_fkey" FOREIGN KEY ("pacienteId") REFERENCES "Paciente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Documento" ADD CONSTRAINT "Documento_plantillaId_fkey" FOREIGN KEY ("plantillaId") REFERENCES "DocumentoPlantilla"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Documento" ADD CONSTRAINT "Documento_odontologoId_fkey" FOREIGN KEY ("odontologoId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Documento" ADD CONSTRAINT "Documento_atencionId_fkey" FOREIGN KEY ("atencionId") REFERENCES "Atencion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

