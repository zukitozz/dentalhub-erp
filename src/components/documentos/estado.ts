export const ESTADO_DOCUMENTO: Record<string, { texto: string; clase: string }> = {
  BORRADOR: { texto: 'Borrador', clase: 'bg-ink-100 text-ink-600' },
  EMITIDO: { texto: 'Emitido', clase: 'bg-brand-100 text-brand-800' },
  FIRMADO: { texto: 'Firmado', clase: 'bg-emerald-100 text-emerald-800' },
  ANULADO: { texto: 'Anulado', clase: 'bg-danger-100 text-danger-800' },
}
