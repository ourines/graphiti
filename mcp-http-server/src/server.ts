import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { Hono, type Context } from 'hono';
import { type HttpBindings } from '@hono/node-server';
import * as http from 'http';
import { type IncomingMessage, type ServerResponse } from 'http';
import { randomUUID } from 'crypto';
import type { GraphitiConfig, Logger } from './config.js';
import { MCP_CONSTANTS } from './config.js';
import { GraphitiClient } from './client.js';
import { TOOLS, type ToolInputs } from './tools.js';
import { ContextManager } from './context-manager.js';
import { RateLimiter } from './rate-limiter.js';

/**
 * Union type for all possible tool results
 */
type ToolResult =
  | { message: string; success: boolean }
  | {
      facts: Array<{
        uuid: string;
        fact: string;
        valid_at: string;
        invalid_at: string | null;
      }>;
    }
  | Array<{
      uuid: string;
      name: string;
      content: string;
      created_at: string;
    }>
  | {
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
    }
  | {
      [key: string]: any;
      uuid: string;
      fact: string;
      valid_at: string;
      invalid_at: string | null;
    }
  | { group_ids: string[] }
  | {
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
    }
  | {
      entity_uuid: string;
      relationship_count: number;
      relationships: Array<{
        uuid: string;
        fact: string;
        valid_at: string;
        invalid_at: string | null;
      }>;
    }
  | {
      group_id: string;
      total_episodes: number;
      total_entities: number;
      total_facts: number;
      total_communities: number;
      oldest_memory: string | null;
      newest_memory: string | null;
    }
  | {
      message: string;
      success: boolean;
      currentContext: string | null;
      recentGroups: string[];
    }
  | {
      currentGroupId: string | null;
      recentGroupIds: string[];
      lastUpdated: Date | null;
      message: string;
    }
  | {
      paths: Array<Array<{
        uuid?: string;
        name?: string;
        type: 'node' | 'relationship';
        group_id?: string;
        fact?: string;
        relation_type?: string;
      }>>;
      total_paths: number;
    }
  | {
      source_uuid: string;
      neighbors: Array<{
        uuid: string;
        name: string;
        group_id: string;
        distance: number;
      }>;
      total: number;
    }
  | {
      uuid: string;
      updated_fields: string[];
      message: string;
    }
  | {
      message: string;
      job_ids: string[];
      queue_size: number;
    }
  | {
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
    }
  | {
      tags: string[];
      count: number;
      entity_tags: string[];
      message: string;
    };

/**
 * Type guards for tool inputs validation
 */
function isAddMemoryParams(args: unknown): args is ToolInputs['add_memory'] {
  const a = args as Record<string, unknown>;
  return (
    typeof a === 'object' &&
    a !== null &&
    typeof a.name === 'string' &&
    a.name.length > 0 &&
    a.name.length <= 500 &&
    typeof a.content === 'string' &&
    a.content.length > 0 &&
    a.content.length <= 50000 &&
    typeof a.group_id === 'string' &&
    a.group_id.length > 0 &&
    a.group_id.length <= 255 &&
    (a.role === undefined || typeof a.role === 'string') &&
    (a.source_description === undefined || typeof a.source_description === 'string')
  );
}

function isSearchMemoryParams(args: unknown): args is ToolInputs['search_memory'] {
  const a = args as Record<string, unknown>;
  return (
    typeof a === 'object' &&
    a !== null &&
    typeof a.query === 'string' &&
    a.query.length > 0 &&
    Array.isArray(a.group_ids) &&
    a.group_ids.length > 0 &&
    a.group_ids.every((id) => typeof id === 'string') &&
    (a.max_facts === undefined ||
      (typeof a.max_facts === 'number' && a.max_facts > 0 && a.max_facts <= 100)) &&
    (a.start_time === undefined || typeof a.start_time === 'string') &&
    (a.end_time === undefined || typeof a.end_time === 'string') &&
    (a.priority_group_id === undefined ||
      (typeof a.priority_group_id === 'string' && a.priority_group_id.length > 0)) &&
    (a.min_priority === undefined ||
      (typeof a.min_priority === 'number' && a.min_priority >= 0 && a.min_priority <= 10)) &&
    (a.tags === undefined ||
      (Array.isArray(a.tags) && a.tags.every((tag) => typeof tag === 'string')))
  );
}

function isGetEpisodesParams(args: unknown): args is ToolInputs['get_episodes'] {
  const a = args as Record<string, unknown>;
  return (
    typeof a === 'object' &&
    a !== null &&
    typeof a.group_id === 'string' &&
    a.group_id.length > 0 &&
    (a.last_n === undefined ||
      (typeof a.last_n === 'number' && a.last_n > 0 && a.last_n <= 100))
  );
}

function isDeleteEpisodeParams(args: unknown): args is ToolInputs['delete_episode'] {
  const a = args as Record<string, unknown>;
  return (
    typeof a === 'object' &&
    a !== null &&
    typeof a.uuid === 'string' &&
    a.uuid.length > 0
  );
}

function isClearGraphParams(args: unknown): args is ToolInputs['clear_graph'] {
  return typeof args === 'object' && args !== null;
}

