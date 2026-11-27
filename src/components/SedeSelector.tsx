'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ArrowLeftRight, Building2 } from 'lucide-react'
import { useSedeStore } from '@/store/useSedeStore'

// Gerente: sede activa (guardada en el store) con acceso a la pantalla de selección. Resto: su sede fija.
export function SedeSelector({ collapsed }: { collapsed: boolean }) {
  const pathname = usePathname()
  const nombreStore = useSedeStore((s) => s.nombre)
  const setSede = useSedeStore((s) => s.setSede)
  const [info, setInfo] = useState<{ nombre: string | null; sedeId: string | null; puedeElegir: boolean } | null>(null)

  useEffect(() => {
    void fetch('/api/sede').then((r) => (r.ok ? r.json() : null)).then((d) => {
      if (!d) return
      setInfo(d)
      if (d.puedeElegir) setSede({ sedeId: d.sedeId, nombre: d.nombre })
    })
  }, [setSede])

  if (!info) return null
  if (!info.puedeElegir && !info.nombre) return null
  const nombre = (info.puedeElegir ? nombreStore : info.nombre) ?? 'Todas las sedes'
  const href = `/seleccionar-sede?callbackUrl=${encodeURIComponent(pathname)}`

  if (collapsed) {
    return info.puedeElegir
      ? <Link href={href} title={`${nombre} · Cambiar sede`} className="flex justify-center py-2 text-ink-300 hover:text-white"><Building2 size={18} /></Link>
      : <div className="flex justify-center py-2 text-ink-300" title={nombre}><Building2 size={18} /></div>
  }

  return (
    <div className="px-2 pb-2">
      <p className="mb-1 flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-[0.2em] text-ink-400"><Building2 size={12} /> Sede</p>
      <p className="truncate rounded-lg bg-ink-800 px-2 py-1.5 text-sm text-white">{nombre}</p>
      {info.puedeElegir && (
        <Link href={href} className="mt-1 flex items-center gap-1.5 px-1 py-1 text-xs font-semibold text-ink-300 hover:text-white">
          <ArrowLeftRight size={12} /> Cambiar sede
        </Link>
      )}
    </div>
  )
}
