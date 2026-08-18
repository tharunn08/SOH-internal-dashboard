import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Receipt, ShoppingBag, Users, Package, Boxes, CalendarDays,
  MessageSquareHeart, PhoneCall, BarChart3, FileBarChart, UserCog, Settings,
  Search, LogOut, Menu, X, HelpCircle,
} from 'lucide-react'
import clsx from 'clsx'
import { useAuth } from '../../hooks/useAuth'
import { GlobalSearch } from '../common/GlobalSearch'
import logo from '../../assets/logo.png'

type NavItem = { to: string; label: string; icon: typeof LayoutDashboard; highlight?: boolean }

const NAV_SECTIONS: { label?: string; items: NavItem[] }[] = [
  {
    items: [{ to: '/', label: 'Dashboard', icon: LayoutDashboard }],
  },
  {
    label: 'Sell',
    items: [
      { to: '/orders/new', label: 'New Order', icon: ShoppingBag, highlight: true },
      { to: '/sales', label: 'Sales', icon: Receipt },
      { to: '/orders', label: 'Orders', icon: Receipt },
      { to: '/customers', label: 'Customers', icon: Users },
    ],
  },
  {
    label: 'Catalog',
    items: [
      { to: '/products', label: 'Products', icon: Package },
      { to: '/inventory', label: 'Inventory', icon: Boxes },
    ],
  },
  {
    label: 'Events',
    items: [{ to: '/events', label: 'Events', icon: CalendarDays }],
  },
  {
    label: 'Relationships',
    items: [
      { to: '/feedback', label: 'Feedback', icon: MessageSquareHeart },
      { to: '/followups', label: 'Follow-ups', icon: PhoneCall },
    ],
  },
  {
    label: 'Insights',
    items: [
      { to: '/analytics', label: 'Analytics', icon: BarChart3 },
      { to: '/reports', label: 'Reports', icon: FileBarChart },
    ],
  },
  {
    label: 'Admin',
    items: [
      { to: '/users', label: 'Users', icon: UserCog },
      { to: '/settings', label: 'Settings', icon: Settings },
    ],
  },
]

export function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="flex h-screen bg-ink-50">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/30 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* Sidebar */}
      <aside
        className={clsx(
          'fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-ink-100 bg-white transition-transform lg:static lg:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex items-center justify-between px-5 py-5">
          <div className="flex items-center gap-2.5">
            <img src={logo} alt="Sake of Health" className="h-10 w-10 shrink-0 object-contain" />
            <div>
              <p className="font-display text-sm font-semibold leading-tight text-ink-900">Sake of Health</p>
              <p className="text-[11px] leading-tight text-ink-400">Internal Dashboard</p>
            </div>
          </div>
          <button className="lg:hidden" onClick={() => setMobileOpen(false)}>
            <X className="h-5 w-5 text-ink-400" />
          </button>
        </div>

        <nav className="scrollbar-thin flex-1 space-y-5 overflow-y-auto px-3 pb-4">
          {NAV_SECTIONS.map((section, i) => (
            <div key={i}>
              {section.label && (
                <p className="mb-1.5 px-3 text-[10px] font-bold uppercase tracking-wider text-ink-300">{section.label}</p>
              )}
              <div className="space-y-0.5">
                {section.items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === '/'}
                    onClick={() => setMobileOpen(false)}
                    className={({ isActive }) =>
                      clsx(
                        'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                        isActive
                          ? 'bg-brand-50 text-brand-700'
                          : item.highlight
                          ? 'bg-brand-600 text-white hover:bg-brand-700'
                          : 'text-ink-500 hover:bg-ink-50 hover:text-ink-800'
                      )
                    }
                  >
                    <item.icon className="h-4.5 w-4.5 shrink-0" />
                    {item.label}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-ink-100 px-3 py-3">
          <button className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-ink-500 hover:bg-ink-50">
            <HelpCircle className="h-4.5 w-4.5" /> Help
          </button>
          <div className="mt-1 flex items-center justify-between rounded-xl px-3 py-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-ink-800">{profile?.name ?? 'Loading…'}</p>
              <p className="truncate text-xs capitalize text-ink-400">{profile?.role ?? ''}</p>
            </div>
            <button onClick={handleSignOut} title="Log out" className="rounded-lg p-2 text-ink-400 hover:bg-ink-100 hover:text-ink-700">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-ink-100 bg-white px-4 py-3 lg:px-6">
          <button className="lg:hidden" onClick={() => setMobileOpen(true)}>
            <Menu className="h-5 w-5 text-ink-500" />
          </button>
          <button
            onClick={() => setSearchOpen(true)}
            className="flex flex-1 max-w-md items-center gap-2 rounded-xl border border-ink-200 bg-ink-50 px-3.5 py-2 text-sm text-ink-400 hover:border-ink-300"
          >
            <Search className="h-4 w-4" />
            Search customers, orders, phone, product…
          </button>
        </header>
        <main className="flex-1 overflow-y-auto p-4 lg:p-8">
          <Outlet />
        </main>
      </div>

      {searchOpen && <GlobalSearch onClose={() => setSearchOpen(false)} />}
    </div>
  )
}
