-- AlterTable
ALTER TABLE "MovimientoInventario" ADD COLUMN     "sedeId" TEXT;

-- AlterTable
ALTER TABLE "ProductoSede" ADD COLUMN     "alertaStock" INTEGER NOT NULL DEFAULT 5,
ADD COLUMN     "stock" INTEGER NOT NULL DEFAULT 0;


-- El stock existente pasa a la sede principal; el historial de movimientos también.
INSERT INTO "ProductoSede" ("id", "productoId", "sedeId", "stock", "alertaStock")
SELECT gen_random_uuid()::text, p."id", 'sede-principal', p."stock", p."alertaStock" FROM "Producto" p
ON CONFLICT ("productoId", "sedeId") DO UPDATE SET "stock" = EXCLUDED."stock", "alertaStock" = EXCLUDED."alertaStock";
UPDATE "MovimientoInventario" SET "sedeId" = 'sede-principal' WHERE "sedeId" IS NULL;
