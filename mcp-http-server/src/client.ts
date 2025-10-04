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
