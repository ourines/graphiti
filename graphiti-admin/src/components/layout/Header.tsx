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
    <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-800 bg-surface/60 px-4 py-4 backdrop-blur md:px-6">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <Button
          variant="ghost"
          size="sm"
          className="lg:hidden shrink-0"
          onClick={toggleSidebar}
          aria-label="Open navigation"
        >
          <Menu className="h-5 w-5" />
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-semibold truncate">GraphiTi Admin</h1>
          <p className="text-sm text-muted-foreground hidden sm:block">Manage graph insights and backups</p>
        </div>
      </div>
      {isAuthenticated && (
        <div className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm text-muted-foreground">
          <span className="hidden sm:inline truncate max-w-[120px] lg:max-w-none">
            {authType === 'basic' ? `Basic · ${username ?? '用户'}` : 'Bearer Token'}
          </span>
          <span className="sm:hidden truncate max-w-[80px]">
            {authType === 'basic' ? username ?? '用户' : 'Bearer'}
          </span>
          <Button variant="ghost" size="sm" onClick={clearAuth} className="gap-2 text-slate-200 shrink-0">
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">登出</span>
          </Button>
        </div>
      )}
    </header>
  )
}

export default Header
