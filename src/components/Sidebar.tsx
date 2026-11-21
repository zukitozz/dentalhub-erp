'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'
import { CLAVE_ALERTA_CUMPLEANOS } from '@/components/CumpleanosAlerta'
import {
  BarChart3,
  Boxes,
  Cake,
  CalendarCheck,
  ClipboardList,
  DoorClosed,
  FileText,
  FolderHeart,
  LayoutDashboard,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  PhoneCall,
  Receipt,
  Settings,
  ShoppingBag,
  ShoppingCart,
  Stethoscope,
  Target,
  UserCog,
  Users,
  Wallet,
  X,
} from 'lucide-react'
import { BrandLogo } from '@/components/BrandLogo'
import { useConfiguracion } from '@/components/ConfiguracionProvider'
import { ROLE_LABELS, type UserRole } from '@/types/user'

const STAFF: UserRole[] = ['ADMIN', 'SUPERVISOR']
const CLINICA: UserRole[] = ['ADMIN', 'SUPERVISOR', 'ODONTOLOGO']

type Item = { href: string; label: string; icon: typeof LayoutDashboard; roles: UserRole[]; roleLabels?: Partial<Record<UserRole, string>> }

const grupos: { titulo: string; items: Item[] }[] = [
  {
    titulo: 'Consulta',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: STAFF },
      { href: '/bandeja', label: 'Mis atenciones', icon: ClipboardList, roles: ['ODONTOLOGO'] },
      { href: '/citas', label: 'Agenda', icon: CalendarCheck, roles: CLINICA },
      { href: '/pacientes', label: 'Pacientes', icon: FolderHeart, roles: CLINICA },
      { href: '/atenciones', label: 'Atenciones', icon: Stethoscope, roles: CLINICA },
      { href: '/consultorios', label: 'Consultorios', icon: DoorClosed, roles: ['SUPERVISOR'] },
      { href: '/documentos', label: 'Documentos', icon: FileText, roles: CLINICA },
      { href: '/planes', label: 'Planes de tratamiento', icon: Target, roles: STAFF },
    ],
  },
  {
    titulo: 'Seguimiento',
    items: [
      { href: '/seguimiento', label: 'Seguimiento', icon: PhoneCall, roles: STAFF },
      { href: '/cumpleanos', label: 'Cumpleaños', icon: Cake, roles: STAFF },
    ],
  },
  {
    titulo: 'Catálogo e inventario',
    items: [
      { href: '/tratamientos', label: 'Tratamientos', icon: Users, roles: ['SUPERVISOR'] },
      { href: '/productos', label: 'Productos', icon: ShoppingBag, roles: ['SUPERVISOR'] },
      { href: '/inventario', label: 'Inventario', icon: Boxes, roles: ['SUPERVISOR'] },
      { href: '/compras', label: 'Compras', icon: ShoppingCart, roles: ['SUPERVISOR'] },
    ],
  },
  {
    titulo: 'Finanzas',
    items: [
      { href: '/facturacion', label: 'Facturación', icon: Receipt, roles: STAFF },
      { href: '/gastos', label: 'Gastos', icon: Wallet, roles: ['SUPERVISOR'] },
      { href: '/reportes', label: 'Reportes', icon: BarChart3, roles: STAFF, roleLabels: { ADMIN: 'Cierre de turno' } },
    ],
  },
  {
    titulo: 'Administración',
    items: [
      { href: '/usuarios', label: 'Usuarios', icon: UserCog, roles: ['SUPERVISOR'] },
      { href: '/ajustes', label: 'Ajustes', icon: Settings, roles: ['SUPERVISOR'] },
    ],
  },
]

const todosLosItems = grupos.flatMap((g) => g.items)

function getActiveHref(pathname: string) {
  let best: string | null = null
  for (const item of todosLosItems) {
    const matches = pathname === item.href || pathname.startsWith(`${item.href}/`)
    if (matches && (!best || item.href.length > best.length)) best = item.href
  }
  return best
}

interface SidebarProps {
  collapsed: boolean
  onToggleCollapsed: () => void
  mobileOpen: boolean
  onCloseMobile: () => void
}

