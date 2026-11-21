/** UUID para ids de interfaz. `crypto.randomUUID` no existe en orígenes http no seguros (p. ej. http://192.168.x.x). */
export function nuevoId(): string {
  const c = typeof globalThis.crypto !== 'undefined' ? globalThis.crypto : undefined
  if (c && typeof c.randomUUID === 'function') return c.randomUUID()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0
    return (ch === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}
