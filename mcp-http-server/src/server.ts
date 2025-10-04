import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import express from 'express';
import type { GraphitiConfig, Logger } from './config.js';
import { GraphitiClient } from './client.js';
import { TOOLS, type ToolInputs } from './tools.js';

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
    (a.end_time === undefined || typeof a.end_time === 'string')
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

/**
 * GraphiTi MCP Server
 * Implements Model Context Protocol for GraphiTi knowledge graph
 */
export class GraphitiMCPServer {
  private server: Server;
  private client: GraphitiClient;
  private logger: Logger;

  constructor(
    private config: GraphitiConfig,
    logger: Logger
  ) {
    this.logger = logger;
    this.client = new GraphitiClient(config, logger);

    // Initialize MCP Server
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
  }

  /**
   * Setup MCP protocol handlers
   */
  private setupHandlers(): void {
    // List all available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      this.logger.debug('Listing tools');
      return { tools: TOOLS };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      this.logger.info(`Tool called: ${name}`);
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
            result = await this.client.addMemory({
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
                'Invalid parameters for search_memory. Required: query (string), group_ids (array of strings), max_facts (number, max 100, optional), start_time (ISO string, optional), end_time (ISO string, optional)'
              );
            }
            result = await this.client.searchMemory({
              query: args.query,
              group_ids: args.group_ids,
              max_facts: args.max_facts,
              start_time: args.start_time,
              end_time: args.end_time,
            });
            break;
          }

          case 'get_episodes': {
            if (!isGetEpisodesParams(args)) {
              throw new Error(
                'Invalid parameters for get_episodes. Required: group_id (string), last_n (number, max 100, optional)'
              );
            }
            result = await this.client.getEpisodes({
              group_id: args.group_id,
              last_n: args.last_n,
            });
            break;
          }

          case 'delete_episode': {
            if (!isDeleteEpisodeParams(args)) {
              throw new Error('Invalid parameters for delete_episode. Required: uuid (string)');
            }
            result = await this.client.deleteEpisode(args.uuid);
            break;
          }

          case 'clear_graph': {
            if (!isClearGraphParams(args)) {
              throw new Error('Invalid parameters for clear_graph');
            }
            result = await this.client.clearGraph();
            break;
          }

          case 'get_queue_status': {
            if (!isGetQueueStatusParams(args)) {
              throw new Error('Invalid parameters for get_queue_status');
            }
            result = await this.client.getQueueStatus();
            break;
          }

          case 'delete_group': {
            if (!isDeleteGroupParams(args)) {
              throw new Error('Invalid parameters for delete_group. Required: group_id (string)');
            }
            result = await this.client.deleteGroup(args.group_id);
            break;
          }

          case 'delete_fact': {
            if (!isDeleteFactParams(args)) {
              throw new Error('Invalid parameters for delete_fact. Required: uuid (string)');
            }
            result = await this.client.deleteFact(args.uuid);
            break;
          }

          case 'get_fact_details': {
            if (!isGetFactDetailsParams(args)) {
              throw new Error('Invalid parameters for get_fact_details. Required: uuid (string)');
            }
            result = await this.client.getFactDetails(args.uuid);
            break;
          }

          case 'list_groups': {
            if (!isListGroupsParams(args)) {
              throw new Error('Invalid parameters for list_groups');
            }
            result = await this.client.listGroups();
            break;
          }

          case 'get_entities': {
            if (!isGetEntitiesParams(args)) {
              throw new Error('Invalid parameters for get_entities. Required: group_id (string), limit (number, max 200, optional)');
            }
            result = await this.client.getEntities(args.group_id, args.limit);
            break;
          }

          case 'get_entity_relationships': {
            if (!isGetEntityRelationshipsParams(args)) {
              throw new Error('Invalid parameters for get_entity_relationships. Required: uuid (string)');
            }
            result = await this.client.getEntityRelationships(args.uuid);
            break;
          }

          case 'get_graph_stats': {
            if (!isGetGraphStatsParams(args)) {
              throw new Error('Invalid parameters for get_graph_stats. Required: group_id (string)');
            }
            result = await this.client.getGraphStats(args.group_id);
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
    const healthStatus = await this.client.healthCheck();
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
   * Start server in HTTP mode (for debugging and testing)
   */
  async startHTTP(): Promise<void> {
    const app = express();
    app.use(express.json());

    // MCP protocol endpoint
    app.post('/mcp', async (_req, res) => {
      try {
        this.logger.debug('Received MCP request');
        // Note: MCP SDK doesn't expose handleRequest directly in HTTP mode
        // This endpoint is for future implementation or custom handling
        res.status(501).json({
          error: 'MCP over HTTP not implemented - use stdio mode instead',
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        this.logger.error('MCP request error:', errorMessage);
        res.status(500).json({
          error: errorMessage,
        });
      }
    });

    // Health check endpoint
    app.get('/health', async (_req, res) => {
      const healthStatus = await this.client.healthCheck();
      res.json({
        status: 'ok',
        backend: {
          url: this.config.apiUrl,
          healthy: healthStatus.healthy,
          latency: healthStatus.latency,
          error: healthStatus.error,
        },
        server: {
          transport: 'http',
          port: this.config.port,
          uptime: process.uptime(),
        },
      });
    });

    // Debug endpoint - list tools
    app.get('/debug/tools', (_req, res) => {
      res.json({
        tools: TOOLS,
      });
    });

    return new Promise<void>((resolve) => {
      app.listen(this.config.port, this.config.host, () => {
        this.logger.info(`MCP HTTP server listening on http://${this.config.host}:${this.config.port}`);
        this.logger.info(`GraphiTi API: ${this.config.apiUrl}`);
        this.logger.info('Available endpoints:');
        this.logger.info('  POST /mcp - MCP protocol endpoint');
        this.logger.info('  GET /health - Health check');
        this.logger.info('  GET /debug/tools - List available tools');
        resolve();
      });
    });
  }
}