export function Sidebar({ collapsed, onToggleCollapsed, mobileOpen, onCloseMobile }: SidebarProps) {
  const pathname = usePathname()
  const { data: session } = useSession()
  const { usaConsultorios } = useConfiguracion()
  const role = session?.user?.role
  const visible = (item: Item) => (!role || item.roles.includes(role)) && (item.href !== '/consultorios' || usaConsultorios)
  const gruposVisibles = grupos.map((g) => ({ ...g, items: g.items.filter(visible) })).filter((g) => g.items.length > 0)
  const activeHref = getActiveHref(pathname)
  const initials = (session?.user?.name || '?')
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <>
      {mobileOpen && <div className="fixed inset-0 z-40 bg-black/50 md:hidden" onClick={onCloseMobile} />}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex h-screen flex-col bg-ink-900 text-white transition-all duration-200 ${
          collapsed ? 'w-20' : 'w-64'
        } ${mobileOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}
      >
        <div className="flex items-center gap-2 border-b border-white/10 p-4">
          {collapsed ? <BrandLogo compact /> : <BrandLogo compact conTexto />}
          {!collapsed && (
            <button
              type="button"
              aria-label="Colapsar menú"
              onClick={onToggleCollapsed}
              className="ml-auto hidden h-9 w-9 items-center justify-center rounded-full text-ink-200 transition hover:bg-ink-700 md:flex"
            >
              <PanelLeftClose size={18} />
            </button>
          )}
          <button
            type="button"
            aria-label="Cerrar menú"
            onClick={onCloseMobile}
            className="ml-auto flex h-9 w-9 items-center justify-center rounded-full text-ink-200 transition hover:bg-ink-700 md:hidden"
          >
            <X size={18} />
          </button>
        </div>
        {collapsed && (
          <button
            type="button"
            aria-label="Expandir menú"
            onClick={onToggleCollapsed}
            className="mx-auto mt-2 hidden h-9 w-9 items-center justify-center rounded-full text-ink-200 transition hover:bg-ink-700 md:flex"
          >
            <PanelLeftOpen size={18} />
          </button>
        )}

        <nav className="flex-1 space-y-4 overflow-y-auto p-3">
          {gruposVisibles.map((grupo) => (
            <div key={grupo.titulo}>
              {!collapsed && <p className="mb-1 px-3 text-[10px] font-extrabold uppercase tracking-[0.2em] text-ink-400">{grupo.titulo}</p>}
              <div className="space-y-0.5">
                {grupo.items.map((item) => {
                  const Icon = item.icon
                  const isActive = item.href === activeHref
                  const label = (role && item.roleLabels?.[role]) || item.label
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onCloseMobile}
                      title={collapsed ? label : undefined}
                      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
                        isActive ? 'bg-brand-600 font-semibold text-white' : 'text-ink-200 hover:bg-ink-700 hover:text-white'
                      } ${collapsed ? 'justify-center' : ''}`}
                    >
                      <Icon size={19} className="shrink-0" />
                      <span className={collapsed ? 'hidden' : 'truncate'}>{label}</span>
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-white/10 p-3">
          <div className={`flex items-center gap-3 rounded-xl px-2 py-2 ${collapsed ? 'justify-center' : ''}`}>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white">{initials}</div>
            {!collapsed && (
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{session?.user?.name}</p>
                <p className="truncate text-[11px] uppercase tracking-[0.16em] text-ink-300">{role ? ROLE_LABELS[role] : ''}</p>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => {
              try { sessionStorage.removeItem(CLAVE_ALERTA_CUMPLEANOS) } catch { /* sin sessionStorage */ }
              void signOut({ callbackUrl: '/auth/login' })
            }}
            title={collapsed ? 'Salir' : undefined}
            className={`mt-2 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-ink-200 transition hover:bg-danger-700 hover:text-white ${collapsed ? 'justify-center' : ''}`}
          >
            <LogOut size={18} className="shrink-0" />
            <span className={collapsed ? 'hidden' : ''}>Salir</span>
          </button>
        </div>
      </aside>
    </>
  )
}
