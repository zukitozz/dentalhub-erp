'use client'

import { usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { useState } from 'react'
import { Menu } from 'lucide-react'
import { BrandLogo } from '@/components/BrandLogo'
import { Sidebar } from '@/components/Sidebar'
import { CumpleanosAlerta } from '@/components/CumpleanosAlerta'
import { ConfiguracionProvider } from '@/components/ConfiguracionProvider'
import { useAppStore } from '@/store/useAppStore'

export function AppShell({ children }: { readonly children: React.ReactNode }) {
  const pathname = usePathname()
  const { data: session } = useSession()
  const [mobileOpen, setMobileOpen] = useState(false)
  const collapsed = useAppStore((state) => state.sidebarCollapsed)
  const toggleSidebar = useAppStore((state) => state.toggleSidebar)
  const isLogin = pathname.startsWith('/auth/login')

  if (isLogin || !session) return <>{children}</>

  return (
    <ConfiguracionProvider>
      <div className="min-h-screen">
        <div className="print:hidden">
        <Sidebar
          collapsed={collapsed}
          onToggleCollapsed={toggleSidebar}
          mobileOpen={mobileOpen}
          onCloseMobile={() => setMobileOpen(false)}
        />
        </div>

        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-white/10 bg-ink-900 px-4 py-3 text-white md:hidden print:hidden">
          <button
            type="button"
            aria-label="Abrir menú"
            onClick={() => setMobileOpen(true)}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-white/30 text-white transition hover:bg-ink-700"
          >
            <Menu size={20} />
          </button>
          <BrandLogo compact conTexto />
        </header>

        <main className={`transition-all duration-200 ${collapsed ? 'md:pl-20' : 'md:pl-64'} print:pl-0`}>
          {children}
        </main>
        <CumpleanosAlerta />
      </div>
    </ConfiguracionProvider>
  )
}
