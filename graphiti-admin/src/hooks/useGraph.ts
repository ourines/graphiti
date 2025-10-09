import { useQuery } from '@tanstack/react-query'

import {
  fetchDuplicateEntities,
  fetchEntities,
  fetchEntityRelationships,
  fetchGraphStats,
  fetchGroups,
  searchFacts,
} from '@/api/graphiti'
import type { SearchPayload } from '@/api/types'

export const useGraphGroups = () =>
  useQuery({
    queryKey: ['graph', 'groups'],
    queryFn: fetchGroups,
    staleTime: 1000 * 60 * 5,
  })

export const useGraphStats = (groupId: string | undefined) =>
  useQuery({
    queryKey: ['graph', 'stats', groupId],
    queryFn: () => fetchGraphStats(groupId as string),
    enabled: Boolean(groupId),
    staleTime: 1000 * 60,
  })

export const useGraphEntities = (groupId: string | undefined, limit = 100) =>
  useQuery({
    queryKey: ['graph', 'entities', groupId, limit],
    queryFn: () => fetchEntities(groupId as string, limit),
    enabled: Boolean(groupId),
    staleTime: 1000 * 30,
  })

export const useEntityRelationships = (uuid: string | undefined) =>
  useQuery({
    queryKey: ['graph', 'relationships', uuid],
    queryFn: () => fetchEntityRelationships(uuid as string),
    enabled: Boolean(uuid),
  })

export const useSearchFacts = (payload: SearchPayload | null, enabled = true) =>
  useQuery({
    queryKey: ['graph', 'search', payload],
    queryFn: () => searchFacts(payload as SearchPayload),
    enabled: Boolean(payload) && enabled,
  })

export const useDuplicateEntities = (
  groupId: string | undefined,
  similarityThreshold = 0.85,
  limit = 50,
) =>
  useQuery({
    queryKey: ['graph', 'duplicates', groupId, similarityThreshold, limit],
    queryFn: () => fetchDuplicateEntities(groupId as string, similarityThreshold, limit),
    enabled: Boolean(groupId),
  })
