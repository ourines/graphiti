import { useEffect, useState } from 'react'
import { Clock, ToggleLeft, ToggleRight } from 'lucide-react'

import type { BackupSettingsPayload } from '@/api/types'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import Input from '@/components/ui/Input'
import { formatDateTime } from '@/utils/formatters'

type BackupSettingsProps = {
  settings: BackupSettingsPayload | undefined
  isLoading: boolean
  onSave: (payload: BackupSettingsPayload) => void
  isSaving: boolean
}

const BackupSettings = ({ settings, isLoading, onSave, isSaving }: BackupSettingsProps) => {
  const [localSettings, setLocalSettings] = useState<BackupSettingsPayload | null>(null)

  useEffect(() => {
    if (settings) {
      setLocalSettings(settings)
    }
  }, [settings])

  const handleChange = (key: keyof BackupSettingsPayload, value: string | number | boolean) => {
    if (!localSettings) return
    setLocalSettings({ ...localSettings, [key]: value } as BackupSettingsPayload)
  }

  const handleSubmit = () => {
    if (localSettings) {
      onSave(localSettings)
    }
  }

  return (
    <Card
      title="Backup settings"
      description="Control automated backups and retention policies"
      actions={
        <Button onClick={handleSubmit} disabled={!localSettings || isSaving}>
          {isSaving ? 'Saving…' : 'Save changes'}
        </Button>
      }
    >
      {isLoading && <p className="text-sm text-muted-foreground">Loading settings…</p>}

      {!isLoading && localSettings && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-slate-100">Automated backups</p>
              <p className="text-xs text-muted-foreground">
                {localSettings.enabled ? 'Enabled — backups will follow the schedule below.' : 'Disabled — backups must be triggered manually.'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleChange('enabled', !localSettings.enabled)}
              className="text-accent"
            >
              {localSettings.enabled ? <ToggleRight className="h-8 w-8" /> : <ToggleLeft className="h-8 w-8" />}
            </button>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-2">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">Cron expression</span>
              <Input
                value={localSettings.cron}
                onChange={(event) => handleChange('cron', event.target.value)}
                placeholder="0 3 * * *"
              />
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">Retention (days)</span>
              <Input
                type="number"
                min={1}
                value={localSettings.retentionDays}
                onChange={(event) => handleChange('retentionDays', Number(event.target.value))}
              />
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex items-start gap-3 rounded-lg border border-slate-800 bg-background/60 p-3 text-sm">
              <Clock className="mt-1 h-4 w-4 text-accent" />
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Last backup</p>
                <p className="font-medium text-slate-100">{formatDateTime(settings?.lastRunAt)}</p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-lg border border-slate-800 bg-background/60 p-3 text-sm">
              <Clock className="mt-1 h-4 w-4 text-accent" />
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Next scheduled run</p>
                <p className="font-medium text-slate-100">{formatDateTime(settings?.nextRunAt)}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </Card>
  )
}

export default BackupSettings
