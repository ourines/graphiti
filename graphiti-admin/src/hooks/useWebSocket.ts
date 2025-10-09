import { useEffect, useRef, useState } from 'react'

interface WebSocketOptions<T> {
  onMessage?: (data: T) => void
  onOpen?: (event: Event) => void
  onClose?: (event: CloseEvent) => void
  enabled?: boolean
}

export const useWebSocket = <T = unknown>(url: string | null | undefined, options?: WebSocketOptions<T>) => {
  const { onMessage, onOpen, onClose, enabled = true } = options ?? {}
  const wsRef = useRef<WebSocket | null>(null)
  const [isConnected, setConnected] = useState(false)
  const [lastMessage, setLastMessage] = useState<T | null>(null)

  useEffect(() => {
    if (!url || !enabled) return

    const websocket = new WebSocket(url)
    wsRef.current = websocket

    websocket.addEventListener('open', (event) => {
      setConnected(true)
      onOpen?.(event)
    })

    websocket.addEventListener('message', (event) => {
      try {
        const data = JSON.parse(event.data) as T
        setLastMessage(data)
        onMessage?.(data)
      } catch (error) {
        console.warn('WebSocket message parse error', error)
      }
    })

    websocket.addEventListener('close', (event) => {
      setConnected(false)
      onClose?.(event)
    })

    return () => {
      websocket.close()
      wsRef.current = null
    }
  }, [url, enabled, onMessage, onOpen, onClose])

  return {
    isConnected,
    lastMessage,
    send: (payload: unknown) => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify(payload))
      }
    },
    close: () => {
      wsRef.current?.close()
    },
  }
}