function isGetQueueStatusParams(args: unknown): args is ToolInputs['get_queue_status'] {
  return typeof args === 'object' && args !== null;
}

function isDeleteGroupParams(args: unknown): args is ToolInputs['delete_group'] {
  const a = args as Record<string, unknown>;
  return (
    typeof a === 'object' &&
    a !== null &&
    typeof a.group_id === 'string' &&
    a.group_id.length > 0
  );
}

function isDeleteFactParams(args: unknown): args is ToolInputs['delete_fact'] {
  const a = args as Record<string, unknown>;
  return (
    typeof a === 'object' &&
    a !== null &&
    typeof a.uuid === 'string' &&
    a.uuid.length > 0
  );
}

function isGetFactDetailsParams(args: unknown): args is ToolInputs['get_fact_details'] {
  const a = args as Record<string, unknown>;
  return (
    typeof a === 'object' &&
    a !== null &&
    typeof a.uuid === 'string' &&
    a.uuid.length > 0
  );
}

function isListGroupsParams(args: unknown): args is ToolInputs['list_groups'] {
  return typeof args === 'object' && args !== null;
}

function isGetEntitiesParams(args: unknown): args is ToolInputs['get_entities'] {
  const a = args as Record<string, unknown>;
  return (
    typeof a === 'object' &&
    a !== null &&
    typeof a.group_id === 'string' &&
    a.group_id.length > 0 &&
    (a.limit === undefined || (typeof a.limit === 'number' && a.limit > 0 && a.limit <= 200))
  );
}

function isGetEntityRelationshipsParams(args: unknown): args is ToolInputs['get_entity_relationships'] {
  const a = args as Record<string, unknown>;
  return (
    typeof a === 'object' &&
    a !== null &&
    typeof a.uuid === 'string' &&
    a.uuid.length > 0
  );
}

function isGetGraphStatsParams(args: unknown): args is ToolInputs['get_graph_stats'] {
  const a = args as Record<string, unknown>;
  return (
    typeof a === 'object' &&
    a !== null &&
    typeof a.group_id === 'string' &&
    a.group_id.length > 0
  );
}

function isFindRelationshipPathParams(args: unknown): args is ToolInputs['find_relationship_path'] {
  const a = args as Record<string, unknown>;
  return (
    typeof a === 'object' &&
    a !== null &&
    typeof a.source_entity === 'string' &&
    a.source_entity.length > 0 &&
    (a.target_entity === undefined || typeof a.target_entity === 'string') &&
    (a.max_depth === undefined || typeof a.max_depth === 'number') &&
    (a.group_ids === undefined || Array.isArray(a.group_ids))
  );
}

function isGetEntityNeighborsParams(args: unknown): args is ToolInputs['get_entity_neighbors'] {
  const a = args as Record<string, unknown>;
  return (
    typeof a === 'object' &&
    a !== null &&
    typeof a.uuid === 'string' &&
    a.uuid.length > 0 &&
    (a.depth === undefined || typeof a.depth === 'number')
  );
}

function isSetContextParams(args: unknown): args is ToolInputs['set_context'] {
  const a = args as Record<string, unknown>;
  return (
    typeof a === 'object' &&
    a !== null &&
    typeof a.group_id === 'string' &&
    a.group_id.length > 0
  );
}

function isGetContextParams(args: unknown): args is ToolInputs['get_context'] {
  return typeof args === 'object' && args !== null;
}

function isUpdateFactParams(args: unknown): args is ToolInputs['update_fact'] {
  const a = args as Record<string, unknown>;
  return (
    typeof args === 'object' &&
    args !== null &&
    typeof a.uuid === 'string' &&
    a.uuid.length > 0
  );
}

function isUpdateEntityParams(args: unknown): args is ToolInputs['update_entity'] {
  const a = args as Record<string, unknown>;
  return (
    typeof args === 'object' &&
    args !== null &&
    typeof a.uuid === 'string' &&
    a.uuid.length > 0
  );
}

function isBatchAddMemoriesParams(args: unknown): args is ToolInputs['batch_add_memories'] {
  const a = args as Record<string, unknown>;
  return (
    typeof args === 'object' &&
    args !== null &&
    typeof a.group_id === 'string' &&
    a.group_id.length > 0 &&
    Array.isArray(a.memories)
  );
}

function isFindDuplicateEntitiesParams(
  args: unknown
): args is ToolInputs['find_duplicate_entities'] {
  const a = args as Record<string, unknown>;
  return (
    typeof args === 'object' &&
    args !== null &&
    typeof a.group_id === 'string' &&
    a.group_id.length > 0
  );
}

function isMergeEntitiesParams(args: unknown): args is ToolInputs['merge_entities'] {
  const a = args as Record<string, unknown>;
  return (
    typeof args === 'object' &&
    args !== null &&
    typeof a.source_uuid === 'string' &&
    a.source_uuid.length > 0 &&
    typeof a.target_uuid === 'string' &&
    a.target_uuid.length > 0
  );
}

