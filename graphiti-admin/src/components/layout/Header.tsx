import { LogOut, Menu } from 'lucide-react'

import Button from '@/components/ui/Button'
import { useAuthStore } from '@/store/authStore'
import { useUIStore } from '@/store/uiStore'

const Header = () => {
  const toggleSidebar = useUIStore((state) => state.toggleSidebar)
  const clearAuth = useAuthStore((state) => state.clearAuth)
  const authType = useAuthStore((state) => state.authType)
  const username = useAuthStore((state) => state.username)
  const isAuthenticated = useAuthStore((state) => Boolean(state.authorizationHeader))

  return (
    <header className="flex items-center justify-between border-b border-slate-800 bg-surface/60 px-4 py-4 backdrop-blur md:px-6">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          className="lg:hidden"
          onClick={toggleSidebar}
          aria-label="Open navigation"
        >
          <Menu className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-lg font-semibold">GraphiTi Admin</h1>
          <p className="text-sm text-muted-foreground">Manage graph insights and backups</p>
        </div>
      </div>
      {isAuthenticated && (
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span>
            {authType === 'basic' ? `Basic · ${username ?? '用户'}` : 'Bearer Token'}
          </span>
          <Button variant="ghost" size="sm" onClick={clearAuth} className="gap-2 text-slate-200">
            <LogOut className="h-4 w-4" />
            登出
          </Button>
        </div>
      )}
    </header>
  )
}

export default Header
