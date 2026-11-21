/** @type {import('next').NextConfig} */
const nextConfig = {
  // pg usa módulos nativos opcionales; se deja fuera del bundle del servidor.
  serverExternalPackages: ['pg'],
  // Permite abrir el servidor de desarrollo desde otra IP de la red (si no, la hidratación del navegador se bloquea).
  allowedDevOrigins: ['192.168.18.41', '100.80.171.40', '*.local'],
}

module.exports = nextConfig