function isBatchDeleteParams(args: unknown): args is ToolInputs['batch_delete'] {
  const a = args as Record<string, unknown>;
  return (
    typeof args === 'object' &&
    args !== null &&
    Array.isArray(a.uuids) &&
    a.uuids.length > 0 &&
    a.uuids.every((uuid) => typeof uuid === 'string')
  );
}

function isListTagsParams(args: unknown): args is ToolInputs['list_tags'] {
  const a = args as Record<string, unknown>;
  return (
    typeof args === 'object' &&
    args !== null &&
    (a.group_id === undefined || typeof a.group_id === 'string')
  );
}

function isRenameTagParams(args: unknown): args is ToolInputs['rename_tag'] {
  const a = args as Record<string, unknown>;
  return (
    typeof args === 'object' &&
    args !== null &&
    typeof a.old_tag === 'string' &&
    a.old_tag.length > 0 &&
    typeof a.new_tag === 'string' &&
    a.new_tag.length > 0 &&
    (a.group_id === undefined || typeof a.group_id === 'string')
  );
}

/**
 * Custom error for session limit exceeded
 */
class SessionLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SessionLimitError';
  }
}

/**
 * Session state for MCP protocol
 */
interface SessionState {
  server: Server;
  transport: StreamableHTTPServerTransport;
  lastActivity: Date;
  requestToken?: string;
}

/**
 * GraphiTi MCP Server
 * Implements Model Context Protocol for GraphiTi knowledge graph
 */
export class GraphitiMCPServer {
  private server: Server;
  private client: GraphitiClient;
  private logger: Logger;
  private contextManager: ContextManager;
  private requestToken: string | undefined;

  // Session management for HTTP transport
  private sessions: Map<string, SessionState> = new Map();
  private sessionCleanupInterval: NodeJS.Timeout | null = null;

  // Rate limiting
  private rateLimiter: RateLimiter | null = null;
  private rateLimitCleanupInterval: NodeJS.Timeout | null = null;

  // Connection tracking
  private activeRequests = 0;
  private isShuttingDown = false;

  // HTTP server instance
  private httpServer: http.Server | null = null;

