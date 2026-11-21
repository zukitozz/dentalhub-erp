import './globals.css'
import type { Metadata, Viewport } from 'next'
import { Inter, Noto_Serif } from 'next/font/google'
import { Providers } from '@/components/Providers'
import { AppShell } from '@/components/AppShell'

// Inter para todo (titulares en peso 800, como FitHub); Noto Serif solo para los documentos impresos.
const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-body',
  display: 'swap',
})

const interDisplay = Inter({
  subsets: ['latin'],
  weight: ['700', '800'],
  variable: '--font-display',
  display: 'swap',
})

const notoSerif = Noto_Serif({
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  variable: '--font-serif',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'HubDental · Gestión de consultorio odontológico',
  description: 'Agenda, expediente clínico, odontograma, documentos y facturación para tu consultorio dental.',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { readonly children: React.ReactNode }) {
  return (
    <html lang="es-PE" className={`${inter.variable} ${interDisplay.variable} ${notoSerif.variable}`}>
      <body>
        <Providers><AppShell>{children}</AppShell></Providers>
      </body>
    </html>
  )
}
