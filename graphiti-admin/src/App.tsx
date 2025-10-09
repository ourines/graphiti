import { Navigate, Route, Routes } from 'react-router-dom'

import AuthGate from '@/components/auth/AuthGate'
import Layout from '@/components/layout/Layout'
import Dashboard from '@/pages/Dashboard'
import BackupManagement from '@/pages/BackupManagement'
import GraphView from '@/pages/GraphView'
import Settings from '@/pages/Settings'

const App = () => {
  return (
    <AuthGate>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="graph" element={<GraphView />} />
          <Route path="backups" element={<BackupManagement />} />
          <Route path="settings" element={<Settings />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthGate>
  )
}

export default App
