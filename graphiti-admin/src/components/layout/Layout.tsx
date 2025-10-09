import { Outlet } from 'react-router-dom'

import Header from './Header'
import Sidebar from './Sidebar'

const Layout = () => {
  return (
    <div className="flex h-full min-h-screen bg-background text-slate-100">
      <Sidebar />
      <div className="flex flex-1 flex-col">
        <Header />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export default Layout
