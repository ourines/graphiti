import { memo, useMemo } from 'react'
import { ArrowRight, BadgeCheck, Gauge, Info, Network, Tags } from 'lucide-react'

import type { FactResult } from '@/api/types'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import { formatDateTime, formatNumber, formatRelativeTime } from '@/utils/formatters'
import { useGraphEntities } from '@/hooks/useGraph'
import { useGraphStore } from '@/store/graphStore'

type NodeSelection = {
  id: string
  label: string
  category: 'entity' | 'fact'
  priority?: number
  attributes?: Record<string, unknown>
}

type NodeDetailsProps = {
  selection: NodeSelection | null
  relatedFacts: FactResult[]
  isLoading?: boolean
  onClose?: () => void
}

const NodeDetails = ({ selection, relatedFacts, isLoading, onClose }: NodeDetailsProps) => {
  const selectedGroupId = useGraphStore((state) => state.selectedGroupId)
  const { data: entitiesData } = useGraphEntities(selectedGroupId ?? undefined)

  const dedupedRelationships = useMemo(() => {
    if (!selection) return []
    const factId = selection.attributes?.factId as string | undefined
    const factDetails = selection.category === 'fact' && factId ? relatedFacts.find((fact) => fact.uuid === factId) : null
    const entityRelationships = selection.category === 'entity' ? relatedFacts : factDetails ? [factDetails] : []

    const seen = new Set<string>()
    const results: FactResult[] = []
    entityRelationships.forEach((fact) => {
      const key = fact?.uuid ?? fact.fact
      if (!seen.has(key)) {
        seen.add(key)
        results.push(fact)
      }
    })
    return results
  }, [selection, relatedFacts])

  if (!selection) {
    return (
      <Card title="节点详情" className="h-full min-h-[320px]">
        <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
          <Info className="h-10 w-10" />
          选择图谱中的任意节点查看详情
        </div>
      </Card>
    )
  }

  const { category, label, priority, attributes } = selection
  const isEntity = category === 'entity'

  return (
    <Card
      title={label}
      description={isEntity ? '实体概览与关联事实' : '事实详情'}
      actions={
        onClose ? (
          <Button variant="ghost" size="sm" onClick={onClose}>
            关闭
          </Button>
        ) : null
      }
      className="h-full min-h-[320px] space-y-4"
    >
      <header className="space-y-2 text-xs text-muted-foreground">
        <div className="flex flex-wrap items-center gap-3">
          <BadgeCheck className="h-4 w-4 text-accent" />
          <span>优先级：{priority ?? '未知'}</span>
          {attributes?.groupId && (
            <>
              <ArrowRight className="h-3 w-3 opacity-50" />
              <span>组：{String(attributes.groupId)}</span>
            </>
          )}
          {entitiesData?.entities && (
            <>
              <ArrowRight className="h-3 w-3 opacity-50" />
              <span>采样实体：{formatNumber(entitiesData.entities.length)}</span>
            </>
          )}
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <InsightPill icon={Gauge} label="关联数量" value={formatNumber(dedupedRelationships.length)} />
          <InsightPill icon={Network} label="关系类型" value={String(attributes?.relationshipType ?? '—')} />
        </div>
      </header>

      {isLoading && <p className="text-sm text-muted-foreground">正在加载关联关系…</p>}

      {!isLoading && dedupedRelationships.length === 0 && (
        <p className="text-sm text-muted-foreground">当前节点暂无关联关系。</p>
      )}

      <div className="space-y-3">
        {dedupedRelationships.map((fact) => (
          <div key={fact.uuid} className="rounded-lg border border-slate-800 bg-background/60 p-4 text-sm">
            <p className="font-semibold text-slate-100">{fact.fact}</p>
            <p className="text-xs text-muted-foreground">
              创建于 {formatRelativeTime(fact.created_at)}（{formatDateTime(fact.created_at)}）
            </p>
            {fact.tags?.length > 0 && (
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <Tags className="h-3 w-3" />
                {fact.tags.slice(0, 6).map((tag) => (
                  <span key={tag} className="rounded-full bg-accent/10 px-2 py-1 text-xs text-accent">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </Card>
  )
}

const InsightPill = ({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Gauge
  label: string
  value: string
}) => (
  <div className="flex items-center gap-2 rounded-lg border border-slate-800 bg-background/70 px-3 py-2 text-xs text-slate-200">
    <Icon className="h-4 w-4 text-accent" />
    <div className="flex flex-col">
      <span className="opacity-70">{label}</span>
      <span className="text-sm font-semibold text-slate-100">{value}</span>
    </div>
  </div>
)

export default memo(NodeDetails)
