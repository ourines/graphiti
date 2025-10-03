/**
 * MCP Tool Definitions for GraphiTi
 * These tools are exposed to Claude Code/Claude Desktop via MCP protocol
 */

export const TOOLS = [
  {
    name: 'add_memory',
    description: `Add an episode to memory. This is the primary way to add information to the graph.

Use this tool to store any information that you want to remember for future conversations, such as:
- User preferences and settings
- Important facts about the user or their projects
- Decisions made during the conversation
- Context that should be retained across sessions

The memory will be processed and added to the knowledge graph, where it can be retrieved later using search_memory.`,
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'A short name/title for this memory episode',
        },
        content: {
          type: 'string',
          description: 'The content of the episode to persist to memory',
        },
        group_id: {
          type: 'string',
          description:
            'A unique ID for this graph/user. Use the same group_id to keep memories together',
        },
        role: {
          type: 'string',
          description: 'Role of the message (default: user)',
          default: 'user',
        },
        source_description: {
          type: 'string',
          description: 'Optional description of the source of this information',
        },
      },
      required: ['name', 'content', 'group_id'],
    },
  },

  {
    name: 'search_memory',
    description: `Search the graph memory for relevant facts and relationships.

Use this tool to retrieve information that was previously stored using add_memory. The search uses hybrid retrieval combining:
- Semantic search (meaning-based matching)
- Keyword search (exact term matching)
- Graph traversal (related entities and relationships)

This will return the most relevant facts based on your query, helping you maintain context across conversations.`,
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The search query describing what information you want to find',
        },
        group_ids: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of group IDs to search in',
        },
        max_facts: {
          type: 'number',
          description: 'Maximum number of facts to return (default: 10)',
          default: 10,
        },
      },
      required: ['query', 'group_ids'],
    },
  },

  {
    name: 'get_episodes',
    description: `Get the most recent memory episodes for a specific group.

Use this to review what information has been recently added to memory. This is useful for:
- Reviewing the conversation history
- Understanding what context is already in the graph
- Debugging or verifying what was stored

Unlike search_memory which finds semantically relevant facts, this simply returns the N most recent episodes in chronological order.`,
    inputSchema: {
      type: 'object',
      properties: {
        group_id: {
          type: 'string',
          description: 'ID of the group to retrieve episodes from',
        },
        last_n: {
          type: 'number',
          description: 'Number of most recent episodes to retrieve (default: 10)',
          default: 10,
        },
      },
      required: ['group_id'],
    },
  },

  {
    name: 'delete_episode',
    description: `Delete a specific episode from the graph memory.

Use this to remove incorrect or outdated information. You'll need the episode UUID, which you can get from get_episodes or search_memory results.

Note: This deletes the episode node but may not remove all extracted entities and relationships. Use with caution.`,
    inputSchema: {
      type: 'object',
      properties: {
        uuid: {
          type: 'string',
          description: 'UUID of the episode to delete',
        },
      },
      required: ['uuid'],
    },
  },

  {
    name: 'clear_graph',
    description: `Clear all data from the graph memory and rebuild indices.

⚠️  WARNING: This is a destructive operation that cannot be undone!

This will delete ALL memories, entities, and relationships in the graph. Only use this if you need to completely reset the memory system or are certain you want to start fresh.

Consider using delete_episode for targeted deletions instead.`,
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
] as const;

/**
 * Type helper for tool names
 */
export type ToolName = (typeof TOOLS)[number]['name'];

/**
 * Type helper for tool input schemas
 */
export type ToolInputs = {
  add_memory: {
    name: string;
    content: string;
    group_id: string;
    role?: string;
    source_description?: string;
  };
  search_memory: {
    query: string;
    group_ids: string[];
    max_facts?: number;
  };
  get_episodes: {
    group_id: string;
    last_n?: number;
  };
  delete_episode: {
    uuid: string;
  };
  clear_graph: Record<string, never>;
};
