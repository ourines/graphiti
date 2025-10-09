import { memo } from 'react'
import { BadgeCheck, Info, Tags } from 'lucide-react'

import type { FactResult } from '@/api/types'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import { formatDateTime, formatRelativeTime } from '@/utils/formatters'

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
  if (!selection) {
    return (
      <Card title="Node details" className="h-full min-h-[320px]">
        <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
          <Info className="h-10 w-10" />
          Select a node to inspect its relationships
        </div>
      </Card>
    )
  }

  const { category, label, priority } = selection
  const factId = selection.attributes?.factId as string | undefined

  const factDetails = category === 'fact' && factId ? relatedFacts.find((fact) => fact.uuid === factId) : null
  const entityRelationships = category === 'entity' ? relatedFacts : factDetails ? [factDetails] : []

  return (
    <Card
      title={label}
      description={category === 'entity' ? 'Entity overview and related facts' : 'Fact details'}
      actions={
        onClose ? (
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        ) : null
      }
      className="h-full min-h-[320px]"
    >
      {priority !== undefined && (
        <div className="flex items-center gap-2 text-sm text-accent">
          <BadgeCheck className="h-4 w-4" /> Priority {priority}
        </div>
      )}

      {isLoading && (
        <p className="text-sm text-muted-foreground">Loading relationships…</p>
      )}

      {!isLoading && entityRelationships.length === 0 && (
        <p className="text-sm text-muted-foreground">No relationships found for this node.</p>
      )}

      <div className="space-y-4">
        {entityRelationships.map((fact) => (
          <div key={fact.uuid} className="rounded-lg border border-slate-800 bg-background/60 p-4">
            <div className="flex flex-col gap-2">
              <div className="text-sm font-semibold text-slate-100">{fact.fact}</div>
              <div className="text-xs text-muted-foreground">
                Created {formatRelativeTime(fact.created_at)} ({formatDateTime(fact.created_at)})
              </div>
              {fact.tags?.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <Tags className="h-3 w-3" />
                  {fact.tags.slice(0, 6).map((tag) => (
                    <span key={tag} className="rounded-full bg-accent/10 px-2 py-1 text-xs text-accent">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}

export default memo(NodeDetails)
