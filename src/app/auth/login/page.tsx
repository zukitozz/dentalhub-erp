'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { signIn } from 'next-auth/react'
import { CalendarDays, FileText, FolderHeart, Receipt } from 'lucide-react'
import { BrandLogo } from '@/components/BrandLogo'
import { Spinner } from '@/components/Spinner'

function destinoSeguro(callbackUrl: string | null) {
  if (!callbackUrl || !callbackUrl.startsWith('/') || callbackUrl.startsWith('//')) return '/dashboard'
  return callbackUrl
}

const MODULOS = [
  { icono: CalendarDays, titulo: 'Agenda que conecta todo', color: 'bg-brand-500' },
  { icono: FolderHeart, titulo: 'Expediente clínico completo', color: 'bg-blue-600' },
  { icono: FileText, titulo: 'Documentos listos para entregar', color: 'bg-violet-600' },
  { icono: Receipt, titulo: 'Visibilidad financiera', color: 'bg-emerald-600' },
]

function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setEnviando(true)

    const result = await signIn('credentials', { redirect: false, email, password })
    setEnviando(false)

    if (result?.error) {
      setError('Correo o contraseña inválidos')
      return
    }

    router.push(destinoSeguro(searchParams.get('callbackUrl')))
    router.refresh()
  }

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <div className="relative flex flex-col justify-between overflow-hidden bg-ink-900 px-8 py-10 lg:w-[46%] lg:px-14 lg:py-14">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-brand-500/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-16 h-72 w-72 rounded-full bg-mint-400/20 blur-3xl" />

        <BrandLogo conTexto />

        <div className="relative z-10 mt-12 max-w-md lg:mt-0">
          <h2 className="page-heading text-4xl !text-white sm:text-5xl">La consulta completa, sin piezas sueltas.</h2>
          <p className="mt-4 text-sm leading-6 text-ink-300">
            Cada módulo comparte el contexto del paciente y del consultorio: la información fluye desde la cita hasta el seguimiento sin volver a capturarla.
          </p>
          <ul className="mt-8 grid gap-3 sm:grid-cols-2">
            {MODULOS.map(({ icono: Icono, titulo, color }) => (
              <li key={titulo} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3">
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white ${color}`}><Icono size={18} /></span>
                <span className="text-sm font-semibold text-white">{titulo}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative z-10 mt-10 text-[11px] font-bold uppercase tracking-[0.25em] text-ink-400">Panel de gestión · Uso interno</p>
      </div>

      <div className="flex flex-1 items-center justify-center bg-[#f8f9fc] px-4 py-12 sm:px-6 lg:px-8">
        <div className="page-enter w-full max-w-md">
          <p className="eyebrow">Acceso</p>
          <h1 className="page-heading mt-3 text-4xl">Bienvenido de nuevo</h1>
          <p className="mt-2 text-sm text-ink-500">Inicia sesión para gestionar citas, expedientes, documentos y facturación.</p>

          <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="login-email" className="label">Correo electrónico</label>
              <input
                id="login-email"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="field"
                placeholder="usuario@consultorio.pe"
              />
            </div>
            <div>
              <label htmlFor="login-password" className="label">Contraseña</label>
              <input
                id="login-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="field"
                placeholder="••••••••"
              />
            </div>

            {error && <p role="alert" className="text-sm font-semibold text-danger-600">{error}</p>}

            <button type="submit" disabled={enviando} className="btn-brand w-full">
              {enviando ? <><Spinner /> Entrando…</> : 'Entrar'}
            </button>
          </form>

          <p className="mt-8 text-center text-xs text-ink-400">Acceso exclusivo para el equipo del consultorio</p>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  )
}
