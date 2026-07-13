'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/lib/AuthContext'

const navItems = [
  { href: '/', label: 'Visão Geral' },
  { href: '/inbox', label: 'Mensagens' },
  { href: '/relevantes', label: 'Relevantes' },
  { href: '/investimento', label: 'Investimento' },
  { href: '/vendas', label: 'Vendas' },
  { href: '/analytics', label: 'Analytics' },
]

interface SidebarProps {
  onRefresh?: () => void
}

export default function Sidebar({ onRefresh }: SidebarProps) {
  const pathname = usePathname()
  const auth = useAuth()

  function isActive(href: string) {
    if (href === '/') return pathname === '/'
    return pathname.startsWith(href)
  }

  async function handleSignOut() {
    await auth.signOut()
    onRefresh?.()
  }

  return (
    <>
      <aside className="hidden w-64 shrink-0 border-r border-slate-200 bg-white lg:flex lg:flex-col">
        <div className="border-b border-slate-200 px-6 py-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Vinted Hub</p>
          <h1 className="mt-1 text-lg font-bold text-slate-900">Meu Dashboard</h1>
          {auth.user?.email && (
            <p className="mt-1 truncate text-xs text-slate-500">{auth.user.email}</p>
          )}
        </div>
        <nav className="flex flex-1 flex-col gap-1 p-4">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isActive(item.href)
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-slate-200 p-4 space-y-2">
          <p className="text-xs text-slate-400">Sync via extensão Chrome</p>
          <button
            type="button"
            onClick={handleSignOut}
            className="text-xs text-slate-500 hover:text-slate-800"
          >
            Sair
          </button>
        </div>
      </aside>

      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur lg:hidden">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Vinted Hub
            </p>
            <button type="button" onClick={handleSignOut} className="text-xs text-slate-500">
              Sair
            </button>
          </div>
          <nav className="mt-2 flex gap-1 overflow-x-auto">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-medium ${
                  isActive(item.href)
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
    </>
  )
}
