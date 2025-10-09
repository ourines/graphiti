import { useMemo } from 'react'
import clsx from 'clsx'

import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'

type GraphControlsProps = {
  groups: string[]
  selectedGroup: string | null
  onGroupChange: (groupId: string) => void
  searchQuery: string
  onSearchChange: (value: string) => void
  minPriority: number | null
  onMinPriorityChange: (value: number | null) => void
  isRefreshing?: boolean
  onRefresh?: () => void
  sampleSize: number
  maxSampleSize: number
  minSampleSize: number
  onIncreaseSample: () => void
  onDecreaseSample: () => void
}

const PRIORITY_OPTIONS = [
  { label: 'All priorities', value: null },
  { label: 'Priority ≥ 2', value: 2 },
  { label: 'Priority ≥ 4', value: 4 },
  { label: 'Priority ≥ 6', value: 6 },
  { label: 'Priority ≥ 8', value: 8 },
]

const GraphControls = ({
  groups,
  selectedGroup,
  onGroupChange,
  searchQuery,
  onSearchChange,
  minPriority,
  onMinPriorityChange,
  isRefreshing,
  onRefresh,
  sampleSize,
  maxSampleSize,
  minSampleSize,
  onIncreaseSample,
  onDecreaseSample,
}: GraphControlsProps) => {
  const clampedSample = useMemo(() => {
    if (maxSampleSize <= 0) return 0
    return Math.min(sampleSize, maxSampleSize)
  }, [sampleSize, maxSampleSize])

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-slate-800 bg-surface/80 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-1 flex-col gap-2">
          <label className="text-xs uppercase tracking-wide text-muted-foreground">Group</label>
          <select
            value={selectedGroup ?? ''}
            onChange={(event) => onGroupChange(event.target.value)}
            className="h-10 w-full rounded-lg border border-slate-800 bg-background px-3 text-sm text-slate-100 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/50"
          >
            <option value="" disabled>
              Select a group
            </option>
            {groups.map((groupId) => (
              <option key={groupId} value={groupId}>
                {groupId}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-1 flex-col gap-2">
          <label className="text-xs uppercase tracking-wide text-muted-foreground">Search</label>
          <Input
            placeholder="Search facts, entities, tags…"
            value={searchQuery}
            onChange={(event) => onSearchChange(event.target.value)}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {PRIORITY_OPTIONS.map((option) => (
            <button
              key={String(option.value)}
              onClick={() => onMinPriorityChange(option.value)}
              className={clsx(
                'rounded-full bg-muted/40 px-3 py-1 text-xs transition hover:bg-muted/70',
                option.value === minPriority && 'bg-accent/20 text-accent',
              )}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <div className="rounded-lg border border-slate-800 bg-background/50 px-3 py-2 text-xs text-muted-foreground">
            当前节点加载：
            <span className="ml-1 font-semibold text-slate-100">
              {clampedSample} / {maxSampleSize > 0 ? maxSampleSize : '—'}
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onDecreaseSample}
            disabled={sampleSize <= minSampleSize}
          >
            缩小
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={onIncreaseSample}
            disabled={sampleSize >= maxSampleSize}
          >
            加载更多
          </Button>
          <Button variant="secondary" size="sm" onClick={onRefresh} disabled={isRefreshing}>
            {isRefreshing ? 'Refreshing…' : 'Refresh'}
          </Button>
        </div>
      </div>
    </div>
  )
}

export default GraphControls
