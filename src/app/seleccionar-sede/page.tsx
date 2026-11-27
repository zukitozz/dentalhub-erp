'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Building2, Layers } from 'lucide-react'
import { BrandLogo } from '@/components/BrandLogo'
import { Spinner } from '@/components/Spinner'
import { useSedeStore } from '@/store/useSedeStore'

interface Sede { id: string; nombre: string; direccion?: string | null }

function destinoSeguro(callbackUrl: string | null) {
  if (!callbackUrl || !callbackUrl.startsWith('/') || callbackUrl.startsWith('//') || callbackUrl.startsWith('/seleccionar-sede')) return '/dashboard'
  return callbackUrl
}

function Selector() {
  const searchParams = useSearchParams()
  const setSede = useSedeStore((s) => s.setSede)
  const actual = useSedeStore((s) => s.sedeId)
  const elegida = useSedeStore((s) => s.elegida)
  const [sedes, setSedes] = useState<Sede[] | null>(null)
  const [guardando, setGuardando] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void fetch('/api/sedes').then((r) => (r.ok ? r.json() : [])).then((d) => setSedes(Array.isArray(d) ? d : []))
  }, [])

  const elegir = async (sede: Sede | null) => {
    setError(null)
    setGuardando(sede?.id ?? 'todas')
    const res = await fetch('/api/sede', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sedeId: sede?.id ?? '' }) })
    if (!res.ok) {
      setGuardando(null)
      setError('No se pudo seleccionar la sede')
      return
    }
    setSede({ sedeId: sede?.id ?? null, nombre: sede?.nombre ?? null })
    // Carga completa para que toda la web arranque con la sede elegida.
    window.location.assign(destinoSeguro(searchParams.get('callbackUrl')))
  }

  const opcion = 'flex w-full items-center gap-4 rounded-2xl border bg-white p-4 text-left shadow-sm transition hover:border-brand-500 hover:shadow-md disabled:opacity-60'

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f8f9fc] px-4 py-10">
      <div className="page-enter w-full max-w-lg">
        <BrandLogo conTexto />
        <p className="eyebrow mt-8">Sede</p>
        <h1 className="page-heading mt-3 text-3xl">¿Con qué sede vas a trabajar?</h1>
        <p className="mt-2 text-sm text-ink-500">Puedes cambiar de sede en cualquier momento desde el menú.</p>

        {sedes === null ? (
          <div className="mt-8 flex justify-center"><Spinner /></div>
        ) : (
          <div className="mt-6 space-y-3">
            {sedes.map((s) => (
              <button key={s.id} type="button" disabled={guardando !== null} onClick={() => void elegir(s)}
                className={`${opcion} ${elegida && actual === s.id ? 'border-brand-500' : 'border-ink-100'}`}>
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-500 text-white"><Building2 size={20} /></span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-bold text-ink-900">{s.nombre}</span>
                  {s.direccion && <span className="block truncate text-xs text-ink-500">{s.direccion}</span>}
                </span>
                {guardando === s.id && <Spinner />}
              </button>
            ))}
            <button type="button" disabled={guardando !== null} onClick={() => void elegir(null)}
              className={`${opcion} ${elegida && actual === null ? 'border-brand-500' : 'border-ink-100'}`}>
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-ink-800 text-white"><Layers size={20} /></span>
              <span className="min-w-0 flex-1">
                <span className="block font-bold text-ink-900">Todas las sedes</span>
                <span className="block text-xs text-ink-500">Vista consolidada</span>
              </span>
              {guardando === 'todas' && <Spinner />}
            </button>
          </div>
        )}
        {error && <p role="alert" className="mt-4 text-sm font-semibold text-danger-600">{error}</p>}
      </div>
    </div>
  )
}

export default function SeleccionarSedePage() {
  return (
    <Suspense fallback={null}>
      <Selector />
    </Suspense>
  )
}
