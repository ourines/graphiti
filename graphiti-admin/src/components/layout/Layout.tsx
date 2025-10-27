import { Outlet } from 'react-router-dom'

import Header from './Header'
import Sidebar from './Sidebar'

const Layout = () => {
  return (
    <div className="relative min-h-screen bg-background text-slate-100">
      <Sidebar />
      <div className="flex min-h-screen flex-col transition-all duration-300 lg:ml-64">
        <Header />
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full px-4 sm:px-6 lg:px-8 space-y-6 py-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}

export default Layout
