import { useEffect, useMemo, useState } from 'react'

import { graphitiClient } from '@/api/client'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import Input from '@/components/ui/Input'
import { useAuthStore } from '@/store/authStore'

type AuthMode = 'basic' | 'bearer'

const AuthGate = ({ children }: { children: React.ReactNode }) => {
  const authorizationHeader = useAuthStore((state) => state.authorizationHeader)
  const authType = useAuthStore((state) => state.authType)
  const setBasicCredentials = useAuthStore((state) => state.setBasicCredentials)
  const setBearerToken = useAuthStore((state) => state.setBearerToken)
  const clearAuth = useAuthStore((state) => state.clearAuth)

  const [mode, setMode] = useState<AuthMode>('basic')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [token, setToken] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (authType === 'bearer') {
      setMode('bearer')
    } else if (authType === 'basic') {
      setMode('basic')
    }
  }, [authType])

  useEffect(() => {
    if (authorizationHeader) {
      setError(null)
    }
  }, [authorizationHeader])

  const showOverlay = useMemo(() => !authorizationHeader, [authorizationHeader])

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    if (mode === 'basic') {
      if (!username || !password) {
        setError('请输入用户名和密码')
        return
      }
      setBasicCredentials(username, password)
    } else {
      if (!token) {
        setError('请输入 API Token')
        return
      }
      setBearerToken(token)
    }

    setSubmitting(true)
    try {
      await graphitiClient.get('/healthcheck')
      setError(null)
    } catch (apiError) {
      console.error('Authentication check failed', apiError)
      clearAuth()
      setError('认证失败，请检查凭证')
    } finally {
      setSubmitting(false)
    }
  }

  if (!showOverlay) {
    return <>{children}</>
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface">
      <Card
        title="GraphiTi 控制台"
        description="请输入认证信息访问后端 API"
        className="w-full max-w-md space-y-4"
      >
        <div className="flex items-center gap-3 rounded-lg border border-slate-800 bg-background/60 p-2 text-xs">
          <button
            type="button"
            className={`flex-1 rounded-md px-3 py-2 font-medium transition ${mode === 'basic' ? 'bg-accent/20 text-accent' : 'text-muted-foreground hover:text-slate-200'}`}
            onClick={() => setMode('basic')}
          >
            Basic Auth
          </button>
          <button
            type="button"
            className={`flex-1 rounded-md px-3 py-2 font-medium transition ${mode === 'bearer' ? 'bg-accent/20 text-accent' : 'text-muted-foreground hover:text-slate-200'}`}
            onClick={() => setMode('bearer')}
          >
            Bearer Token
          </button>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          {mode === 'basic' ? (
            <>
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-wide text-muted-foreground">用户名</label>
                <Input
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  placeholder="输入用户名"
                  autoComplete="username"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-wide text-muted-foreground">密码</label>
                <Input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="输入密码"
                  autoComplete="current-password"
                />
              </div>
            </>
          ) : (
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wide text-muted-foreground">API Token</label>
              <Input
                value={token}
                onChange={(event) => setToken(event.target.value)}
                placeholder="输入 Bearer Token"
              />
            </div>
          )}

          {error && <p className="text-sm text-rose-400">{error}</p>}

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? '验证中…' : '确认访问'}
          </Button>
        </form>
      </Card>
    </div>
  )
}

export default AuthGate
