import type { Attributes } from 'graphology-types'
import { MultiDirectedGraph } from 'graphology'

import type { FactResult, GraphEntity, GraphPayload } from '@/api/types'

const GROUP_COLORS = ['#38bdf8', '#a855f7', '#22d3ee', '#f97316', '#facc15', '#34d399']
const FACT_COLOR = '#94a3b8'

const getColorByIndex = (index: number) => GROUP_COLORS[index % GROUP_COLORS.length]

export const factsToGraphPayload = (facts: FactResult[]): GraphPayload => {
  const nodesMap = new Map<
    string,
    {
      label: string
      groupId?: string
      color?: string
      size?: number
      category: 'entity' | 'fact'
      priority?: number
      factId?: string
    }
  >()
  const edges: GraphPayload['edges'] = []
  const groupMap = new Map<string, number>()

  facts.forEach((fact) => {
    const groupIndex = groupMap.get(fact.source_group_id) ?? groupMap.size
    groupMap.set(fact.source_group_id, groupIndex)
    const groupColor = getColorByIndex(groupIndex)

    const entityNodeId = `entity:${fact.source_group_id}:${fact.name}`
    const factNodeId = `fact:${fact.uuid}`

    if (!nodesMap.has(entityNodeId)) {
      nodesMap.set(entityNodeId, {
        label: fact.name,
        groupId: fact.source_group_id,
        color: groupColor,
        size: 16,
        category: 'entity',
      })
    }

    nodesMap.set(factNodeId, {
      label: fact.fact,
      groupId: fact.source_group_id,
      color: FACT_COLOR,
      size: Math.max(8, Math.min(18, fact.priority * 1.5 + 8)),
      category: 'fact',
      priority: fact.priority,
      factId: fact.uuid,
    })

    edges.push({
      id: `edge:${fact.uuid}`,
      source: entityNodeId,
      target: factNodeId,
      label: fact.fact,
      color: groupColor,
    })
  })

  const nodes: GraphPayload['nodes'] = Array.from(nodesMap.entries()).map(([id, value]) => ({
    id,
    label: value.label,
    groupId: value.groupId,
    color: value.color,
    size: value.size ?? 12,
    category: value.category,
    priority: value.priority,
    factId: value.factId,
  }))

  return { nodes, edges }
}

export const graphPayloadToGraphology = (payload: GraphPayload) => {
  const graph = new MultiDirectedGraph()

  payload.nodes.forEach((node) => {
    if (!graph.hasNode(node.id)) {
      const attributes: Attributes = {
        label: node.label,
        color: node.color,
        size: node.size ?? 12,
        groupId: node.groupId,
        category: node.category,
        priority: node.priority,
        factId: node.factId,
      }
      graph.addNode(node.id, attributes)
    }
  })

  payload.edges.forEach((edge) => {
    if (!graph.hasEdge(edge.id)) {
      graph.addEdgeWithKey(edge.id, edge.source, edge.target, {
        label: edge.label,
        color: edge.color,
      })
    }
  })

  return graph
}

export const entitiesToGraphPayload = (entities: GraphEntity[]): GraphPayload => {
  const nodes = entities.map((entity) => ({
    id: `entity:${entity.uuid}`,
    label: entity.name,
    groupId: entity.group_id,
    color: getColorByIndex(Math.abs(hashCode(entity.group_id)) % GROUP_COLORS.length),
    size: 12,
    category: 'entity' as const,
  }))

  return { nodes, edges: [] }
}

const hashCode = (input: string) => {
  let hash = 0
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(i)
    hash |= 0
  }
  return hash
}
