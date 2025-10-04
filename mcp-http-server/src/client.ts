import type { GraphitiConfig, Logger } from './config.js';

/**
 * Interface for add memory parameters
 */
export interface AddMemoryParams {
  name: string;
  content: string;
  group_id: string;
  role?: string;
  source_description?: string;
  uuid?: string;
}

/**
 * Interface for search memory parameters
 */
export interface SearchMemoryParams {
  query: string;
  group_ids: string[];
  max_facts?: number;
  start_time?: string;
  end_time?: string;
  // 🆕 Multi-project enhancement fields
  priority_group_id?: string; // Prioritize results from this group
  min_priority?: number; // Filter by minimum priority (0-10)
  tags?: string[]; // Filter by tags
}

/**
 * Interface for get episodes parameters
 */
export interface GetEpisodesParams {
  group_id: string;
  last_n?: number;
}

/**
 * GraphiTi FastAPI Client
 * Handles all HTTP requests to the GraphiTi backend
 */
export class GraphitiClient {
  private baseUrl: string;
  private headers: Record<string, string>;
  private timeout: number;

  constructor(
    config: GraphitiConfig,
    private logger: Logger
  ) {
    this.baseUrl = config.apiUrl.replace(/\/$/, ''); // Remove trailing slash
    this.headers = config.apiHeaders;
    this.timeout = config.requestTimeout;
  }

  /**
   * Generic fetch wrapper with error handling and retry logic
   */
  private async fetch<T>(
    path: string,
    options: RequestInit = {},
    retryCount = 0
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const maxRetries = 3;

    this.logger.debug(`API Request: ${options.method || 'GET'} ${url}`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...this.headers,
          ...options.headers,
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();

        // Sanitize error message for production
        let errorDetails = errorText;
        if (process.env.NODE_ENV === 'production') {
          // Truncate to prevent stack trace leakage
          errorDetails = errorText.substring(0, 200);
          if (errorText.length > 200) {
            errorDetails += '... (truncated)';
          }
        }

        this.logger.error(`API Error (${response.status}):`, errorDetails);

        // Don't retry on 4xx client errors
        if (response.status >= 400 && response.status < 500) {
          throw new Error(`GraphiTi API Error (${response.status}): ${errorDetails}`);
        }

        // Retry on 5xx server errors
        if (retryCount < maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, retryCount), 10000);
          this.logger.warn(`Retrying after ${delay}ms (attempt ${retryCount + 1}/${maxRetries})`);
          await new Promise((resolve) => setTimeout(resolve, delay));
          return this.fetch<T>(path, options, retryCount + 1);
        }

