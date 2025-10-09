export interface GroupResponse {
  group_ids: string[]
}

export interface GraphEntity {
  uuid: string
  name: string
  group_id: string
  summary?: string | null
  created_at?: string | null
  priority?: number | null
  tags?: string[]
}

export interface GraphEntitiesResponse {
  group_id: string
  count: number
  limit: number
  entities: GraphEntity[]
}

export interface GraphStats {
  group_id: string
  total_episodes: number
  total_entities: number
  total_facts: number
  total_communities: number
  oldest_memory: string | null
  newest_memory: string | null
}

export interface FactResult {
  uuid: string
  name: string
  fact: string
  valid_at: string | null
  invalid_at: string | null
  created_at: string
  expired_at: string | null
  source_group_id: string
  relevance_score: number | null
  tags: string[]
  priority: number
}

export interface SearchResults {
  facts: FactResult[]
}

export interface SearchPayload {
  query: string
  group_ids?: string[]
  priority_group_id?: string
  max_facts?: number
  start_time?: string
  end_time?: string
  min_priority?: number
  tags?: string[]
}

export interface GraphNodeData {
  id: string
  label: string
  groupId?: string
  color?: string
  size?: number
  category?: 'entity' | 'fact'
  priority?: number
  factId?: string
}

export interface GraphEdgeData {
  id: string
  source: string
  target: string
  label?: string
  color?: string
}

export interface GraphPayload {
  nodes: GraphNodeData[]
  edges: GraphEdgeData[]
}

export interface BackupSettingsPayload {
  enabled: boolean
  cron: string
  retentionDays: number
  lastRunAt?: string | null
  nextRunAt?: string | null
  lastStatus?: string | null
  lastBackupId?: string | null
  lastError?: string | null
}

export interface BackupHistoryEntry {
  id: string
  status: 'completed' | 'running' | 'failed' | 'deleted'
  started_at: string
  completed_at: string | null
  size_bytes: number | null
  download_url?: string | null
  details?: string | null
}

export interface ManualBackupRequest {
  description?: string
}

export interface BackupTriggerResponse {
  backup_id: string
  status: 'queued' | 'running'
}

export interface BackupServiceStatus {
  running: boolean
  job_id?: string | null
  settings: BackupSettingsPayload
}
