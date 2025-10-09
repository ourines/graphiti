import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const graphitiTarget = env.VITE_GRAPHITI_PROXY_TARGET || 'http://localhost:8000'
  const backupTarget = env.VITE_BACKUP_PROXY_TARGET || 'http://localhost:8080'

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      host: '0.0.0.0',
      port: 5173,
      strictPort: true,
      proxy: {
        '/graphiti-api': {
          target: graphitiTarget,
          changeOrigin: true,
          rewrite: (pathStr) => pathStr.replace(/^\/graphiti-api/, ''),
        },
        '/backup-api': {
          target: backupTarget,
          changeOrigin: true,
          rewrite: (pathStr) => pathStr.replace(/^\/backup-api/, ''),
        },
      },
    },
  }
})
