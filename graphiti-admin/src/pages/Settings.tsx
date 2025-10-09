import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  Copy,
  Info,
  Mail,
  Save,
  ToggleLeft,
  ToggleRight,
  Webhook,
} from 'lucide-react'

import BackupSettings from '@/components/backup/BackupSettings'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import Input from '@/components/ui/Input'
import { useBackupSettings, useUpdateBackupSettings } from '@/hooks/useBackup'
import { useGraphGroups } from '@/hooks/useGraph'
import { useGraphStore } from '@/store/graphStore'
import { BACKUP_API_URL, GRAPHITI_API_URL, GRAPH_WEBSOCKET_URL } from '@/constants/env'
import type { BackupSettingsPayload } from '@/api/types'

type BannerState = {
  type: 'success' | 'error'
  message: string
} | null

type SyncSettings = {
  defaultGroupId: string | null
  autoRefresh: boolean
  refreshIntervalSeconds: number
  autoSelectNode: boolean
}

type NotificationSettings = {
  emailEnabled: boolean
  emailRecipients: string
  webhookEnabled: boolean
  webhookUrl: string
  severityThreshold: 'info' | 'warning' | 'error'
}

const SYNC_SETTINGS_KEY = 'graphiti-admin-sync-settings'
const NOTIFICATION_SETTINGS_KEY = 'graphiti-admin-notification-settings'

const defaultSyncSettings: SyncSettings = {
  defaultGroupId: null,
  autoRefresh: true,
  refreshIntervalSeconds: 60,
  autoSelectNode: true,
}

const defaultNotificationSettings: NotificationSettings = {
  emailEnabled: false,
  emailRecipients: '',
  webhookEnabled: false,
  webhookUrl: '',
  severityThreshold: 'warning',
}

const textareaClassName =
  'min-h-[90px] w-full rounded-lg border border-slate-800 bg-surface px-3 py-2 text-sm text-slate-100 placeholder:text-muted-foreground focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/50 disabled:cursor-not-allowed disabled:opacity-60'

