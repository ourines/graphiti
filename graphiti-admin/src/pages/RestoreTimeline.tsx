import { useEffect, useMemo, useState } from 'react'
import {
  AlarmClock,
  CheckCircle2,
  Clock,
  Download,
  Eraser,
  History,
  Loader2,
  RefreshCw,
  ShieldAlert,
  Undo2,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import {
  useBackupHistory,
  useRestoreStatus,
  useTriggerRestore,
} from '@/hooks/useBackup'
import { formatDateTime, formatFileSize, formatNumber, formatRelativeTime } from '@/utils/formatters'
import type { BackupHistoryEntry } from '@/api/types'

type BannerState = {
  type: 'success' | 'error'
  message: string
} | null

type TimelineSnapshot = BackupHistoryEntry & {
  deltaNodes: number | null
  deltaRelationships: number | null
  deltaSize: number | null
  labelsList: string[]
}

const statusBadge: Record<string, string> = {
  idle: 'bg-slate-800 text-slate-300',
  running: 'bg-amber-500/10 text-amber-300',
  completed: 'bg-emerald-500/10 text-emerald-300',
  failed: 'bg-rose-500/10 text-rose-300',
}

type RestorePhase = 'idle' | 'downloading' | 'clearing' | 'replaying' | 'completed' | 'failed'

const RESTORE_STEPS: Array<{
  key: RestorePhase
  label: string
  description: string
  icon: LucideIcon
}> = [
  {
    key: 'downloading',
    label: '下载备份',
    description: '从 R2 拉取备份文件',
    icon: Download,
  },
  {
    key: 'clearing',
    label: '清空图谱',
    description: '删除现有节点与索引',
    icon: Eraser,
  },
  {
    key: 'replaying',
    label: '回放 Cypher',
    description: '执行备份中的语句',
    icon: RefreshCw,
  },
]

const PHASE_INDEX: Record<RestorePhase, number> = {
  idle: -1,
  downloading: 0,
  clearing: 1,
  replaying: 2,
  completed: RESTORE_STEPS.length,
  failed: RESTORE_STEPS.length,
}

const RestoreTimeline = () => {
  const historyQuery = useBackupHistory()
  const restoreStatusQuery = useRestoreStatus()
  const triggerRestore = useTriggerRestore()

  const { data: history, isLoading: historyLoading, isFetching: historyRefreshing, refetch: refetchHistory } =
    historyQuery
  const {
    data: restoreStatus,
    isLoading: restoreLoading,
    isFetching: restoreRefreshing,
    refetch: refetchRestore,
  } = restoreStatusQuery

  const [selectedIndex, setSelectedIndex] = useState(0)
  const [banner, setBanner] = useState<BannerState>(null)

  const historyLength = history?.length ?? 0

  useEffect(() => {
    if (historyLength > 0) {
      setSelectedIndex((current) => Math.min(current, historyLength - 1))
    }
  }, [historyLength])

  useEffect(() => {
    if (!banner) return
    const timer = window.setTimeout(() => setBanner(null), 4000)
    return () => window.clearTimeout(timer)
  }, [banner])

  const sortedHistory = useMemo(() => {
    if (!history?.length) return []
    return [...history].sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime())
  }, [history])

  const timelineData = useMemo(() => {
    if (!sortedHistory.length) {
      return { entries: [] as TimelineSnapshot[], maxSize: 0 }
    }

    const entries: TimelineSnapshot[] = sortedHistory.map((entry, index) => {
      const previous = sortedHistory[index + 1]
      const deltaNodes =
        entry.node_count != null && previous?.node_count != null
          ? entry.node_count - previous.node_count
          : null
      const deltaRelationships =
        entry.relationship_count != null && previous?.relationship_count != null
          ? entry.relationship_count - previous.relationship_count
          : null
      const deltaSize =
        entry.size_bytes != null && previous?.size_bytes != null
          ? entry.size_bytes - previous.size_bytes
          : null

      const labelsList = entry.labels?.slice(0, 6) ?? []

      return {
        ...entry,
        deltaNodes,
        deltaRelationships,
        deltaSize,
        labelsList,
      }
    })

    const maxSize = entries.reduce((acc, item) => Math.max(acc, item.size_bytes ?? 0), 0)
    return { entries, maxSize }
  }, [sortedHistory])

  const enhancedHistory = timelineData.entries
  const maxTimelineSize = timelineData.maxSize > 0 ? timelineData.maxSize : 1

  const selectedSnapshot = enhancedHistory[selectedIndex] ?? null
  const previousSnapshot = enhancedHistory[selectedIndex + 1] ?? null

  const labelDiff = useMemo(() => {
    if (!selectedSnapshot?.labels || !previousSnapshot?.labels) {
      return { added: [] as string[], removed: [] as string[] }
    }
    const currentSet = new Set(selectedSnapshot.labels)
    const previousSet = new Set(previousSnapshot.labels)
    const added = [...currentSet].filter((item) => !previousSet.has(item)).slice(0, 8)
    const removed = [...previousSet].filter((item) => !currentSet.has(item)).slice(0, 8)
    return { added, removed }
  }, [selectedSnapshot?.labels, previousSnapshot?.labels])

  const handleSelectSnapshot = (index: number) => {
    setSelectedIndex(index)
  }

  const handleRestore = async (entry: BackupHistoryEntry) => {
    const confirmed = window.confirm(
      `确定要将 Neo4j 数据恢复到 ${formatDateTime(entry.started_at)} 的状态吗？该操作将覆盖现有数据。`,
    )

    if (!confirmed) return

    try {
      await triggerRestore.mutateAsync(entry.id)
      setBanner({ type: 'success', message: '恢复任务已提交，正在后台执行。' })
      refetchRestore()
    } catch (error) {
      console.error(error)
      setBanner({ type: 'error', message: '提交恢复任务失败，请检查服务日志。' })
    }
  }

  const isBusy = triggerRestore.isPending || restoreStatus?.running

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

      <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-100">时间快照恢复</h1>
          <p className="text-sm text-muted-foreground">
            浏览备份时间线，像 macOS 时间机器一样回溯 Neo4j 图谱状态。
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            size="sm"
            className="gap-2"
            onClick={() => {
              refetchHistory()
              refetchRestore()
            }}
            disabled={historyRefreshing || restoreRefreshing}
          >
            <RefreshIndicator spinning={historyRefreshing || restoreRefreshing} />
            刷新数据
          </Button>
        </div>
      </header>

      <section className="grid gap-6 xl:grid-cols-[1.2fr_1.8fr]">
        <Card
          title="恢复状态"
          description="近期操作与当前任务"
        >
          {restoreLoading ? (
            <p className="text-sm text-muted-foreground">加载恢复状态中…</p>
          ) : (
            <div className="space-y-4 text-sm">
              <div className="flex items-center justify-between rounded-lg border border-slate-800 bg-background/60 px-3 py-3">
                <span className="text-muted-foreground">当前状态</span>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    statusBadge[restoreStatus?.lastRestoreStatus ?? 'idle'] ?? statusBadge.idle
                  }`}
                >
                  {restoreStatus?.lastRestoreStatus ?? 'idle'}
                </span>
              </div>

              <div className="grid gap-3">
                <StatusRow
                  icon={Clock}
                  label="开始时间"
                  value={formatDateTime(restoreStatus?.restoreStartedAt)}
                />
                <StatusRow
                  icon={CheckCircle2}
                  label="完成时间"
                  value={formatDateTime(restoreStatus?.restoreCompletedAt)}
                />
                <StatusRow
                  icon={History}
                  label="目标快照"
                  value={restoreStatus?.lastRestoreId ?? '—'}
                />
                <StatusRow
                  icon={AlarmClock}
                  label="应用语句"
                  value={
                    restoreStatus?.restoreStatementsApplied != null
                      ? `${restoreStatus.restoreStatementsApplied} 条`
                      : '—'
                  }
                />
              </div>

              <RestoreStepper
                phase={(restoreStatus?.restorePhase as RestorePhase) ?? 'idle'}
                running={restoreStatus?.running ?? false}
                progress={restoreStatus?.restoreProgress ?? 0}
                total={restoreStatus?.restoreTotalStatements ?? null}
              />

              {restoreStatus?.lastRestoreError && (
                <div className="flex items-start gap-2 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-100">
                  <ShieldAlert className="mt-0.5 h-4 w-4 flex-none" />
                  <span>{restoreStatus.lastRestoreError}</span>
                </div>
              )}

              {restoreStatus?.running && (
                <p className="flex items-center gap-2 text-xs text-amber-200">
                  <Loader2 className="h-4 w-4 animate-spin" /> 正在进行恢复任务，请耐心等待。
                </p>
              )}
            </div>
          )}
        </Card>

        <Card
          title="时间轴快照"
          description="选择一个时间点并启动恢复"
        >
          {historyLoading && <p className="text-sm text-muted-foreground">加载备份历史中…</p>}

          {!historyLoading && !sortedHistory.length && (
            <div className="flex flex-col items-center gap-3 py-24 text-muted-foreground">
              <History className="h-10 w-10" />
              暂无可用快照，先执行一次备份吧。
            </div>
          )}

          {!historyLoading && sortedHistory.length > 0 && (
            <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
              <div className="relative h-[420px] overflow-hidden rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900/60 via-slate-900 to-slate-900/60 p-6">
                <div className="absolute left-8 top-10 bottom-10 w-px bg-slate-700/60" />
                <div className="absolute inset-y-10 left-[1.2rem] right-4 overflow-y-auto pr-2">
                  <div className="space-y-3">
                    {enhancedHistory.map((entry, index) => {
                      const isActive = index === selectedIndex
                      const sizeRatio = Math.max((entry.size_bytes ?? 0) / maxTimelineSize, 0)
                      const barWidth = `${Math.max(sizeRatio * 100, 6)}%`
                      return (
                        <button
                          type="button"
                          key={entry.id}
                          onClick={() => handleSelectSnapshot(index)}
                          className={`group flex w-full flex-col gap-2 rounded-xl border border-transparent px-4 py-3 text-left transition ${
                            isActive
                              ? 'border-accent/60 bg-accent/10 text-accent'
                              : 'text-slate-300 hover:border-accent/30 hover:bg-accent/5 hover:text-accent'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <span
                              className={`mt-2 h-3 w-3 flex-none rounded-full transition ${
                                isActive ? 'bg-accent shadow-[0_0_0_4px_rgba(94,234,212,0.25)]' : 'bg-slate-600'
                              }`}
                            />
                            <div className="flex-1 space-y-2">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="text-sm font-semibold">{formatRelativeTime(entry.started_at)}</p>
                                  <p className="text-xs text-muted-foreground">{formatDateTime(entry.started_at)}</p>
                                </div>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                  <span>{formatFileSize(entry.size_bytes)}</span>
                                  {entry.node_count != null && (
                                    <span>节点 {formatNumber(entry.node_count)}</span>
                                  )}
                                </div>
                              </div>
                              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                <span
                                  className={`rounded-full border border-current px-2 py-0.5 ${
                                    entry.deltaNodes && entry.deltaNodes !== 0
                                      ? entry.deltaNodes > 0
                                        ? 'text-emerald-300'
                                        : 'text-rose-300'
                                      : 'text-muted-foreground'
                                  }`}
                                >
                                  Δ节点 {formatDelta(entry.deltaNodes)}
                                </span>
                                <span
                                  className={`rounded-full border border-current px-2 py-0.5 ${
                                    entry.deltaRelationships && entry.deltaRelationships !== 0
                                      ? entry.deltaRelationships > 0
                                        ? 'text-emerald-300'
                                        : 'text-rose-300'
                                      : 'text-muted-foreground'
                                  }`}
                                >
                                  Δ关系 {formatDelta(entry.deltaRelationships)}
                                </span>
                              </div>
                              <div className="h-1 rounded-full bg-accent/20">
                                <div className="h-full rounded-full bg-accent" style={{ width: barWidth }} />
                              </div>
                              <span className="text-xs text-muted-foreground">
                                {entry.status === 'completed' ? '可恢复' : entry.status}
                              </span>
                            </div>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>

              <div className="flex h-full flex-col justify-between gap-4">
                <div className="space-y-4 rounded-2xl border border-slate-800 bg-background/60 p-5">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-slate-100">快照详情</h3>
                    <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">
                      {selectedSnapshot?.status ?? '—'}
                    </span>
                  </div>

                  {selectedSnapshot ? (
                    <div className="space-y-3 text-sm">
                      <DetailRow label="备份时间" value={formatDateTime(selectedSnapshot.started_at)} />
                      <DetailRow label="完成时间" value={formatDateTime(selectedSnapshot.completed_at)} />
                      <DetailRow label="对象大小" value={formatFileSize(selectedSnapshot.size_bytes)} />
                      <DetailRow label="备份 Key" value={selectedSnapshot.id} isMono />
                      <div className="grid gap-3 sm:grid-cols-2">
                        <MetricPill
                          label="节点总数"
                          value={formatNumber(selectedSnapshot.node_count ?? null)}
                          delta={formatDelta(selectedSnapshot.deltaNodes)}
                        />
                        <MetricPill
                          label="关系数量"
                          value={formatNumber(selectedSnapshot.relationship_count ?? null)}
                          delta={formatDelta(selectedSnapshot.deltaRelationships)}
                        />
                        <MetricPill
                          label="文件大小"
                          value={formatFileSize(selectedSnapshot.size_bytes)}
                          delta={formatDeltaSize(selectedSnapshot.deltaSize)}
                        />
                        <MetricPill
                          label="距上次备份"
                          value={formatTimeGap(selectedSnapshot, previousSnapshot)}
                        />
                      </div>
                      {selectedSnapshot.labelsList.length > 0 && (
                        <div className="space-y-2">
                          <span className="text-xs uppercase tracking-wide text-muted-foreground">主要标签</span>
                          <div className="flex flex-wrap gap-2">
                            {selectedSnapshot.labelsList.map((label) => (
                              <span
                                key={label}
                                className="rounded-full bg-accent/10 px-2 py-1 text-xs text-accent"
                              >
                                {label}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {(labelDiff.added.length > 0 || labelDiff.removed.length > 0) && (
                        <div className="space-y-3">
                          <span className="text-xs uppercase tracking-wide text-muted-foreground">
                            与上一快照对比
                          </span>
                          <div className="grid gap-3 sm:grid-cols-2">
                            <LabelDiffCard title="新增标签" tone="positive" items={labelDiff.added} />
                            <LabelDiffCard title="移除标签" tone="negative" items={labelDiff.removed} />
                          </div>
                        </div>
                      )}
                      {selectedSnapshot.details && (
                        <DetailRow label="说明" value={selectedSnapshot.details} />
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">请选择左侧时间轴中的快照。</p>
                  )}
                </div>

                <Button
                  className="w-full justify-center gap-2"
                  onClick={() => selectedSnapshot && handleRestore(selectedSnapshot)}
                  disabled={!selectedSnapshot || selectedSnapshot.status !== 'completed' || isBusy}
                >
                  {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Undo2 className="h-4 w-4" />}
                  {isBusy ? '恢复任务运行中…' : '恢复到此时间点'}
                </Button>
                <p className="text-xs text-muted-foreground">
                  恢复操作会清空当前数据库，并按快照执行所有 Cypher 语句。请确保在低峰时段进行。
                </p>
              </div>
            </div>
          )}
        </Card>
      </section>
    </div>
  )
}

const formatDelta = (value: number | null | undefined) => {
  if (value == null) return '—'
  if (value === 0) return '0'
  return value > 0 ? `+${value}` : `${value}`
}

const formatDeltaSize = (value: number | null | undefined) => {
  if (value == null) return '—'
  if (value === 0) return '0'
  return value > 0 ? `+${formatFileSize(value)}` : `-${formatFileSize(Math.abs(value))}`
}

const formatTimeGap = (current?: TimelineSnapshot | null, previous?: TimelineSnapshot | null) => {
  if (!current || !previous) return '—'
  const currentDate = new Date(current.started_at)
  const previousDate = new Date(previous.started_at)
  const diffMs = Math.abs(currentDate.getTime() - previousDate.getTime())
  const diffMinutes = Math.floor(diffMs / 60000)
  if (diffMinutes < 60) {
    return `${diffMinutes} 分钟`
  }
  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) {
    const remainingMinutes = diffMinutes % 60
    return remainingMinutes > 0 ? `${diffHours} 小时 ${remainingMinutes} 分` : `${diffHours} 小时`
  }
  const diffDays = Math.floor(diffHours / 24)
  const remainingHours = diffHours % 24
  return remainingHours > 0 ? `${diffDays} 天 ${remainingHours} 小时` : `${diffDays} 天`
}

const MetricPill = ({
  label,
  value,
  delta,
}: {
  label: string
  value: string
  delta?: string
}) => (
  <div className="flex flex-col gap-1 rounded-xl border border-slate-800 bg-background/80 px-3 py-2 text-sm">
    <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
    <div className="flex items-center justify-between gap-2 text-slate-100">
      <span className="font-semibold">{value ?? '—'}</span>
      {delta && delta !== '—' && delta !== '0' && (
        <span className={`text-xs ${delta.startsWith('+') ? 'text-emerald-300' : 'text-rose-300'}`}>{delta}</span>
      )}
    </div>
  </div>
)

const RestoreStepper = ({
  phase,
  running,
  progress,
  total,
}: {
  phase: RestorePhase
  running: boolean
  progress: number
  total: number | null
}) => {
  const currentIndex = PHASE_INDEX[phase] ?? -1
  const percent = total && total > 0 ? Math.min(100, Math.round((progress / total) * 100)) : null

  return (
    <div className="space-y-3 text-xs">
      <div className="flex flex-col gap-2">
        {RESTORE_STEPS.map((step, index) => {
          const Icon = step.icon
          const state = index < currentIndex ? 'done' : index === currentIndex ? 'active' : 'pending'
          return (
            <div
              key={step.key}
              className={`flex items-start gap-3 rounded-lg border px-3 py-2 transition ${
                state === 'done'
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
                  : state === 'active'
                    ? 'border-accent/40 bg-accent/10 text-accent'
                    : 'border-slate-800 bg-background/60 text-muted-foreground'
              }`}
            >
              <Icon className={`mt-0.5 h-4 w-4 ${state === 'pending' ? 'opacity-60' : ''}`} />
              <div>
                <p className="font-semibold text-xs">{step.label}</p>
                <p className="text-[11px] opacity-70">{step.description}</p>
              </div>
            </div>
          )
        })}
      </div>
      {running && percent !== null && (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>执行进度</span>
            <span>
              {progress}/{total}（{percent}%）
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-slate-800">
            <div
              className="h-full rounded-full bg-accent transition-all"
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>
      )}
    </div>
  )
}

const LabelDiffCard = ({
  title,
  items,
  tone,
}: {
  title: string
  items: string[]
  tone: 'positive' | 'negative'
}) => (
  <div
    className={`flex min-h-[110px] flex-col gap-2 rounded-xl border px-3 py-2 text-xs ${
      tone === 'positive'
        ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-200'
        : 'border-rose-500/30 bg-rose-500/5 text-rose-200'
    }`}
  >
    <span className="font-semibold">{title}</span>
    {items.length > 0 ? (
      <div className="flex flex-wrap gap-2">
        {items.map((label) => (
          <span key={label} className="rounded-full border border-current px-2 py-0.5 text-[11px]">
            {label}
          </span>
        ))}
        {items.length >= 8 && <span className="opacity-70">…</span>}
      </div>
    ) : (
      <span className="opacity-70">无变化</span>
    )}
  </div>
)

const DetailRow = ({
  label,
  value,
  isMono = false,
}: {
  label: string
  value: string | null | undefined
  isMono?: boolean
}) => (
  <div className="flex flex-col gap-1 rounded-lg bg-background/80 px-3 py-2 text-sm">
    <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
    <span className={isMono ? 'font-mono text-xs text-slate-300 break-all' : 'text-slate-200'}>{value ?? '—'}</span>
  </div>
)

const StatusRow = ({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Clock
  label: string
  value: string | null | undefined
}) => (
  <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 bg-background/50 px-3 py-2 text-xs text-slate-200">
    <span className="flex items-center gap-2 text-muted-foreground">
      <Icon className="h-4 w-4 text-accent" />
      {label}
    </span>
    <span className="text-right text-slate-200">{value ?? '—'}</span>
  </div>
)

const RefreshIndicator = ({ spinning }: { spinning: boolean }) => (
  <span className="flex items-center gap-2">
    <Loader2 className={`h-4 w-4 ${spinning ? 'animate-spin text-accent' : 'text-muted-foreground'}`} />
    <span>刷新</span>
  </span>
)

export default RestoreTimeline
