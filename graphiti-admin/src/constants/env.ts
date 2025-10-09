const getEnvOrPath = (value: string | undefined, fallbackPath: string) => {
  if (value && value.length > 0) {
    return value
  }
  return fallbackPath
}

export const GRAPHITI_API_URL = getEnvOrPath(import.meta.env.VITE_GRAPHITI_API_URL, '/graphiti-api')

export const BACKUP_API_URL = getEnvOrPath(import.meta.env.VITE_BACKUP_API_URL, '/backup-api')

export const GRAPH_WEBSOCKET_URL = import.meta.env.VITE_GRAPH_WS_URL ?? ''
