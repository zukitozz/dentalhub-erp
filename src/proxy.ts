import NextAuth from 'next-auth'
import { NextResponse } from 'next/server'
import { authConfig } from '@/lib/auth.config'
import { COOKIE_SEDE } from '@/lib/sede-constants'

const { auth } = NextAuth(authConfig)

// El odontólogo trabaja en la clínica (pacientes, expediente, citas, atenciones, documentos); no ve finanzas ni ajustes.
const ODONTOLOGO_PERMITIDO = ['/bandeja', '/pacientes', '/citas', '/atenciones', '/documentos']
const ADMIN_BLOQUEADO = ['/consultorios', '/sedes', '/usuarios', '/reportes/mensual', '/ajustes', '/inventario', '/productos', '/tratamientos', '/gastos', '/compras']

function coincide(pathname: string, prefijos: string[]) {
  return prefijos.some((prefijo) => pathname === prefijo || pathname.startsWith(`${prefijo}/`))
}

// Next 16: `middleware` pasó a llamarse `proxy`. Las rutas /api se protegen en cada handler (requireApiAuth).
export default auth((req) => {
  const { pathname, search } = req.nextUrl
  const role = req.auth?.user?.role
  if (!role) {
    const loginUrl = new URL('/auth/login', req.url)
    loginUrl.searchParams.set('callbackUrl', pathname + search)
    return NextResponse.redirect(loginUrl)
  }

  // El gerente debe elegir sede (o "todas") tras iniciar sesión; puede volver a esta pantalla cuando quiera.
  const enSelector = pathname === '/seleccionar-sede'
  if (role !== 'SUPERVISOR' && enSelector) return NextResponse.redirect(new URL('/', req.url))
  if (role === 'SUPERVISOR' && !enSelector && !req.cookies.get(COOKIE_SEDE)) {
    const url = new URL('/seleccionar-sede', req.url)
    url.searchParams.set('callbackUrl', pathname + search)
    return NextResponse.redirect(url)
  }

  if (role === 'ODONTOLOGO' && !coincide(pathname, ODONTOLOGO_PERMITIDO)) {
    return NextResponse.redirect(new URL('/bandeja', req.url))
  }

  if (role === 'ADMIN' && coincide(pathname, ADMIN_BLOQUEADO)) {
    return NextResponse.redirect(new URL('/dashboard', req.url))
  }

  return NextResponse.next()
})

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|auth/login|legal).*)'],
}