  constructor(
    private config: GraphitiConfig,
    logger: Logger
  ) {
    this.logger = logger;
    this.client = new GraphitiClient(config, logger);
    this.contextManager = new ContextManager();

    // Initialize MCP Server (for stdio mode)
    this.server = new Server(
      {
        name: 'graphiti-mcp-http',
        version: '0.1.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupHandlers();

    // Setup session cleanup
    this.sessionCleanupInterval = setInterval(() => {
      this.cleanupInactiveSessions();
    }, config.sessionCleanupInterval);

    // Setup rate limiter if enabled
    if (config.rateLimitEnabled) {
      this.rateLimiter = new RateLimiter(
        config.rateLimitWindow,
        config.rateLimitMaxRequests
      );

      // Cleanup rate limiter data every 5 minutes
      this.rateLimitCleanupInterval = setInterval(() => {
        this.rateLimiter?.cleanup();
      }, 5 * 60 * 1000);

      this.logger.info(`Rate limiting enabled: ${config.rateLimitMaxRequests} requests per ${config.rateLimitWindow / 60000} minutes`);
    }
  }

  /**
   * Cleanup and shutdown server
   */
  async shutdown(): Promise<void> {
    this.logger.info('Shutting down MCP server...');

    // Set shutdown flag to reject new connections
    this.isShuttingDown = true;

    // Stop accepting new connections
    if (this.httpServer) {
      this.httpServer.close(() => {
        this.logger.debug('HTTP server stopped accepting new connections');
      });
    }

    // Clear cleanup intervals
    if (this.sessionCleanupInterval) {
      clearInterval(this.sessionCleanupInterval);
      this.sessionCleanupInterval = null;
    }

    if (this.rateLimitCleanupInterval) {
      clearInterval(this.rateLimitCleanupInterval);
      this.rateLimitCleanupInterval = null;
    }

    // Wait for active requests to complete (with timeout)
    const shutdownStart = Date.now();
    while (this.activeRequests > 0 && Date.now() - shutdownStart < this.config.shutdownTimeout) {
      this.logger.info(`Waiting for ${this.activeRequests} active requests to complete...`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    if (this.activeRequests > 0) {
      this.logger.warn(`Forced shutdown with ${this.activeRequests} active requests remaining`);
    }

    // Close all sessions
    for (const [sessionId, session] of this.sessions.entries()) {
      this.logger.debug(`Closing session: ${sessionId}`);
      try {
        session.transport.close();
        session.server.close();
      } catch (error) {
        this.logger.error(`Error closing session ${sessionId}:`, error);
      }
    }

    this.sessions.clear();
    this.logger.info('MCP server shutdown complete');
  }

  /**
   * Cleanup inactive sessions
   */
  private cleanupInactiveSessions(): void {
    const now = new Date();
    const maxAge = this.config.sessionMaxAge;

    for (const [sessionId, session] of this.sessions.entries()) {
      const age = now.getTime() - session.lastActivity.getTime();
      if (age > maxAge) {
        this.logger.info(`Cleaning up inactive session: ${sessionId} (age: ${Math.round(age / 60000)}min)`);
        try {
          session.transport.close();
          session.server.close();
        } catch (error) {
          this.logger.error(`Error cleaning up session ${sessionId}:`, error);
        }
        this.sessions.delete(sessionId);
      }
    }

    this.logger.debug(`Session cleanup: ${this.sessions.size} active sessions`);
  }

  /**
   * Get or create session for HTTP transport
   */
  private getOrCreateSession(sessionId?: string): {
    sessionId: string;
    session: SessionState;
    isNew: boolean;
  } {
    // Check existing session
    if (sessionId && this.sessions.has(sessionId)) {
      const session = this.sessions.get(sessionId)!;
      session.lastActivity = new Date();
      return { sessionId, session, isNew: false };
    }

    // Check session limit before creating new session
    if (this.sessions.size >= this.config.maxSessions) {
      // Clean up inactive sessions first
      this.cleanupInactiveSessions();

      // If still at limit, reject
      if (this.sessions.size >= this.config.maxSessions) {
        throw new SessionLimitError(
          `Maximum number of sessions (${this.config.maxSessions}) reached. Please try again later or reuse an existing session.`
        );
      }
    }

    // Create new session
    const newSessionId = sessionId || randomUUID();
    const newServer = new Server(
      {
        name: 'graphiti-mcp-http',
        version: '0.1.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    // Setup handlers for new server
    this.setupHandlersForServer(newServer);

    // Create transport
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => newSessionId,
      enableJsonResponse: true,
    });

    const session: SessionState = {
      server: newServer,
      transport,
      lastActivity: new Date(),
    };

    this.sessions.set(newSessionId, session);
    this.logger.debug(`Created new session: ${newSessionId}`);

    return { sessionId: newSessionId, session, isNew: true };
  }

  /**
   * Create a client with per-request token (if provided)
   */
  private getClient(): GraphitiClient {
    if (this.requestToken) {
      // Create temporary config with request token
      const tempConfig = {
        ...this.config,
        apiHeaders: {
          ...this.config.apiHeaders,
          'Authorization': `Bearer ${this.requestToken}`,
        },
      };
      return new GraphitiClient(tempConfig, this.logger);
    }
    return this.client;
  }

  /**
   * Handle a single tool call (extracted for reuse in stateless mode)
   */
  private async handleToolCall(name: string, args: unknown): Promise<{ content: Array<{ type: string; text: string }> }> {
    this.logger.debug(`Arguments received`);

    try {
      let result: ToolResult;

        switch (name) {
          case 'add_memory': {
            if (!isAddMemoryParams(args)) {
              throw new Error(
                'Invalid parameters for add_memory. Required: name (string, max 500), content (string, max 50000), group_id (string, max 255)'
              );
            }
            // Track group usage for auto-context detection
            this.contextManager.trackGroupUsage(args.group_id);

            result = await this.getClient().addMemory({
              name: args.name,
              content: args.content,
              group_id: args.group_id,
              role: args.role,
              source_description: args.source_description,
            });
            break;
          }

          case 'search_memory': {
            if (!isSearchMemoryParams(args)) {
              throw new Error(
                'Invalid parameters for search_memory. Required: query (string), group_ids (array of strings), max_facts (number, max 100, optional), start_time (ISO string, optional), end_time (ISO string, optional), priority_group_id (string, optional), min_priority (number 0-10, optional), tags (array of strings, optional)'
              );
            }

            // Auto-inject current context as priority_group_id if not specified
            const currentContext = this.contextManager.getCurrentContext();
            const priorityGroupId = args.priority_group_id !== undefined
              ? args.priority_group_id
              : (currentContext || undefined);

            if (currentContext && args.priority_group_id === undefined) {
              this.logger.info(`Auto-prioritizing search results from context: ${currentContext}`);
            }

            result = await this.getClient().searchMemory({
              query: args.query,
              group_ids: args.group_ids,
              max_facts: args.max_facts,
              start_time: args.start_time,
              end_time: args.end_time,
              // 🆕 Multi-project enhancement parameters
              priority_group_id: priorityGroupId,
              min_priority: args.min_priority,
              tags: args.tags,
            });
            break;
          }

          case 'get_episodes': {
            if (!isGetEpisodesParams(args)) {
              throw new Error(
                'Invalid parameters for get_episodes. Required: group_id (string), last_n (number, max 100, optional)'
              );
            }
            result = await this.getClient().getEpisodes({
              group_id: args.group_id,
              last_n: args.last_n,
            });
            break;
          }

          case 'delete_episode': {
            if (!isDeleteEpisodeParams(args)) {
              throw new Error('Invalid parameters for delete_episode. Required: uuid (string)');
            }
            result = await this.getClient().deleteEpisode(args.uuid);
            break;
          }

          case 'clear_graph': {
            if (!isClearGraphParams(args)) {
              throw new Error('Invalid parameters for clear_graph');
            }
            result = await this.getClient().clearGraph();
            break;
          }

          case 'get_queue_status': {
            if (!isGetQueueStatusParams(args)) {
              throw new Error('Invalid parameters for get_queue_status');
            }
            result = await this.getClient().getQueueStatus();
            break;
          }

          case 'delete_group': {
            if (!isDeleteGroupParams(args)) {
              throw new Error('Invalid parameters for delete_group. Required: group_id (string)');
            }
            result = await this.getClient().deleteGroup(args.group_id);
            break;
          }

          case 'delete_fact': {
            if (!isDeleteFactParams(args)) {
              throw new Error('Invalid parameters for delete_fact. Required: uuid (string)');
            }
            result = await this.getClient().deleteFact(args.uuid);
            break;
          }

          case 'get_fact_details': {
            if (!isGetFactDetailsParams(args)) {
              throw new Error('Invalid parameters for get_fact_details. Required: uuid (string)');
            }
            result = await this.getClient().getFactDetails(args.uuid);
            break;
          }

          case 'list_groups': {
            if (!isListGroupsParams(args)) {
              throw new Error('Invalid parameters for list_groups');
            }
            result = await this.getClient().listGroups();
            break;
          }

          case 'get_entities': {
            if (!isGetEntitiesParams(args)) {
              throw new Error('Invalid parameters for get_entities. Required: group_id (string), limit (number, max 200, optional)');
            }
            result = await this.getClient().getEntities(args.group_id, args.limit);
            break;
          }

          case 'get_entity_relationships': {
            if (!isGetEntityRelationshipsParams(args)) {
              throw new Error('Invalid parameters for get_entity_relationships. Required: uuid (string)');
            }
            result = await this.getClient().getEntityRelationships(args.uuid);
            break;
          }

          case 'get_graph_stats': {
            if (!isGetGraphStatsParams(args)) {
              throw new Error('Invalid parameters for get_graph_stats. Required: group_id (string)');
            }
            result = await this.getClient().getGraphStats(args.group_id);
            break;
          }

          case 'find_relationship_path': {
            if (!isFindRelationshipPathParams(args)) {
              throw new Error('Invalid parameters for find_relationship_path. Required: source_entity (string), Optional: target_entity (string), max_depth (number), group_ids (string[])');
            }
            result = await this.getClient().findRelationshipPath({
              source_entity: args.source_entity,
              target_entity: args.target_entity,
              max_depth: args.max_depth,
              group_ids: args.group_ids,
            });
            break;
          }

          case 'get_entity_neighbors': {
            if (!isGetEntityNeighborsParams(args)) {
              throw new Error('Invalid parameters for get_entity_neighbors. Required: uuid (string), Optional: depth (number)');
            }
            result = await this.getClient().getEntityNeighbors(args.uuid, args.depth);
            break;
          }

          case 'set_context': {
            if (!isSetContextParams(args)) {
              throw new Error('Invalid parameters for set_context. Required: group_id (string)');
            }
            this.contextManager.setContext(args.group_id);
            result = {
              message: `Context set to group: ${args.group_id}`,
              success: true,
              currentContext: this.contextManager.getCurrentContext(),
              recentGroups: this.contextManager.getRecentGroups(),
            };
            this.logger.info(`Context switched to: ${args.group_id}`);
            break;
          }

          case 'get_context': {
            if (!isGetContextParams(args)) {
              throw new Error('Invalid parameters for get_context');
            }
            const contextState = this.contextManager.getContextState();
            result = {
              ...contextState,
              message: contextState.currentGroupId
                ? `Current context: ${contextState.currentGroupId}`
                : 'No context set',
            };
            break;
          }

          case 'update_fact': {
            if (!isUpdateFactParams(args)) {
              throw new Error('Invalid parameters for update_fact. Required: uuid (string), optional: fact, valid_at, invalid_at, tags, priority, metadata');
            }
            result = await this.getClient().updateFact(args);
            break;
          }

          case 'update_entity': {
            if (!isUpdateEntityParams(args)) {
              throw new Error('Invalid parameters for update_entity. Required: uuid (string), optional: name, summary, tags, priority, metadata');
            }
            result = await this.getClient().updateEntity(args);
            break;
          }

          case 'batch_add_memories': {
            if (!isBatchAddMemoriesParams(args)) {
              throw new Error('Invalid parameters for batch_add_memories. Required: group_id (string), memories (array)');
            }
            result = await this.getClient().batchAddMemories(args.group_id, args.memories);
            break;
          }

          case 'find_duplicate_entities': {
            if (!isFindDuplicateEntitiesParams(args)) {
              throw new Error('Invalid parameters for find_duplicate_entities. Required: group_id (string), optional: similarity_threshold, limit');
            }
            result = await this.getClient().findDuplicateEntities(
              args.group_id,
              args.similarity_threshold,
              args.limit
            );
            break;
          }

          case 'merge_entities': {
            if (!isMergeEntitiesParams(args)) {
              throw new Error('Invalid parameters for merge_entities. Required: source_uuid (string), target_uuid (string)');
            }
            result = await this.getClient().mergeEntities(args.source_uuid, args.target_uuid);
            break;
          }

          case 'batch_delete': {
            if (!isBatchDeleteParams(args)) {
              throw new Error('Invalid parameters for batch_delete. Required: uuids (array of strings, min 1)');
            }
            result = await this.getClient().batchDelete(args.uuids);
            break;
          }

          case 'list_tags': {
            if (!isListTagsParams(args)) {
              throw new Error('Invalid parameters for list_tags. Optional: group_id (string)');
            }
            result = await this.getClient().listTags(args.group_id);
            break;
          }

          case 'rename_tag': {
            if (!isRenameTagParams(args)) {
              throw new Error('Invalid parameters for rename_tag. Required: old_tag (string), new_tag (string), optional: group_id (string)');
            }
            result = await this.getClient().renameTag(args.old_tag, args.new_tag, args.group_id);
            break;
          }

          default:
            throw new Error(`Unknown tool: ${name}`);
        }

      this.logger.debug(`Tool completed successfully`);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      return this.formatError(error, `Tool ${name} failed`);
    }
  }

  /**
   * Setup MCP protocol handlers
   */
  private setupHandlers(): void {
    this.setupHandlersForServer(this.server);
  }

  /**
   * Setup MCP protocol handlers for a specific server instance
   */
  private setupHandlersForServer(server: Server): void {
    // List all available tools
    server.setRequestHandler(ListToolsRequestSchema, async () => {
      this.logger.debug('Listing tools');
      return { tools: TOOLS };
    });

    // Handle tool calls
    server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      this.logger.info(`Tool called: ${name}`);
      return await this.handleToolCall(name, args);
    });
  }

  /**
   * Format error response for MCP protocol
   */
  private formatError(
    error: unknown,
    context: string
  ): {
    content: Array<{ type: string; text: string }>;
    isError: true;
  } {
    const errorMessage = error instanceof Error ? error.message : String(error);
    this.logger.error(`${context}:`, errorMessage);

    return {
      content: [
        {
          type: 'text',
          text: `Error: ${errorMessage}`,
        },
      ],
      isError: true,
    };
  }

  /**
   * Start server in stdio mode (for Claude Desktop integration)
   */
  async startStdio(): Promise<void> {
    this.logger.info('Starting MCP server in stdio mode');

    // Check backend health
    const healthStatus = await this.getClient().healthCheck();
    if (!healthStatus.healthy) {
      this.logger.warn(
        `GraphiTi API at ${this.config.apiUrl} is not responding: ${healthStatus.error}. Some features may not work.`
      );
    } else if (healthStatus.latency) {
      this.logger.info(`GraphiTi API health check passed (${healthStatus.latency}ms)`);
    }

    const transport = new StdioServerTransport();
    await this.server.connect(transport);

    this.logger.info('MCP server running on stdio');
  }

  /**
   * Start server in HTTP mode with Streamable HTTP transport
   */
  async startHTTP(): Promise<void> {
    this.logger.info('Starting MCP server in HTTP mode with Streamable HTTP');

    // Check backend health
    const healthStatus = await this.getClient().healthCheck();
    if (!healthStatus.healthy) {
      this.logger.warn(
        `GraphiTi API at ${this.config.apiUrl} is not responding: ${healthStatus.error}. Some features may not work.`
      );
    } else if (healthStatus.latency) {
      this.logger.info(`GraphiTi API health check passed (${healthStatus.latency}ms)`);
    }

    // Handle MCP request with session management
    const handleMcpRequest = async (req: IncomingMessage, res: ServerResponse) => {
      this.logger.info('New MCP request received');

      // Reject new requests during shutdown
      if (this.isShuttingDown) {
        this.logger.warn('Rejecting request: server is shutting down');
        res.writeHead(503, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          jsonrpc: '2.0',
          error: {
            code: MCP_CONSTANTS.ERROR_CODES.INTERNAL_ERROR,
            message: 'Server is shutting down',
          },
          id: null,
        }));
        return;
      }

      this.activeRequests++;

      try {
        // Extract token from request header (client pass-through)
        const requestToken = req.headers['x-graphiti-token'] as string | undefined;

        // Authentication check
        if (this.config.requireAuth && !requestToken) {
          this.logger.warn('Unauthorized: Missing X-GraphiTi-Token header');
          res.writeHead(401, {
            'Content-Type': 'application/json',
            'WWW-Authenticate': 'Bearer realm="GraphiTi MCP Server"'
          });
          res.end(JSON.stringify({
            jsonrpc: '2.0',
            error: {
              code: MCP_CONSTANTS.ERROR_CODES.UNAUTHORIZED,
              message: 'Unauthorized: X-GraphiTi-Token header is required',
              data: {
                hint: 'Provide your GraphiTi API token via X-GraphiTi-Token header'
              }
            },
            id: null,
          }));
          return;
        }

        this.requestToken = requestToken;

        if (requestToken) {
          this.logger.debug('Using client-provided token');
        }

        // Origin header validation for CSRF protection
        if (this.config.allowedOrigins && this.config.allowedOrigins.length > 0) {
          const origin = req.headers['origin'] as string | undefined;
          const referer = req.headers['referer'] as string | undefined;

          // Check Origin header (preferred for CORS)
          if (origin) {
            const isAllowed = this.config.allowedOrigins.some(allowed => {
              if (allowed === '*') return true;
              return origin === allowed || origin.startsWith(allowed);
            });

            if (!isAllowed) {
              this.logger.warn(`Blocked request from unauthorized origin: ${origin}`);
              res.writeHead(403, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({
                jsonrpc: '2.0',
                error: {
                  code: MCP_CONSTANTS.ERROR_CODES.ORIGIN_NOT_ALLOWED,
                  message: 'Origin not allowed',
                  data: {
                    origin,
                    hint: 'Configure MCP_ALLOWED_ORIGINS to allow this origin'
                  }
                },
                id: null,
              }));
              return;
            }
          }
          // Fallback to Referer header if Origin is not present
          else if (referer) {
            try {
              const refererUrl = new URL(referer);
              const refererOrigin = `${refererUrl.protocol}//${refererUrl.host}`;

              const isAllowed = this.config.allowedOrigins.some(allowed => {
                if (allowed === '*') return true;
                return refererOrigin === allowed || refererOrigin.startsWith(allowed);
              });

              if (!isAllowed) {
                this.logger.warn(`Blocked request from unauthorized referer: ${refererOrigin}`);
                res.writeHead(403, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                  jsonrpc: '2.0',
                  error: {
                    code: MCP_CONSTANTS.ERROR_CODES.ORIGIN_NOT_ALLOWED,
                    message: 'Origin not allowed',
                    data: {
                      origin: refererOrigin,
                      hint: 'Configure MCP_ALLOWED_ORIGINS to allow this origin'
                    }
                  },
                  id: null,
                }));
                return;
              }
            } catch (error) {
              this.logger.warn('Invalid Referer header:', referer);
            }
          }
          // If neither Origin nor Referer is present, log a warning but allow the request
          // (some legitimate clients may not send these headers)
          else {
            this.logger.debug('No Origin or Referer header present in request');
          }
        }

        // Extract session ID from header
        const sessionIdHeader = req.headers['mcp-session-id'] as string | undefined;

        // Rate limiting check
        if (this.config.rateLimitEnabled && this.rateLimiter) {
          const clientIp = req.socket.remoteAddress || 'unknown';
          const rateLimitKey = `${req.headers['mcp-session-id'] || 'no-session'}-${clientIp}`;

          if (!this.rateLimiter.isAllowed(rateLimitKey)) {
            const retryAfter = this.rateLimiter.getRetryAfter(rateLimitKey);
            this.logger.warn(`Rate limit exceeded for ${rateLimitKey}`);
            res.writeHead(429, {
              'Content-Type': 'application/json',
              'Retry-After': retryAfter.toString(),
            });
            res.end(JSON.stringify({
              jsonrpc: '2.0',
              error: {
                code: MCP_CONSTANTS.ERROR_CODES.RATE_LIMIT_EXCEEDED,
                message: 'Rate limit exceeded',
                data: {
                  retryAfter,
                  limit: this.config.rateLimitMaxRequests,
                  window: this.config.rateLimitWindow,
                }
              },
              id: null,
            }));
            return;
          }
        }

        // Normalize Accept header for compatibility
        // MCP requires: "application/json, text/event-stream"
        // But some clients may not send it correctly
        let accept = req.headers['accept'] as string | undefined;
        if (!accept || (!accept.includes('application/json') && !accept.includes('text/event-stream'))) {
          this.logger.debug('Client missing proper Accept header, adding compatibility header');
          // Add Accept header for compatibility
          req.headers['accept'] = 'application/json, text/event-stream';
        }

        // Read request body with size limit
        const chunks: Buffer[] = [];
        let totalSize = 0;

        for await (const chunk of req) {
          totalSize += chunk.length;

          // Check body size limit
          if (totalSize > this.config.maxBodySize) {
            this.logger.warn(`Request body too large: ${totalSize} bytes (max: ${this.config.maxBodySize})`);
            res.writeHead(413, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              jsonrpc: '2.0',
              error: {
                code: MCP_CONSTANTS.ERROR_CODES.REQUEST_TOO_LARGE,
                message: 'Request body too large',
                data: {
                  maxSize: this.config.maxBodySize,
                  receivedSize: totalSize,
                }
              },
              id: null,
            }));
            return;
          }

