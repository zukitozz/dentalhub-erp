'use client'

import Link from 'next/link'
import type { MouseEvent } from 'react'

interface PacienteHistorialLinkProps {
  pacienteId: string
  nombre: string
  className?: string
  stopPropagation?: boolean
}

export function PacienteHistorialLink({ pacienteId, nombre, className, stopPropagation }: PacienteHistorialLinkProps) {
  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (stopPropagation) event.stopPropagation()
  }

  return (
    <Link
      href={`/pacientes/${pacienteId}`}
      onClick={handleClick}
      className={className ?? 'underline decoration-dotted underline-offset-2 transition hover:text-brand-700'}
    >
      {nombre}
    </Link>
  )
}
