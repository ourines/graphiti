import type {
  FactResult,
  GraphEntitiesResponse,
  GraphStats,
  GroupResponse,
  SearchPayload,
  SearchResults,
} from './types'
import { graphitiClient } from './client'

export const fetchGroups = async (): Promise<GroupResponse> => {
  const response = await graphitiClient.get<GroupResponse>('/groups')
  return response.data
}

export const fetchGraphStats = async (groupId: string): Promise<GraphStats> => {
  const response = await graphitiClient.get<GraphStats>(`/stats/${groupId}`)
  return response.data
}

export const fetchEntities = async (
  groupId: string,
  limit = 100,
): Promise<GraphEntitiesResponse> => {
  const response = await graphitiClient.get<GraphEntitiesResponse>(`/entities/${groupId}`, {
    params: { limit },
  })
  return response.data
}

export const fetchEntityRelationships = async (uuid: string) => {
  const response = await graphitiClient.get<{
    entity_uuid: string
    relationship_count: number
    relationships: FactResult[]
  }>(`/entities/${uuid}/relationships`)
  return response.data
}

export const searchFacts = async (payload: SearchPayload): Promise<SearchResults> => {
  const response = await graphitiClient.post<SearchResults>('/search', payload)
  return response.data
}

export const fetchDuplicateEntities = async (
  groupId: string,
  similarityThreshold = 0.85,
  limit = 50,
) => {
  const response = await graphitiClient.get<{
    group_id: string
    duplicates: Array<{
      similarity: number
      entities: Array<{
        uuid: string
        name: string
        summary?: string
        group_id: string
      }>
    }>
  }>(`/duplicates/${groupId}`, {
    params: {
      similarity_threshold: similarityThreshold,
      limit,
    },
  })
  return response.data
}
