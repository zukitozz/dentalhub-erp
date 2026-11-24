-- AlterTable
ALTER TABLE "Atencion" ADD COLUMN     "sedeId" TEXT;

-- AlterTable
ALTER TABLE "CierreTurno" ADD COLUMN     "sedeId" TEXT;

-- AlterTable
ALTER TABLE "Cita" ADD COLUMN     "sedeId" TEXT;

-- AlterTable
ALTER TABLE "Configuracion" ADD COLUMN     "porcentajeReferido" DOUBLE PRECISION NOT NULL DEFAULT 5;

-- AlterTable
ALTER TABLE "Consultorio" ADD COLUMN     "sedeId" TEXT;

-- AlterTable
ALTER TABLE "Factura" ADD COLUMN     "sedeId" TEXT;

-- AlterTable
ALTER TABLE "Gasto" ADD COLUMN     "sedeId" TEXT;

-- AlterTable
ALTER TABLE "Paciente" ADD COLUMN     "referidoPorId" TEXT;

-- AlterTable
ALTER TABLE "Serie" ADD COLUMN     "sedeId" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "sedeId" TEXT;

-- CreateTable
CREATE TABLE "Sede" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "direccion" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Sede_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TratamientoSede" (
    "id" TEXT NOT NULL,
    "tratamientoId" TEXT NOT NULL,
    "sedeId" TEXT NOT NULL,
    "precio" DOUBLE PRECISION,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "TratamientoSede_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductoSede" (
    "id" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "sedeId" TEXT NOT NULL,
    "precioVenta" DOUBLE PRECISION,

    CONSTRAINT "ProductoSede_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TratamientoSede_tratamientoId_sedeId_key" ON "TratamientoSede"("tratamientoId", "sedeId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductoSede_productoId_sedeId_key" ON "ProductoSede"("productoId", "sedeId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_sedeId_fkey" FOREIGN KEY ("sedeId") REFERENCES "Sede"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Paciente" ADD CONSTRAINT "Paciente_referidoPorId_fkey" FOREIGN KEY ("referidoPorId") REFERENCES "Paciente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cita" ADD CONSTRAINT "Cita_sedeId_fkey" FOREIGN KEY ("sedeId") REFERENCES "Sede"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Consultorio" ADD CONSTRAINT "Consultorio_sedeId_fkey" FOREIGN KEY ("sedeId") REFERENCES "Sede"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Atencion" ADD CONSTRAINT "Atencion_sedeId_fkey" FOREIGN KEY ("sedeId") REFERENCES "Sede"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Factura" ADD CONSTRAINT "Factura_sedeId_fkey" FOREIGN KEY ("sedeId") REFERENCES "Sede"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CierreTurno" ADD CONSTRAINT "CierreTurno_sedeId_fkey" FOREIGN KEY ("sedeId") REFERENCES "Sede"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Serie" ADD CONSTRAINT "Serie_sedeId_fkey" FOREIGN KEY ("sedeId") REFERENCES "Sede"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Gasto" ADD CONSTRAINT "Gasto_sedeId_fkey" FOREIGN KEY ("sedeId") REFERENCES "Sede"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TratamientoSede" ADD CONSTRAINT "TratamientoSede_tratamientoId_fkey" FOREIGN KEY ("tratamientoId") REFERENCES "Tratamiento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TratamientoSede" ADD CONSTRAINT "TratamientoSede_sedeId_fkey" FOREIGN KEY ("sedeId") REFERENCES "Sede"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductoSede" ADD CONSTRAINT "ProductoSede_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductoSede" ADD CONSTRAINT "ProductoSede_sedeId_fkey" FOREIGN KEY ("sedeId") REFERENCES "Sede"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Sede principal: todo el historial existente queda asignado a ella. Los usuarios SUPERVISOR (gerente) quedan sin sede (ven todas).
INSERT INTO "Sede" ("id", "nombre", "activo", "creadoAt") VALUES ('sede-principal', 'Sede principal', true, CURRENT_TIMESTAMP);
UPDATE "User" SET "sedeId" = 'sede-principal' WHERE "role" <> 'SUPERVISOR';
UPDATE "Consultorio" SET "sedeId" = 'sede-principal';
UPDATE "Cita" SET "sedeId" = 'sede-principal';
UPDATE "Atencion" SET "sedeId" = 'sede-principal';
UPDATE "Factura" SET "sedeId" = 'sede-principal';
UPDATE "CierreTurno" SET "sedeId" = 'sede-principal';
UPDATE "Gasto" SET "sedeId" = 'sede-principal';
UPDATE "Serie" SET "sedeId" = 'sede-principal';
