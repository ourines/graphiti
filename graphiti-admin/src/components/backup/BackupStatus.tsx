import type { BackupServiceStatus } from '@/api/types'
import Card from '@/components/ui/Card'
import { formatDateTime } from '@/utils/formatters'

const StatusBadge = ({ status }: { status: string | null | undefined }) => {
  if (!status) return null
  const mappings: Record<string, string> = {
    running: 'bg-amber-500/10 text-amber-300',
    completed: 'bg-emerald-500/10 text-emerald-300',
    failed: 'bg-rose-500/10 text-rose-300',
    idle: 'bg-slate-700 text-slate-200',
  }
  const style = mappings[status] ?? 'bg-slate-700 text-slate-200'
  return <span className={`rounded-full px-3 py-1 text-xs font-semibold ${style}`}>{status}</span>
}

type BackupStatusProps = {
  status: BackupServiceStatus | undefined
  isLoading: boolean
}

const BackupStatusCard = ({ status, isLoading }: BackupStatusProps) => {
  return (
    <Card
      title="Backup service"
      description="实时服务状态与最近一次任务信息"
      className="h-full"
    >
      {isLoading && <p className="text-sm text-muted-foreground">Loading status…</p>}

      {!isLoading && status && (
        <div className="space-y-4 text-sm">
          <div className="flex items-center justify-between rounded-lg border border-slate-800 bg-background/60 px-3 py-2">
            <span className="text-muted-foreground">Worker 状态</span>
            <StatusBadge status={status.running ? 'running' : status.settings.lastStatus ?? 'idle'} />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-lg border border-slate-800 bg-background/60 p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">当前任务</p>
              <p className="font-medium text-slate-100">{status.job_id ?? '无正在运行任务'}</p>
            </div>
            <div className="rounded-lg border border-slate-800 bg-background/60 p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">最近执行</p>
              <p className="font-medium text-slate-100">
                {formatDateTime(status.settings.lastRunAt ?? null, '未记录')}
              </p>
            </div>
          </div>
          <div className="rounded-lg border border-slate-800 bg-background/60 p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">下次计划</p>
            <p className="font-medium text-slate-100">
              {status.settings.enabled
                ? formatDateTime(status.settings.nextRunAt ?? null, '计算中…')
                : '计划暂停'}
            </p>
          </div>
          {status.settings.lastError && (
            <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-100">
              <p className="font-semibold">最后错误</p>
              <p>{status.settings.lastError}</p>
            </div>
          )}
        </div>
      )}

      {!isLoading && !status && <p className="text-sm text-muted-foreground">无法获取服务状态。</p>}
    </Card>
  )
}

export default BackupStatusCard
