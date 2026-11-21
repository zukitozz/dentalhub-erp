// Formato de fechas (hora de Lima) y moneda para la interfaz.

export const fetcher = async (url: string) => {
  const res = await fetch(url)
  if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? `Error ${res.status}`)
  return res.json()
}

/** Llama a la API y devuelve { ok, data, error } sin lanzar. */
export async function api<T = unknown>(url: string, opciones?: { method?: string; body?: unknown }) {
  try {
    const res = await fetch(url, {
      method: opciones?.method ?? 'GET',
      headers: opciones?.body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: opciones?.body !== undefined ? JSON.stringify(opciones.body) : undefined,
    })
    const data = (await res.json().catch(() => null)) as (T & { error?: string }) | null
    if (!res.ok) return { ok: false as const, data: null, error: data?.error ?? `Error ${res.status}` }
    return { ok: true as const, data: data as T, error: null }
  } catch {
    return { ok: false as const, data: null, error: 'Sin conexión con el servidor' }
  }
}

export const soles = (n: number | null | undefined) =>
  `S/ ${(n ?? 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export function fechaCorta(valor: string | Date | null | undefined) {
  if (!valor) return '—'
  return new Intl.DateTimeFormat('es-PE', { timeZone: 'America/Lima', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(valor))
}

export function fechaLarga(valor: string | Date | null | undefined) {
  if (!valor) return '—'
  return new Intl.DateTimeFormat('es-PE', { timeZone: 'America/Lima', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(valor))
}

export function horaLima(valor: string | Date | null | undefined) {
  if (!valor) return '—'
  return new Intl.DateTimeFormat('es-PE', { timeZone: 'America/Lima', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(valor))
}

export function fechaHoraLima(valor: string | Date | null | undefined) {
  if (!valor) return '—'
  return new Intl.DateTimeFormat('es-PE', { timeZone: 'America/Lima', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(valor))
}

/** 'YYYY-MM-DDTHH:mm' en hora de Lima, el formato que espera <input type="datetime-local">. */
export function aInputDatetime(valor: Date = new Date()) {
  const partes = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(valor)
  return partes.replace(' ', 'T')
}

/** Interpreta el valor de un datetime-local como hora de Lima (UTC-5). */
export function deInputDatetime(valor: string) {
  return new Date(`${valor}:00-05:00`)
}
