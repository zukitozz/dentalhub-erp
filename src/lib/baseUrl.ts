/**
 * URL pública de la app. Usa NEXTAUTH_URL si está definida; si no, la deduce de la petición
 * (en Vercel llega en x-forwarded-host/proto), así no depende de localhost en producción.
 */
export function baseUrl(req: Request): string {
  const fija = process.env.NEXTAUTH_URL?.replace(/\/$/, '')
  if (fija) return fija
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host')
  if (host) return `${req.headers.get('x-forwarded-proto') ?? 'https'}://${host}`
  return new URL(req.url).origin
}
