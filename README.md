# HubDental

Gestión de consultorio odontológico: agenda, expediente clínico completo (historia, odontograma, evoluciones, fotos, planes), documentos (consentimientos, recetas, presupuestos), inventario, facturación electrónica y reportes.

**Stack:** Next.js 16 (App Router) · React 19 · Prisma 7 + PostgreSQL (AWS RDS) · NextAuth v5 · Tailwind 3 · S3 para imágenes.

## Puesta en marcha

```bash
npm install
cp .env.example .env        # completa DATABASE_URL (RDS), NEXTAUTH_SECRET, etc.
npx prisma migrate deploy   # aplica prisma/migrations
npm run seed                # gerente + plantillas de documentos
npm run seed:demo           # (opcional) tratamientos, consultorios, odontólogo y pacientes de ejemplo
npm run dev
```

- RDS: usa `DATABASE_SSL=true`. `DATABASE_POOL_MAX` limita conexiones por instancia (recomendado en serverless).
- Prisma 7 genera el cliente en `src/generated/prisma` (`npm install` ejecuta `prisma generate`).
- Roles: **Gerente** (todo), **Recepción** (operación y cobros), **Odontólogo** (pacientes, expediente, agenda, atenciones, documentos).

## Módulos

| Módulo | Ruta |
|---|---|
| Dashboard, Agenda (Google Calendar opcional) | `/dashboard`, `/citas` |
| Pacientes + **Expediente clínico** (resumen/línea de tiempo, historia clínica, odontograma FDI, evoluciones con próxima cita, planes, fotografías/radiografías, documentos) | `/pacientes`, `/pacientes/[id]` |
| Atenciones por consultorio, bandeja del odontólogo | `/atenciones`, `/consultorios`, `/bandeja` |
| **Documentos** con plantillas editables (consentimientos, recetas, presupuestos), numeración y vista imprimible/PDF | `/documentos`, `/documentos/plantillas` |
| Planes de tratamiento con abonos y comprobante final | `/planes` |
| Tratamientos, productos, inventario, compras, gastos | `/tratamientos`, `/productos`, `/inventario`, `/compras`, `/gastos` |
| Facturación (boleta/factura/nota de venta, SUNAT), cierres de turno, reportes | `/facturacion`, `/reportes` |
| Seguimiento, cumpleaños, usuarios, ajustes | `/seguimiento`, `/cumpleanos`, `/usuarios`, `/ajustes` |

Las fotos se guardan en un bucket S3 privado y se sirven con URLs firmadas (ver variables `AWS_*`).
