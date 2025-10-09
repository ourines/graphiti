import type { BackupSettingsPayload } from '@/api/types'
import Card from '@/components/ui/Card'
import { formatDateTime } from '@/utils/formatters'

type BackupScheduleProps = {
  settings: BackupSettingsPayload | undefined
}

const humanizeCron = (cron: string | undefined) => {
  if (!cron) return 'Cron expression not set'
  if (cron === '0 3 * * *') return 'Every day at 03:00'
  if (cron === '0 */6 * * *') return 'Every 6 hours'
  if (cron === '0 0 * * 0') return 'Weekly on Sunday at midnight'
  return cron
}

const BackupSchedule = ({ settings }: BackupScheduleProps) => {
  return (
    <Card
      title="Schedule overview"
      description="Summaries generated from the active cron expression"
    >
      <div className="grid gap-3 text-sm">
        <div className="rounded-lg border border-slate-800 bg-background/60 p-3">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Cron</p>
          <p className="font-medium text-slate-100">{settings?.cron ?? '—'}</p>
          <p className="text-xs text-muted-foreground">{humanizeCron(settings?.cron)}</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-slate-800 bg-background/60 p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Last run</p>
            <p className="font-medium text-slate-100">{formatDateTime(settings?.lastRunAt)}</p>
          </div>
          <div className="rounded-lg border border-slate-800 bg-background/60 p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Next run</p>
            <p className="font-medium text-slate-100">{formatDateTime(settings?.nextRunAt)}</p>
          </div>
        </div>
        <div className="rounded-lg border border-slate-800 bg-background/60 p-3">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Retention policy</p>
          <p className="font-medium text-slate-100">
            Keep backups for {settings?.retentionDays ?? '—'} days
          </p>
        </div>
      </div>
    </Card>
  )
}

export default BackupSchedule