        throw new Error(`GraphiTi API Error (${response.status}): ${errorDetails}`);
      }

      const data = (await response.json()) as T;
      this.logger.debug(`API Response received`);
      return data;
    } catch (error) {
      clearTimeout(timeoutId);

      // AbortController is cleaned up by garbage collector automatically
      // No explicit cleanup needed here

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new Error(`Request timeout after ${this.timeout}ms`);
        }

        // Retry on network errors
        if (
          retryCount < maxRetries &&
          (error.message.includes('fetch') || error.message.includes('network'))
        ) {
          const delay = Math.min(1000 * Math.pow(2, retryCount), 10000);
          this.logger.warn(`Network error, retrying after ${delay}ms (attempt ${retryCount + 1}/${maxRetries})`);
          await new Promise((resolve) => setTimeout(resolve, delay));
          return this.fetch<T>(path, options, retryCount + 1);
        }

        throw error;
      }

      throw new Error(`Unknown error: ${String(error)}`);
    }
  }

  /**
   * Add memory to the graph
   * POST /messages
   */
  async addMemory(params: AddMemoryParams): Promise<{ message: string; success: boolean }> {
    this.logger.info(`Adding memory: ${params.name}`);

    // Generate UUID if not provided for better traceability
    const messageUuid = params.uuid || crypto.randomUUID();

    return this.fetch('/messages', {
      method: 'POST',
      body: JSON.stringify({
        group_id: params.group_id,
        messages: [
          {
            uuid: messageUuid,
            name: params.name,
            content: params.content,
            role: params.role || 'user',
            role_type: 'user',
            timestamp: new Date().toISOString(),
            source_description: params.source_description || '',
          },
        ],
      }),
    });
  }

  /**
   * Search memory for relevant facts
   * POST /search
   */
  async searchMemory(params: SearchMemoryParams): Promise<{
    facts: Array<{
      uuid: string;
      fact: string;
      valid_at: string;
      invalid_at: string | null;
      // 🆕 Multi-project enhancement fields
      source_group_id?: string;
      relevance_score?: number;
      tags?: string[];
      priority?: number;
    }>;
  }> {
    this.logger.info(`Searching memory: ${params.query}`);

    const body: any = {
      query: params.query,
      group_ids: params.group_ids,
      max_facts: params.max_facts || 10,
    };

    if (params.start_time) {
      body.start_time = params.start_time;
    }
    if (params.end_time) {
      body.end_time = params.end_time;
    }
    // 🆕 Multi-project enhancement parameters
    if (params.priority_group_id) {
      body.priority_group_id = params.priority_group_id;
    }
    if (params.min_priority !== undefined) {
      body.min_priority = params.min_priority;
    }
    if (params.tags && params.tags.length > 0) {
      body.tags = params.tags;
    }

    return this.fetch('/search', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  /**
   * Get recent episodes for a group
   * GET /episodes/{group_id}
   */
  async getEpisodes(params: GetEpisodesParams): Promise<
    Array<{
      uuid: string;
      name: string;
      content: string;
      created_at: string;
    }>
  > {
    const lastN = params.last_n || 10;
    this.logger.info(`Getting last ${lastN} episodes for group: ${params.group_id}`);

    return this.fetch(`/episodes/${params.group_id}?last_n=${lastN}`, {
      method: 'GET',
    });
  }

  /**
   * Delete an episode
   * DELETE /episode/{uuid}
   */
  async deleteEpisode(uuid: string): Promise<{ message: string; success: boolean }> {
    this.logger.info(`Deleting episode: ${uuid}`);

    return this.fetch(`/episode/${uuid}`, {
      method: 'DELETE',
    });
  }

  /**
   * Clear all data from the graph
   * POST /clear
   */
  async clearGraph(): Promise<{ message: string; success: boolean }> {
    this.logger.warn('Clearing entire graph!');

    return this.fetch('/clear', {
      method: 'POST',
    });
  }

  /**
   * Get queue processing status
   * GET /queue/status
   */
  async getQueueStatus(): Promise<{
    queue_size: number;
    current_job: {
      job_id: string;
      job_type: string;
      started_at: string;
      completed_at: string | null;
      status: string;
      error: string | null;
      retry_count: number;
    } | null;
    recent_jobs: Array<{
      job_id: string;
      job_type: string;
      started_at: string;
      completed_at: string | null;
      status: string;
      error: string | null;
      retry_count: number;
    }>;
  }> {
    this.logger.info('Getting queue status');

    return this.fetch('/queue/status', {
      method: 'GET',
    });
  }

  /**
   * Delete a specific group and all its associated data
   * DELETE /group/{group_id}
   */
  async deleteGroup(groupId: string): Promise<{ message: string; success: boolean }> {
    this.logger.warn(`Deleting entire group: ${groupId}`);

    return this.fetch(`/group/${groupId}`, {
      method: 'DELETE',
    });
  }

  /**
   * Delete a specific fact (entity edge)
   * DELETE /entity-edge/{uuid}
   */
  async deleteFact(uuid: string): Promise<{ message: string; success: boolean }> {
    this.logger.info(`Deleting fact: ${uuid}`);

    return this.fetch(`/entity-edge/${uuid}`, {
      method: 'DELETE',
    });
  }

  /**
   * Get detailed information about a specific fact
   * GET /entity-edge/{uuid}
   */
  async getFactDetails(uuid: string): Promise<{
    uuid: string;
    fact: string;
    valid_at: string;
    invalid_at: string | null;
    [key: string]: any;
  }> {
    this.logger.info(`Getting fact details: ${uuid}`);

    return this.fetch(`/entity-edge/${uuid}`, {
      method: 'GET',
    });
  }

  /**
   * Update an existing fact/edge
   * PUT /fact/{uuid}
   */
  async updateFact(params: {
    uuid: string;
    fact?: string;
    valid_at?: string;
    invalid_at?: string;
    tags?: string[];
    priority?: number;
    metadata?: Record<string, any>;
  }): Promise<{
    uuid: string;
    updated_fields: string[];
    message: string;
  }> {
    this.logger.info(`Updating fact: ${params.uuid}`);

    const { uuid, ...updateData } = params;

    return this.fetch(`/fact/${uuid}`, {
      method: 'PUT',
      body: JSON.stringify(updateData),
    });
  }

  /**
   * Update an existing entity
   * PUT /entity/{uuid}
   */
  async updateEntity(params: {
    uuid: string;
    name?: string;
    summary?: string;
    tags?: string[];
    priority?: number;
    metadata?: Record<string, any>;
  }): Promise<{
    uuid: string;
    updated_fields: string[];
    message: string;
  }> {
    this.logger.info(`Updating entity: ${params.uuid}`);

    const { uuid, ...updateData } = params;

    return this.fetch(`/entity/${uuid}`, {
      method: 'PUT',
      body: JSON.stringify(updateData),
    });
  }

  /**
   * Batch add memories
   * POST /messages with multiple messages
   */
  async batchAddMemories(
    groupId: string,
    memories: Array<{
      name: string;
      content: string;
      timestamp: string;
      role?: string;
      source_description?: string;
    }>
  ): Promise<{
    message: string;
    job_ids: string[];
    queue_size: number;
  }> {
    this.logger.info(`Batch adding ${memories.length} memories to group: ${groupId}`);

    const messages = memories.map((memory) => ({
      uuid: crypto.randomUUID(),
      name: memory.name,
      content: memory.content,
      role: memory.role || 'user',
      role_type: 'user',
      timestamp: memory.timestamp,
      source_description: memory.source_description || 'Batch import',
    }));

    return this.fetch('/messages', {
      method: 'POST',
      body: JSON.stringify({
        group_id: groupId,
        messages,
      }),
    });
  }

  /**
   * Find duplicate entities
   * GET /duplicates/{group_id}
   */
  async findDuplicateEntities(
    groupId: string,
    similarityThreshold?: number,
    limit?: number
  ): Promise<{
    group_id: string;
    similarity_threshold: number;
    total_duplicates: number;
    duplicates: Array<{
      entities: Array<{
        uuid: string;
        name: string;
        summary?: string;
      }>;
      similarity: number;
    }>;
  }> {
    this.logger.info(`Finding duplicate entities in group: ${groupId}`);

    const params = new URLSearchParams();
    if (similarityThreshold !== undefined) {
      params.append('similarity_threshold', similarityThreshold.toString());
    }
    if (limit !== undefined) {
      params.append('limit', limit.toString());
    }

    const queryString = params.toString() ? `?${params.toString()}` : '';

    return this.fetch(`/duplicates/${groupId}${queryString}`, {
      method: 'GET',
    });
  }

  /**
   * List all group_ids in the knowledge graph
   * GET /groups
   */
  async listGroups(): Promise<{ group_ids: string[] }> {
    this.logger.info('Listing all groups');

    return this.fetch('/groups', {
      method: 'GET',
    });
  }

  /**
   * Get entities for a specific group
   * GET /entities/{group_id}
   */
  async getEntities(groupId: string, limit?: number): Promise<{
    group_id: string;
    count: number;
    limit: number;
    entities: Array<{
      uuid: string;
      name: string;
      group_id: string;
      summary: string | null;
      created_at: string | null;
    }>;
  }> {
    this.logger.info(`Getting entities for group: ${groupId}`);

    const queryParams = limit ? `?limit=${limit}` : '';
    return this.fetch(`/entities/${groupId}${queryParams}`, {
      method: 'GET',
    });
  }

  /**
   * Get all relationships for a specific entity
   * GET /entities/{uuid}/relationships
   */
  async getEntityRelationships(uuid: string): Promise<{
    entity_uuid: string;
    relationship_count: number;
    relationships: Array<{
      uuid: string;
      fact: string;
      valid_at: string;
      invalid_at: string | null;
    }>;
  }> {
    this.logger.info(`Getting relationships for entity: ${uuid}`);

    return this.fetch(`/entities/${uuid}/relationships`, {
      method: 'GET',
    });
  }

  /**
   * Get statistics for a specific group's knowledge graph
   * GET /stats/{group_id}
   */
  async getGraphStats(groupId: string): Promise<{
    group_id: string;
    total_episodes: number;
    total_entities: number;
    total_facts: number;
    total_communities: number;
    oldest_memory: string | null;
    newest_memory: string | null;
  }> {
    this.logger.info(`Getting graph stats for group: ${groupId}`);

    return this.fetch(`/stats/${groupId}`, {
      method: 'GET',
    });
  }

  /**
   * Find relationship path between two entities (up to N hops)
   * POST /find-path
   */
  async findRelationshipPath(params: {
    source_entity: string;
    target_entity?: string;
    max_depth?: number;
    group_ids?: string[];
  }): Promise<{
    paths: Array<
      Array<{
        uuid?: string;
        name?: string;
        type: 'node' | 'relationship';
        group_id?: string;
        fact?: string;
        relation_type?: string;
      }>
    >;
    total_paths: number;
  }> {
    this.logger.info(`Finding relationship path from ${params.source_entity}`);

    return this.fetch('/relationships/find-path', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source_entity: params.source_entity,
        target_entity: params.target_entity,
        max_depth: params.max_depth ?? 2,
        group_ids: params.group_ids,
      }),
    });
  }

  /**
   * Get all neighbors of an entity within N hops
   * GET /entity/{uuid}/neighbors
   */
  async getEntityNeighbors(
    uuid: string,
    depth: number = 1
  ): Promise<{
    source_uuid: string;
    neighbors: Array<{
      uuid: string;
      name: string;
      group_id: string;
      distance: number;
    }>;
    total: number;
  }> {
    this.logger.info(`Getting neighbors for entity ${uuid} within ${depth} hops`);

    return this.fetch(`/relationships/entity/${uuid}/neighbors?depth=${depth}`, {
      method: 'GET',
    });
  }

  /**
   * Merge two entities into one
   * POST /relationships/merge
   */
  async mergeEntities(
    sourceUuid: string,
    targetUuid: string
  ): Promise<{ message: string; success: boolean }> {
    this.logger.info(`Merging entity ${sourceUuid} into ${targetUuid}`);

    return this.fetch('/relationships/merge', {
      method: 'POST',
      body: JSON.stringify({
        source_uuid: sourceUuid,
        target_uuid: targetUuid,
      }),
    });
  }

  /**
   * Batch delete multiple nodes (entities, episodes, facts)
   * POST /ingest/batch-delete
   */
  async batchDelete(uuids: string[]): Promise<{ message: string; success: boolean }> {
    this.logger.info(`Batch deleting ${uuids.length} nodes`);

    return this.fetch('/ingest/batch-delete', {
      method: 'POST',
      body: JSON.stringify({ uuids }),
    });
  }

  /**
   * List all unique tags/labels in the knowledge graph
   * GET /tags
   */
  async listTags(groupId?: string): Promise<{
    tags: string[];
    count: number;
    entity_tags: string[];
    message: string;
  }> {
    const queryParams = groupId ? `?group_id=${encodeURIComponent(groupId)}` : '';
    this.logger.info(`Listing tags${groupId ? ` for group ${groupId}` : ''}`);

    return this.fetch(`/tags${queryParams}`, {
      method: 'GET',
    });
  }

  /**
   * Rename a tag across all entities
   * POST /tags/rename
   */
  async renameTag(
    oldTag: string,
    newTag: string,
    groupId?: string
  ): Promise<{ message: string; success: boolean }> {
    this.logger.info(`Renaming tag "${oldTag}" to "${newTag}"${groupId ? ` in group ${groupId}` : ''}`);

    return this.fetch('/tags/rename', {
      method: 'POST',
      body: JSON.stringify({
        old_tag: oldTag,
        new_tag: newTag,
        group_id: groupId,
      }),
    });
  }

  /**
   * Health check - verify API is reachable
   */
  async healthCheck(): Promise<{ healthy: boolean; error?: string; latency?: number }> {
    const startTime = Date.now();

    try {
      await this.fetch('/healthcheck', { method: 'GET' }, 0); // No retries for health check
      const latency = Date.now() - startTime;
      return { healthy: true, latency };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error('Health check failed:', errorMessage);
      return { healthy: false, error: errorMessage };
    }
  }
}
