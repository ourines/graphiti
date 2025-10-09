import { useEffect, useMemo, useState } from 'react'

import type { FactResult } from '@/api/types'
import GraphControls from '@/components/graph/GraphControls'
import GraphStats from '@/components/graph/GraphStats'
import GraphVisualization from '@/components/graph/GraphVisualization'
import NodeDetails from '@/components/graph/NodeDetails'
import { useGraphEntities, useGraphGroups, useGraphStats, useSearchFacts, useEntityRelationships } from '@/hooks/useGraph'
import useDebounce from '@/hooks/useDebounce'
import { useGraphStore } from '@/store/graphStore'
import type { GraphSelectedNode } from '@/store/graphStore'
import { entitiesToGraphPayload, factsToGraphPayload } from '@/utils/graphUtils'
import { fetchEntityRelationships } from '@/api/graphiti'

const GraphView = () => {
  const { data: groupsData, isLoading: groupsLoading } = useGraphGroups()
  const {
    selectedGroupId,
    setSelectedGroupId,
    searchQuery,
    setSearchQuery,
    minPriority,
    setMinPriority,
    selectedNode,
    setSelectedNode,
  } = useGraphStore()
  const [refreshToken, setRefreshToken] = useState(0)
  const [aggregatedFacts, setAggregatedFacts] = useState<FactResult[]>([])
  const [isAggregating, setIsAggregating] = useState(false)
  const [entitySampleSize, setEntitySampleSize] = useState(20)

  const debouncedSearch = useDebounce(searchQuery, 400)

  useEffect(() => {
    if (groupsData?.group_ids?.length && !selectedGroupId) {
      setSelectedGroupId(groupsData.group_ids[0])
    }
  }, [groupsData, selectedGroupId, setSelectedGroupId])

  const { data: stats, isLoading: statsLoading } = useGraphStats(selectedGroupId ?? undefined)
  const { data: entitiesData, isLoading: entitiesLoading } = useGraphEntities(selectedGroupId ?? undefined, 200)

  const maxEntities = entitiesData?.entities?.length ?? 0
  const sampleStep = 20
  const minSampleSize = maxEntities > 0 ? Math.min(sampleStep, maxEntities) : sampleStep

  useEffect(() => {
    if (maxEntities > 0) {
      setEntitySampleSize((value) => {
        if (value > maxEntities) return maxEntities
        if (value < minSampleSize) return minSampleSize
        return value
      })
    }
  }, [maxEntities, minSampleSize])

  useEffect(() => {
    if (!selectedGroupId || !entitiesData?.entities) {
      setAggregatedFacts([])
      return
    }

    let isCancelled = false
    const loadRelationships = async () => {
      setIsAggregating(true)
      try {
        const subset = entitiesData.entities.slice(0, entitySampleSize)
        const results = await Promise.all(
          subset.map(async (entity) => {
            try {
              const response = await fetchEntityRelationships(entity.uuid)
              return response.relationships
            } catch (error) {
              console.warn('Failed to load relationships for entity', entity.uuid, error)
              return []
            }
          }),
        )
        if (!isCancelled) {
          setAggregatedFacts(results.flat())
        }
      } finally {
        if (!isCancelled) {
          setIsAggregating(false)
        }
      }
    }

    loadRelationships()

    return () => {
      isCancelled = true
    }
  }, [entitiesData, selectedGroupId, refreshToken, entitySampleSize])

  const shouldTriggerSearch = debouncedSearch.trim().length >= 2 || minPriority !== null
  const searchPayload = useMemo(() => {
    if (!selectedGroupId || !shouldTriggerSearch) return null

    return {
      query: debouncedSearch.trim().length >= 2 ? debouncedSearch.trim() : '*',
      group_ids: [selectedGroupId],
      max_facts: 200,
      min_priority: minPriority ?? undefined,
    }
  }, [selectedGroupId, shouldTriggerSearch, debouncedSearch, minPriority])

  const { data: searchResults, isFetching: isSearching } = useSearchFacts(searchPayload, Boolean(searchPayload))

  const entitiesByName = useMemo(() => {
    const map = new Map<string, { uuid: string; group_id: string }>()
    entitiesData?.entities.forEach((entity) => {
      map.set(entity.name, { uuid: entity.uuid, group_id: entity.group_id })
    })
    return map
  }, [entitiesData])

  const baseFacts = useMemo(() => {
    const source = searchResults?.facts?.length ? searchResults.facts : aggregatedFacts
    if (!source.length) return []

    return source.filter((fact) => {
      const matchesPriority = minPriority === null || fact.priority >= (minPriority ?? 0)
      const matchesSearch =
        debouncedSearch.trim().length < 2 ||
        fact.fact.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        fact.name.toLowerCase().includes(debouncedSearch.toLowerCase())
      return matchesPriority && matchesSearch
    })
  }, [searchResults, aggregatedFacts, minPriority, debouncedSearch])

  const graphPayload = useMemo(() => {
    if (baseFacts.length) {
      return factsToGraphPayload(baseFacts)
    }
    if (entitiesData?.entities?.length) {
      return entitiesToGraphPayload(entitiesData.entities)
    }
    return { nodes: [], edges: [] }
  }, [baseFacts, entitiesData])

  const selectedEntity = useMemo(() => {
    if (!selectedNode || selectedNode.category !== 'entity') return null
    return entitiesByName.get(selectedNode.label) ?? null
  }, [entitiesByName, selectedNode])

  const { data: selectedRelationships, isFetching: relationshipsLoading } = useEntityRelationships(
    selectedEntity?.uuid,
  )

  const relatedFacts = useMemo(() => {
    if (!selectedNode) return []
    if (selectedNode.category === 'fact') {
      const factId = selectedNode.attributes?.factId as string | undefined
      const fact = factId ? baseFacts.find((item) => item.uuid === factId) : null
      return fact ? [fact] : []
    }

    const relationships = selectedRelationships?.relationships
    if (relationships?.length) {
      return relationships
    }

    return baseFacts.filter((fact) => fact.name === selectedNode.label)
  }, [selectedNode, baseFacts, selectedRelationships])

  const handleNodeSelect = (nodeId: string, attributes: Record<string, unknown>) => {
    const category = (attributes.category as GraphSelectedNode['category']) ??
      (nodeId.startsWith('fact:') ? 'fact' : 'entity')

    setSelectedNode({
      id: nodeId,
      label: String(attributes.label ?? nodeId),
      category,
      priority: attributes.priority as number | undefined,
      attributes,
    })
  }

  const resetSelection = () => setSelectedNode(null)

  const isLoadingGraph =
    groupsLoading ||
    statsLoading ||
    entitiesLoading ||
    isSearching ||
    isAggregating

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[2.2fr_0.8fr]">
      <div className="space-y-4">
        <GraphControls
          groups={groupsData?.group_ids ?? []}
          selectedGroup={selectedGroupId}
          onGroupChange={(groupId) => {
            setSelectedGroupId(groupId)
            setRefreshToken((value) => value + 1)
            setSelectedNode(null)
            setEntitySampleSize(sampleStep)
          }}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          minPriority={minPriority}
          onMinPriorityChange={setMinPriority}
          isRefreshing={isAggregating}
          onRefresh={() => setRefreshToken((value) => value + 1)}
          sampleSize={entitySampleSize}
          maxSampleSize={maxEntities}
          minSampleSize={minSampleSize}
          onIncreaseSample={() =>
            setEntitySampleSize((value) => {
              if (!maxEntities) {
                return value + sampleStep
              }
              return Math.min(value + sampleStep, maxEntities)
            })
          }
          onDecreaseSample={() => setEntitySampleSize((value) => Math.max(minSampleSize, value - sampleStep))}
        />

        <GraphVisualization
          payload={graphPayload}
          isLoading={isLoadingGraph}
          onNodeSelect={handleNodeSelect}
          selectedNodeId={selectedNode?.id ?? null}
        />

        <GraphStats stats={stats} isLoading={statsLoading} />
      </div>

      <NodeDetails
        selection={selectedNode}
        relatedFacts={relatedFacts}
        isLoading={relationshipsLoading}
        onClose={resetSelection}
      />
    </div>
  )
}

export default GraphView