          chunks.push(chunk);
        }
        const bodyText = Buffer.concat(chunks).toString();

        this.logger.debug(`Body read (${bodyText.length} bytes)`);

        const body = JSON.parse(bodyText);

        // Get or create session
        const { sessionId, session, isNew } = this.getOrCreateSession(sessionIdHeader);

        if (isNew) {
          this.logger.info(`New session created: ${sessionId}`);
          // Connect server to transport
          await session.server.connect(session.transport);
        } else {
          this.logger.debug(`Using existing session: ${sessionId}`);
        }

        // Store token in session
        session.requestToken = requestToken;
        this.requestToken = requestToken;

        this.logger.info('Handling MCP request...');

        // Handle the request (transport writes directly to res)
        await session.transport.handleRequest(req, res, body);

        this.logger.info('handleRequest completed');
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        this.logger.error('MCP request handling error:', errorMessage);

        if (!res.headersSent) {
          // Handle session limit exceeded
          if (error instanceof SessionLimitError) {
            res.writeHead(503, {
              'Content-Type': 'application/json',
              'Retry-After': '60' // Suggest retry after 60 seconds
            });
            res.end(JSON.stringify({
              jsonrpc: '2.0',
              error: {
                code: MCP_CONSTANTS.ERROR_CODES.INTERNAL_ERROR,
                message: 'Service temporarily unavailable: ' + errorMessage,
                data: {
                  reason: 'session_limit_exceeded',
                  retryAfter: 60
                }
              },
              id: null,
            }));
          } else {
            // Generic internal error
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              jsonrpc: '2.0',
              error: {
                code: MCP_CONSTANTS.ERROR_CODES.INTERNAL_ERROR,
                message: errorMessage,
              },
              id: null,
            }));
          }
        }
      } finally {
        this.activeRequests--;
        this.requestToken = undefined;
      }
    };

    // Create Hono app for other endpoints
    const app = new Hono<{ Bindings: HttpBindings }>();

    // Health check endpoint
    app.get('/health', async (c: Context) => {
      const healthStatus = await this.getClient().healthCheck();
      return c.json({
        status: 'ok',
        backend: {
          url: this.config.apiUrl,
          healthy: healthStatus.healthy,
          latency: healthStatus.latency,
          error: healthStatus.error,
        },
        server: {
          transport: 'streamable-http',
          port: this.config.port,
          uptime: process.uptime(),
          activeRequests: this.activeRequests,
          activeSessions: this.sessions.size,
        },
      });
    });

    // Debug endpoint - list tools
    app.get('/debug/tools', (c: Context) => {
      return c.json({
        tools: TOOLS,
      });
    });

    // Debug endpoint - list sessions
    app.get('/debug/sessions', (c: Context) => {
      const sessionsInfo = Array.from(this.sessions.entries()).map(([id, session]) => ({
        sessionId: id,
        lastActivity: session.lastActivity,
        hasToken: !!session.requestToken,
      }));

      return c.json({
        totalSessions: this.sessions.size,
        sessions: sessionsInfo,
      });
    });

    // DELETE endpoint for explicit session termination
    app.delete('/sessions/:sessionId', (c: Context) => {
      const sessionId = c.req.param('sessionId');

      if (!sessionId) {
        return c.json({
          error: 'Session ID is required',
        }, 400);
      }

      const session = this.sessions.get(sessionId);
      if (!session) {
        return c.json({
          error: 'Session not found',
        }, 404);
      }

      // Close the session
      try {
        session.server.close();
      } catch (error) {
        this.logger.warn(`Error closing server for session ${sessionId}:`, error);
      }

      // Remove from sessions map
      this.sessions.delete(sessionId);
      this.logger.info(`Session ${sessionId} explicitly terminated`);

      return c.json({
        message: 'Session terminated successfully',
        sessionId,
      });
    });

    this.logger.info(`MCP HTTP server listening on http://${this.config.host}:${this.config.port}`);
    this.logger.info(`GraphiTi API: ${this.config.apiUrl}`);
    this.logger.info(`Authentication: ${this.config.requireAuth ? 'REQUIRED (X-GraphiTi-Token header)' : 'Optional'}`);
    this.logger.info('Available endpoints:');
    this.logger.info('  POST   /mcp - MCP protocol endpoint (Streamable HTTP)');
    this.logger.info('  GET    /health - Health check');
    this.logger.info('  GET    /debug/tools - List available tools');
    this.logger.info('  GET    /debug/sessions - List active sessions');
    this.logger.info('  DELETE /sessions/:sessionId - Terminate a session');

    // Create HTTP server that routes /mcp to native handler, others to Hono
    this.httpServer = http.createServer(async (req, res) => {
      const url = new URL(req.url || '/', `http://${req.headers.host}`);

      if (url.pathname === '/mcp' && req.method === 'POST') {
        // Handle MCP endpoint natively for direct req/res access
        await handleMcpRequest(req, res);
      } else {
        // Delegate to Hono for other endpoints
        const headers = new Headers();
        for (const [key, value] of Object.entries(req.headers)) {
          if (value) {
            if (Array.isArray(value)) {
              value.forEach(v => headers.append(key, v));
            } else {
              headers.set(key, value);
            }
          }
        }

        // Read body if needed
        let bodyData: Buffer | null = null;
        if (req.method !== 'GET' && req.method !== 'HEAD') {
          const chunks: Buffer[] = [];
          for await (const chunk of req) {
            chunks.push(chunk);
          }
          bodyData = Buffer.concat(chunks);
        }

        const request = new Request(url, {
          method: req.method,
          headers,
          body: bodyData,
        });

        const response = await app.fetch(request);

        res.writeHead(response.status, Object.fromEntries(response.headers.entries()));
        if (response.body) {
          const reader = response.body.getReader();
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            res.write(value);
          }
        }
        res.end();
      }
    });

    // Setup graceful shutdown handlers
    const gracefulShutdown = async (signal: string) => {
      this.logger.info(`${signal} received, starting graceful shutdown...`);
      await this.shutdown();
      process.exit(0);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    this.httpServer.listen(this.config.port, this.config.host);
  }
}
