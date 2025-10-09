import { useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Database,
  ListChecks,
  Play,
  RefreshCw,
  Server,
  Settings as SettingsIcon,
  TrendingUp,
  Trash2,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import BackupStatusCard from '@/components/backup/BackupStatus'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import GraphStatsPanel from '@/components/graph/GraphStats'
import { useBackupHistory, useBackupStatus, useTriggerManualBackup } from '@/hooks/useBackup'
import { useGraphGroups, useGraphStats } from '@/hooks/useGraph'
import { useGraphStore } from '@/store/graphStore'
import { formatDateTime, formatNumber, formatRelativeTime } from '@/utils/formatters'

type BannerState = {
  type: 'success' | 'error'
  message: string
} | null

type MetricConfig = {
  key: string
  label: string
  value: string
  helper?: string
  icon: LucideIcon
  tone?: 'default' | 'alert'
}

const statusStyles: Record<string, { icon: LucideIcon; label: string; className: string }> = {
  completed: {
    icon: CheckCircle2,
    label: 'Backup completed',
    className: 'bg-emerald-500/10 text-emerald-300',
  },
  running: {
    icon: RefreshCw,
    label: 'Backup in progress',
    className: 'bg-amber-500/10 text-amber-300',
  },
  failed: {
    icon: AlertTriangle,
    label: 'Backup failed',
    className: 'bg-rose-500/10 text-rose-300',
  },
  deleted: {
    icon: Trash2,
    label: 'Backup deleted',
    className: 'bg-slate-700 text-muted-foreground',
  },
}

const MetricCard = ({ icon: Icon, label, value, helper, tone = 'default' }: MetricConfig) => {
  const iconStyles =
    tone === 'alert'
      ? 'bg-rose-500/10 text-rose-300'
      : 'bg-accent/10 text-accent'

  return (
    <div className="flex items-start gap-4 rounded-xl border border-slate-800 bg-surface/80 p-5 shadow-lg">
      <span className={`flex h-12 w-12 items-center justify-center rounded-lg ${iconStyles}`}>
        <Icon className="h-6 w-6" />
      </span>
      <div className="space-y-1">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="text-2xl font-semibold text-slate-100">{value}</p>
        {helper && <p className="text-xs text-muted-foreground">{helper}</p>}
      </div>
    </div>
  )
}

const getTriggerErrorMessage = (error: unknown) => {
  if (axios.isAxiosError(error) && error.response?.status === 409) {
    return 'A backup is already running. Try again after it completes.'
  }
  return 'Failed to trigger backup'
}

const Dashboard = () => {
  const navigate = useNavigate()
  const { data: groupsData, isLoading: groupsLoading } = useGraphGroups()
  const {
    selectedGroupId,
    setSelectedGroupId,
  } = useGraphStore()
  const [banner, setBanner] = useState<BannerState>(null)

  useEffect(() => {
    if (groupsData?.group_ids?.length && !selectedGroupId) {
      setSelectedGroupId(groupsData.group_ids[0])
    }
  }, [groupsData, selectedGroupId, setSelectedGroupId])

  const {
    data: stats,
    isLoading: statsLoading,
    isFetching: statsRefreshing,
    refetch: refetchStats,
  } = useGraphStats(selectedGroupId ?? undefined)
  const {
    data: backupStatus,
    isLoading: statusLoading,
    isFetching: statusRefreshing,
    refetch: refetchStatus,
  } = useBackupStatus()
  const {
    data: history,
    isLoading: historyLoading,
    isFetching: historyRefreshing,
    refetch: refetchHistory,
  } = useBackupHistory()
  const triggerBackup = useTriggerManualBackup()

  useEffect(() => {
    if (!banner) return
    const timer = window.setTimeout(() => setBanner(null), 4000)
    return () => window.clearTimeout(timer)
  }, [banner])

  const sortedHistory = useMemo(() => {
    if (!history?.length) return []
    return [...history].sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime())
  }, [history])

  const recentActivity = useMemo(() => sortedHistory.slice(0, 5), [sortedHistory])

  const latestCompleted = useMemo(
    () => sortedHistory.find((entry) => entry.status === 'completed'),
    [sortedHistory],
  )

  const totalBackups = history?.length ?? 0
  const failedBackups = history?.filter((entry) => entry.status === 'failed').length ?? 0

  const metrics: MetricConfig[] = [
    {
      key: 'entities',
      label: 'Entities',
      value: formatNumber(stats?.total_entities),
      helper: selectedGroupId ? `Group ${selectedGroupId}` : 'Select a group to load metrics',
      icon: Database,
    },
    {
      key: 'facts',
      label: 'Facts',
      value: formatNumber(stats?.total_facts),
      helper: 'Knowledge statements linked to this group',
      icon: ListChecks,
    },
    {
      key: 'backups',
      label: 'Recorded backups',
      value: formatNumber(totalBackups),
      helper: failedBackups ? `${failedBackups} failed recently` : 'No failures detected',
      icon: Server,
      tone: failedBackups > 0 ? 'alert' : 'default',
    },
    {
      key: 'last-backup',
      label: 'Last backup',
      value: formatRelativeTime(latestCompleted?.completed_at ?? latestCompleted?.started_at ?? null, '—'),
      helper: latestCompleted ? formatDateTime(latestCompleted.completed_at ?? latestCompleted.started_at) : 'No successful runs yet',
      icon: RefreshCw,
    },
  ]

  const handleManualBackup = async () => {
    try {
      await triggerBackup.mutateAsync({
        description: 'Manual backup triggered via dashboard quick action',
      })
      setBanner({ type: 'success', message: 'Backup job queued successfully' })
      refetchStatus()
      refetchHistory()
    } catch (error) {
      console.error(error)
      setBanner({ type: 'error', message: getTriggerErrorMessage(error) })
    }
  }

  const refreshAll = () => {
    refetchStats()
    refetchStatus()
    refetchHistory()
  }

  const isRefreshing = statsRefreshing || statusRefreshing || historyRefreshing

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

      <section className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-100">Overview</h1>
          <p className="text-sm text-muted-foreground">
            Track graph insights and the health of your backup pipeline at a glance.
          </p>
        </div>
        <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
          <label className="flex flex-col text-xs uppercase tracking-wide text-muted-foreground">
            Active group
            <select
              value={selectedGroupId ?? ''}
              onChange={(event) => setSelectedGroupId(event.target.value)}
              disabled={groupsLoading || !groupsData?.group_ids?.length}
              className="mt-1 h-10 min-w-[220px] rounded-lg border border-slate-800 bg-background px-3 text-sm text-slate-100 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <option value="" disabled>
                {groupsLoading ? 'Loading…' : 'Select a group'}
              </option>
              {groupsData?.group_ids?.map((groupId) => (
                <option key={groupId} value={groupId}>
                  {groupId}
                </option>
              ))}
            </select>
          </label>
          <Button
            variant="secondary"
            size="sm"
            onClick={refreshAll}
            disabled={isRefreshing}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh data
          </Button>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <MetricCard key={metric.key} {...metric} />
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[2fr_1fr]">
        <div className="space-y-6">
          <GraphStatsPanel stats={stats} isLoading={statsLoading || statsRefreshing} />

          <Card
            title="Recent activity"
            description="Latest backup runs and graph events"
            actions={
              <Button
                variant="ghost"
                size="sm"
                className="gap-2 text-slate-200"
                onClick={() => navigate('/backups')}
              >
                View backups
                <ArrowRight className="h-4 w-4" />
              </Button>
            }
          >
            {historyLoading && <p className="text-sm text-muted-foreground">Loading history…</p>}

            {!historyLoading && !recentActivity.length && (
              <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
            )}

            {!historyLoading && recentActivity.length > 0 && (
              <ul className="space-y-3">
                {recentActivity.map((entry) => {
                  const visual = statusStyles[entry.status] ?? statusStyles.completed
                  const Icon = visual.icon
                  const timestamp = entry.completed_at ?? entry.started_at

                  return (
                    <li
                      key={entry.id}
                      className="flex items-start justify-between gap-3 rounded-xl border border-slate-800 bg-background/60 p-4"
                    >
                      <div className="flex items-start gap-3">
                        <span className={`mt-1 flex h-8 w-8 items-center justify-center rounded-lg ${visual.className}`}>
                          <Icon className={`h-4 w-4 ${entry.status === 'running' ? 'animate-spin' : ''}`} />
                        </span>
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-slate-100">{visual.label}</p>
                          <p className="text-xs text-muted-foreground">
                            {entry.details ?? `Backup ${entry.id.slice(0, 10)}…`}
                          </p>
                        </div>
                      </div>
                      <div className="text-right text-xs text-muted-foreground">
                        <p>{formatRelativeTime(timestamp)}</p>
                        <p>{formatDateTime(timestamp)}</p>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <BackupStatusCard status={backupStatus} isLoading={statusLoading || statusRefreshing} />

          <Card
            title="Quick actions"
            description="Jump to frequent tasks or launch a backup"
          >
            <div className="space-y-3">
              <Button
                variant="secondary"
                className="w-full justify-between gap-2"
                onClick={() => navigate('/graph')}
              >
                Explore graph workspace
                <TrendingUp className="h-4 w-4" />
              </Button>
              <Button
                variant="secondary"
                className="w-full justify-between gap-2"
                onClick={() => navigate('/backups')}
              >
                Review backup history
                <Server className="h-4 w-4" />
              </Button>
              <Button
                className="w-full justify-between gap-2"
                onClick={handleManualBackup}
                disabled={triggerBackup.isPending}
              >
                Trigger manual backup
                <Play className={`h-4 w-4 ${triggerBackup.isPending ? 'animate-pulse' : ''}`} />
              </Button>
              <Button
                variant="ghost"
                className="w-full justify-between gap-2 text-slate-200"
                onClick={() => navigate('/settings')}
              >
                Configure admin settings
                <SettingsIcon className="h-4 w-4" />
              </Button>
            </div>
          </Card>
        </div>
      </section>
    </div>
  )
}

export default Dashboard
