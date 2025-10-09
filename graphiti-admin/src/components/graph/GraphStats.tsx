import type { GraphStats } from '@/api/types'
import Card from '@/components/ui/Card'
import { formatDateTime } from '@/utils/formatters'

type GraphStatsProps = {
  stats: GraphStats | undefined
  isLoading?: boolean
}

const Stat = ({ label, value }: { label: string; value: string | number }) => (
  <div className="flex flex-col gap-1 rounded-lg border border-slate-800 bg-background/50 p-3">
    <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
    <span className="text-lg font-semibold text-slate-100">{value}</span>
  </div>
)

const GraphStatsPanel = ({ stats, isLoading }: GraphStatsProps) => {
  return (
    <Card
      title="Graph insights"
      description="High-level metrics for the selected group"
      className="h-full"
    >
      {isLoading && <p className="text-sm text-muted-foreground">Loading stats…</p>}

      {!isLoading && stats && (
        <div className="grid grid-cols-2 gap-3">
          <Stat label="Entities" value={stats.total_entities} />
          <Stat label="Facts" value={stats.total_facts} />
          <Stat label="Episodes" value={stats.total_episodes} />
          <Stat label="Communities" value={stats.total_communities} />
          <Stat label="Oldest" value={formatDateTime(stats.oldest_memory)} />
          <Stat label="Newest" value={formatDateTime(stats.newest_memory)} />
        </div>
      )}

      {!isLoading && !stats && <p className="text-sm text-muted-foreground">No stats available.</p>}
    </Card>
  )
}

export default GraphStatsPanel
