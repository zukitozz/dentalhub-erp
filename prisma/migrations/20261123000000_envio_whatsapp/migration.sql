-- CreateTable
CREATE TABLE "EnvioWhatsapp" (
    "id" TEXT NOT NULL,
    "facturaId" TEXT NOT NULL,
    "referenciaExterna" VARCHAR(100) NOT NULL,
    "solicitudId" TEXT,
    "telefono" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "error" TEXT,
    "creadoAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EnvioWhatsapp_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EnvioWhatsapp_referenciaExterna_key" ON "EnvioWhatsapp"("referenciaExterna");

-- CreateIndex
CREATE INDEX "EnvioWhatsapp_facturaId_idx" ON "EnvioWhatsapp"("facturaId");

-- AddForeignKey
ALTER TABLE "EnvioWhatsapp" ADD CONSTRAINT "EnvioWhatsapp_facturaId_fkey" FOREIGN KEY ("facturaId") REFERENCES "Factura"("id") ON DELETE CASCADE ON UPDATE CASCADE;