const Settings = () => {
  const { data: groupsData, isLoading: groupsLoading } = useGraphGroups()
  const { setSelectedGroupId } = useGraphStore()
  const { data: backupSettings, isLoading: backupLoading } = useBackupSettings()
  const updateBackupSettings = useUpdateBackupSettings()

  const [syncSettings, setSyncSettings] = useState<SyncSettings>(() => {
    if (typeof window === 'undefined') return defaultSyncSettings
    try {
      const raw = window.localStorage.getItem(SYNC_SETTINGS_KEY)
      if (!raw) return defaultSyncSettings
      const parsed = JSON.parse(raw) as Partial<SyncSettings>
      return { ...defaultSyncSettings, ...parsed }
    } catch (error) {
      console.warn('Failed to load sync settings from storage', error)
      return defaultSyncSettings
    }
  })

  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>(() => {
    if (typeof window === 'undefined') return defaultNotificationSettings
    try {
      const raw = window.localStorage.getItem(NOTIFICATION_SETTINGS_KEY)
      if (!raw) return defaultNotificationSettings
      const parsed = JSON.parse(raw) as Partial<NotificationSettings>
      return { ...defaultNotificationSettings, ...parsed }
    } catch (error) {
      console.warn('Failed to load notification settings from storage', error)
      return defaultNotificationSettings
    }
  })

  const [banner, setBanner] = useState<BannerState>(null)

  useEffect(() => {
    if (!groupsData?.group_ids?.length) return
    setSyncSettings((current) => {
      if (current.defaultGroupId && groupsData.group_ids.includes(current.defaultGroupId)) {
        return current
      }
      return {
        ...current,
        defaultGroupId: groupsData.group_ids[0],
      }
    })
  }, [groupsData])

  useEffect(() => {
    if (!banner) return
    const timer = window.setTimeout(() => setBanner(null), 4000)
    return () => window.clearTimeout(timer)
  }, [banner])

  const groupOptions = useMemo(() => groupsData?.group_ids ?? [], [groupsData])

  const updateSyncSetting = <K extends keyof SyncSettings>(key: K, value: SyncSettings[K]) => {
    setSyncSettings((current) => ({ ...current, [key]: value }))
  }

  const updateNotificationSetting = <K extends keyof NotificationSettings>(
    key: K,
    value: NotificationSettings[K],
  ) => {
    setNotificationSettings((current) => ({ ...current, [key]: value }))
  }

  const persistSyncSettings = (value: SyncSettings) => {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(SYNC_SETTINGS_KEY, JSON.stringify(value))
    } catch (error) {
      console.warn('Failed to persist sync settings', error)
    }
  }

  const persistNotificationSettings = (value: NotificationSettings) => {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(NOTIFICATION_SETTINGS_KEY, JSON.stringify(value))
    } catch (error) {
      console.warn('Failed to persist notification settings', error)
    }
  }

  const handleSaveSyncSettings = () => {
    persistSyncSettings(syncSettings)
    if (syncSettings.defaultGroupId) {
      setSelectedGroupId(syncSettings.defaultGroupId)
    }
    setBanner({ type: 'success', message: 'Graph workspace preferences updated' })
  }

  const handleSaveNotificationSettings = () => {
    persistNotificationSettings(notificationSettings)
    setBanner({ type: 'success', message: 'Notification preferences saved locally' })
  }

  const handleCopy = async (value: string) => {
    if (!value) return
    if (typeof navigator === 'undefined' || !navigator.clipboard) {
      setBanner({ type: 'error', message: 'Clipboard API unavailable in this browser' })
      return
    }
    try {
      await navigator.clipboard.writeText(value)
      setBanner({ type: 'success', message: 'Copied to clipboard' })
    } catch (error) {
      console.error(error)
      setBanner({ type: 'error', message: 'Failed to copy value' })
    }
  }

  const handleBackupSettingsSave = async (payload: BackupSettingsPayload) => {
    try {
      await updateBackupSettings.mutateAsync(payload)
      setBanner({ type: 'success', message: 'Backup schedule saved' })
    } catch (error) {
      console.error(error)
      setBanner({ type: 'error', message: 'Failed to save backup schedule' })
    }
  }

  return (
    <div className="space-y-6">
      {banner && (
        <div
          className={`rounded-lg border px-4 py-3 text-sm ${
            banner.type === 'success'
              ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
              : 'border-rose-500/40 bg-rose-500/10 text-rose-200'
          }`}
        >
          {banner.message}
        </div>
      )}

      <section>
        <h1 className="text-2xl font-semibold text-slate-100">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure how the admin console connects to GraphiTi services, refreshes data, and alerts your
          team.
        </p>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <div className="space-y-6">
          <Card
            title="Environment"
            description="Current endpoints resolved from environment variables"
          >
            <div className="space-y-3 text-sm">
              {[{
                label: 'GraphiTi API base URL',
                value: GRAPHITI_API_URL,
              },
              {
                label: 'Backup API base URL',
                value: BACKUP_API_URL,
              },
              {
                label: 'Graph WebSocket URL',
                value: GRAPH_WEBSOCKET_URL || 'Not configured',
              }].map(({ label, value }) => (
                <div key={label} className="space-y-1">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
                  <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 bg-background/60 px-3 py-2">
                    <span className="truncate font-mono text-xs text-slate-300">{value}</span>
                    {value && value !== 'Not configured' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-2 text-slate-200"
                        onClick={() => handleCopy(value)}
                      >
                        <Copy className="h-4 w-4" />
                        Copy
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card
            title="Graph workspace"
            description="Defaults applied when loading the visualization experience"
            actions={
              <Button
                onClick={handleSaveSyncSettings}
                className="gap-2"
                disabled={groupsLoading}
              >
                <Save className="h-4 w-4" />
                Save preferences
              </Button>
            }
          >
            <div className="space-y-6 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-slate-100">Auto refresh graph data</p>
                  <p className="text-xs text-muted-foreground">
                    Automatically poll entities and facts in the background.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => updateSyncSetting('autoRefresh', !syncSettings.autoRefresh)}
                  className="text-accent"
                >
                  {syncSettings.autoRefresh ? (
                    <ToggleRight className="h-8 w-8" />
                  ) : (
                    <ToggleLeft className="h-8 w-8" />
                  )}
                </button>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="flex flex-col gap-2">
                  <span className="text-xs uppercase tracking-wide text-muted-foreground">Default group</span>
                  <select
                    value={syncSettings.defaultGroupId ?? ''}
                    onChange={(event) => updateSyncSetting('defaultGroupId', event.target.value)}
                    disabled={groupsLoading || !groupOptions.length}
                    className="h-10 w-full rounded-lg border border-slate-800 bg-background px-3 text-sm text-slate-100 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <option value="" disabled>
                      {groupsLoading ? 'Loading groups…' : 'Select a group'}
                    </option>
                    {groupOptions.map((groupId) => (
                      <option key={groupId} value={groupId}>
                        {groupId}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="flex flex-col gap-2">
                  <span className="text-xs uppercase tracking-wide text-muted-foreground">Refresh interval (seconds)</span>
                  <Input
                    type="number"
                    min={15}
                    max={600}
                    value={syncSettings.refreshIntervalSeconds}
                    onChange={(event) => updateSyncSetting('refreshIntervalSeconds', Number(event.target.value))}
                    disabled={!syncSettings.autoRefresh}
                  />
                </label>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-slate-100">Auto-expand selected entities</p>
                  <p className="text-xs text-muted-foreground">
                    When enabled the insight panel opens with the first matching node.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => updateSyncSetting('autoSelectNode', !syncSettings.autoSelectNode)}
                  className="text-accent"
                >
                  {syncSettings.autoSelectNode ? (
                    <ToggleRight className="h-8 w-8" />
                  ) : (
                    <ToggleLeft className="h-8 w-8" />
                  )}
                </button>
              </div>

              {!syncSettings.autoRefresh && (
                <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
                  <AlertTriangle className="mt-0.5 h-4 w-4 flex-none" />
                  Background refresh is disabled. Trigger manual reloads from the graph view when you need
                  fresh data.
                </div>
              )}
            </div>
          </Card>

          <Card
            title="Notifications"
            description="Preferences are stored locally until the server-side alerting API ships"
            actions={
              <Button onClick={handleSaveNotificationSettings} className="gap-2">
                <Save className="h-4 w-4" />
                Save notification settings
              </Button>
            }
          >
            <div className="space-y-6 text-sm">
              <div className="flex items-start gap-2 rounded-lg border border-slate-800 bg-background/60 px-3 py-2 text-xs text-muted-foreground">
                <Info className="mt-0.5 h-4 w-4 flex-none text-accent" />
                Alerting integrations are on the roadmap. Configure your preferred channels now and wire
                them to the API once available.
              </div>

              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-2 text-sm font-medium text-slate-100">
                    <Mail className="h-4 w-4 text-accent" />
                    Email notifications
                  </div>
                  <button
                    type="button"
                    onClick={() => updateNotificationSetting('emailEnabled', !notificationSettings.emailEnabled)}
                    className="text-accent"
                  >
                    {notificationSettings.emailEnabled ? (
                      <ToggleRight className="h-8 w-8" />
                    ) : (
                      <ToggleLeft className="h-8 w-8" />
                    )}
                  </button>
                </div>
                <label className="flex flex-col gap-2">
                  <span className="text-xs uppercase tracking-wide text-muted-foreground">Recipients</span>
                  <textarea
                    value={notificationSettings.emailRecipients}
                    onChange={(event) => updateNotificationSetting('emailRecipients', event.target.value)}
                    placeholder="comma,separated@example.com"
                    className={textareaClassName}
                    disabled={!notificationSettings.emailEnabled}
                  />
                </label>
              </div>

              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-2 text-sm font-medium text-slate-100">
                    <Webhook className="h-4 w-4 text-accent" />
                    Webhook notifications
                  </div>
                  <button
                    type="button"
                    onClick={() => updateNotificationSetting('webhookEnabled', !notificationSettings.webhookEnabled)}
                    className="text-accent"
                  >
                    {notificationSettings.webhookEnabled ? (
                      <ToggleRight className="h-8 w-8" />
                    ) : (
                      <ToggleLeft className="h-8 w-8" />
                    )}
                  </button>
                </div>
                <label className="flex flex-col gap-2">
                  <span className="text-xs uppercase tracking-wide text-muted-foreground">Webhook URL</span>
                  <Input
                    value={notificationSettings.webhookUrl}
                    onChange={(event) => updateNotificationSetting('webhookUrl', event.target.value)}
                    placeholder="https://hooks.example.com/graphiti"
                    disabled={!notificationSettings.webhookEnabled}
                  />
                </label>
              </div>

              <label className="flex flex-col gap-2">
                <span className="text-xs uppercase tracking-wide text-muted-foreground">Minimum severity</span>
                <select
                  value={notificationSettings.severityThreshold}
                  onChange={(event) =>
                    updateNotificationSetting('severityThreshold', event.target.value as NotificationSettings['severityThreshold'])
                  }
                  className="h-10 w-full rounded-lg border border-slate-800 bg-background px-3 text-sm text-slate-100 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/50"
                >
                  <option value="info">Info</option>
                  <option value="warning">Warning</option>
                  <option value="error">Error only</option>
                </select>
              </label>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <BackupSettings
            settings={backupSettings}
            isLoading={backupLoading}
            onSave={handleBackupSettingsSave}
            isSaving={updateBackupSettings.isPending}
          />
        </div>
      </section>
    </div>
  )
}

export default Settings
