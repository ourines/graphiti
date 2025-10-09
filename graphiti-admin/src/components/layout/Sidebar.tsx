import { NavLink } from 'react-router-dom'
import { Database, LineChart, ServerCog, Shield, X } from 'lucide-react'

import Button from '@/components/ui/Button'
import { useUIStore } from '@/store/uiStore'

const navItems = [
  { to: '/', label: 'Dashboard', icon: LineChart },
  { to: '/graph', label: 'Graph', icon: Database },
  { to: '/backups', label: 'Backups', icon: ServerCog },
  { to: '/settings', label: 'Settings', icon: Shield },
]

const Sidebar = () => {
  const { sidebarOpen, setSidebarOpen } = useUIStore()

  return (
    <>
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-slate-800 bg-surface/90 p-4 backdrop-blur transition-transform duration-200 lg:static lg:z-0 lg:flex lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="mb-8 flex items-center justify-between text-xl font-semibold">
          <div className="flex items-center gap-2">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent text-background shadow-soft">
              GT
            </span>
            GraphiTi
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="lg:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close navigation"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
        <nav className="flex flex-1 flex-col gap-2">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-accent/10 hover:text-accent ${isActive ? 'bg-accent/20 text-accent' : 'text-muted-foreground'}`
              }
              end={to === '/'}
              onClick={() => setSidebarOpen(false)}
            >
              <Icon className="h-5 w-5" />
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>
    </>
  )
}

export default Sidebar
