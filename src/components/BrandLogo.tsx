interface BrandLogoProps {
  readonly compact?: boolean
  /** Muestra el nombre junto al isotipo. */
  readonly conTexto?: boolean
  readonly oscuro?: boolean
}

/** Isotipo: diente sobre un cuadrado turquesa (paleta del diseño de referencia). */
export function BrandLogo({ compact = false, conTexto = false, oscuro = true }: BrandLogoProps) {
  const lado = compact ? 36 : 56
  return (
    <span className="inline-flex items-center gap-3">
      <svg width={lado} height={lado} viewBox="0 0 48 48" role="img" aria-label="HubDental" className="shrink-0">
        <rect width="48" height="48" rx="13" fill="#1ba2bb" />
        <path
          d="M24 12.5c-2.2-1.6-5-2.2-7.4-1.1-3 1.4-4.4 4.8-3.7 9.3.4 2.6 1.3 4.6 1.9 7.5.5 2.4.7 6.3 2.4 7.3 1.9 1.1 2.6-2.6 3.2-5.3.4-1.8 1-3.4 3.6-3.4s3.2 1.6 3.6 3.4c.6 2.7 1.3 6.4 3.2 5.3 1.7-1 1.9-4.9 2.4-7.3.6-2.9 1.5-4.9 1.9-7.5.7-4.5-.7-7.9-3.7-9.3-2.4-1.1-5.2-.5-7.4 1.1Z"
          fill="#fff"
        />
        <circle cx="35.5" cy="12" r="3.2" fill="#5fcbbf" />
      </svg>
      {conTexto && (
        <span className={`font-display text-xl font-extrabold leading-none ${oscuro ? 'text-white' : 'text-ink-900'}`}>
          Hub<span className="text-brand-300">Dental</span>
        </span>
      )}
    </span>
  )
}
