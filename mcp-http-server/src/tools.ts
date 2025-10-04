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

The memory will be processed and added to the knowledge graph, where it can be retrieved later using search_memory.

⚠️ IMPORTANT: Always use "default_user" as the group_id for personal conversations, or use a consistent project-specific ID (e.g., "project_keymize") for project-related memories. The group_id acts like a folder - memories in different groups are completely separate.`,
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
            'Memory workspace ID - IMPORTANT: Use "default_user" for personal memories. All memories with the same group_id are stored together and can be searched together. Think of it like a folder name for organizing different knowledge spaces (e.g., "work", "personal", "project_xyz"). Always use the SAME group_id for related memories.',
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

⚠️ IMPORTANT: You MUST specify group_ids to search in. Use ["default_user"] for personal memories. If you added memories to a different group_id, you must search in that same group to find them. Searching in the wrong group will return no results.

🆕 TIME FILTERING: You can now filter by time range!
- start_time: Only return facts valid after this time (ISO 8601: "2024-01-01T00:00:00Z")
- end_time: Only return facts valid before this time
- Use cases: "What did we discuss last week?", "Memories from January 2024"`,
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
          description: 'List of memory workspace IDs to search in. Use ["default_user"] for personal memories. You can search multiple workspaces at once (e.g., ["work", "personal"]) to find memories across different contexts. MUST match the group_id used when adding memories.',
        },
        max_facts: {
          type: 'number',
          description: 'Maximum number of facts to return (default: 10)',
          default: 10,
        },
        start_time: {
          type: 'string',
          description: 'Optional: Filter facts valid after this time (ISO 8601 format: "2024-01-01T00:00:00Z")',
        },
        end_time: {
          type: 'string',
          description: 'Optional: Filter facts valid before this time (ISO 8601 format)',
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

  {
    name: 'get_queue_status',
    description: `Get the current processing queue status and recent job history.

Use this tool to monitor the memory processing pipeline and troubleshoot issues. This shows:
- Current queue size (number of pending jobs)
- Currently processing job (if any)
- Recent job history (last 20 jobs with status, errors, retry counts)

This is helpful for:
- Understanding if memories are being processed
- Detecting rate limit errors or other failures
- Checking retry attempts for failed jobs
- Monitoring overall system health`,
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },

  {
    name: 'delete_group',
    description: `Delete all memories and data for a specific group (memory workspace).

⚠️  WARNING: This will delete ALL episodes, entities, facts, and relationships for the specified group_id. This operation cannot be undone!

Use this tool to:
- Clean up test data (e.g., delete "test_group")
- Remove old project memories (e.g., delete "project_old")
- Clear a specific context while preserving other groups

This is safer than clear_graph because it only affects one group_id, leaving other memory workspaces intact.

Example: Delete "test_retry" group but keep "default_user" memories.`,
    inputSchema: {
      type: 'object',
      properties: {
        group_id: {
          type: 'string',
          description: 'The group_id to delete. All data associated with this group will be permanently removed.',
        },
      },
      required: ['group_id'],
    },
  },

  {
    name: 'delete_fact',
    description: `Delete a specific fact (knowledge graph relationship/edge) from memory.

Use this tool to remove incorrect or outdated facts from the knowledge graph. This is more precise than delete_episode because:
- delete_episode: Removes an entire conversation/episode
- delete_fact: Removes only a specific extracted fact/relationship

You'll need the fact UUID, which you can get from search_memory results (each fact has a 'uuid' field).

Example scenarios:
- "The LLM incorrectly extracted that 'Alice works at Google' - delete that fact"
- "This relationship is no longer valid"
- "Remove duplicate or conflicting facts"

Note: This deletes the EntityEdge (fact) but keeps the entities (nodes) and episode intact.`,
    inputSchema: {
      type: 'object',
      properties: {
        uuid: {
          type: 'string',
          description: 'UUID of the fact (EntityEdge) to delete. Get this from search_memory results.',
        },
      },
      required: ['uuid'],
    },
  },

  {
    name: 'get_fact_details',
    description: `Get detailed information about a specific fact (knowledge graph relationship).

Use this to inspect a fact's complete metadata, including:
- Source and target entities
- Relationship type and description
- Temporal validity (valid_at, invalid_at timestamps)
- Confidence scores
- Source episode that generated this fact

This is useful for:
- Debugging knowledge extraction quality
- Verifying fact accuracy before deletion
- Understanding fact provenance and timeline
- Auditing the knowledge graph

You'll need the fact UUID from search_memory results.`,
    inputSchema: {
      type: 'object',
      properties: {
        uuid: {
          type: 'string',
          description: 'UUID of the fact (EntityEdge) to retrieve details for.',
        },
      },
      required: ['uuid'],
    },
  },

  {
    name: 'list_groups',
    description: `List all memory workspaces (group_ids) in the knowledge graph.

Use this to discover what memory spaces exist. This is extremely helpful for:
- Finding all available groups before searching
- Avoiding typos in group_id (e.g., "default_user" vs "user_liubiao")
- Understanding the organizational structure of your memories
- Knowing which contexts have stored data

Example results: ["default_user", "project_keymize", "work", "personal"]

This solves the common problem: "I stored memories but can't find them because I forgot the group_id!"`,
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },

  {
    name: 'get_entities',
    description: `Browse entities (people, places, concepts) in the knowledge graph.

Use this to see what the system has learned and extracted from your conversations. Returns entity nodes with:
- Entity name (e.g., "Alice", "GraphiTi", "Python")
- UUID for further querying
- Summary description
- Creation timestamp

This is useful for:
- Exploring what information has been extracted
- Verifying entity recognition quality
- Finding entity UUIDs for get_entity_relationships
- Understanding the knowledge graph structure
- Discovering connections you might have forgotten

Example: "Show me all entities in my 'work' memories" → Returns Alice (colleague), Project X (project), Python (technology), etc.`,
    inputSchema: {
      type: 'object',
      properties: {
        group_id: {
          type: 'string',
          description: 'The group_id to retrieve entities from. Use list_groups to find available groups.',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of entities to return (default: 50)',
          default: 50,
        },
      },
      required: ['group_id'],
    },
  },

  {
    name: 'get_entity_relationships',
    description: `Explore all relationships/facts connected to a specific entity.

Use this to understand how an entity connects to the rest of your knowledge graph. Returns all facts (EntityEdges) where this entity is either the source or target.

This enables powerful questions like:
- "What projects is Alice working on?" (get relationships for Alice entity)
- "What technologies are used in Project X?" (get relationships for Project X)
- "Who knows Python?" (get relationships for Python entity)

You need the entity UUID, which you can get from:
- get_entities results
- search_memory results (entities mentioned in facts)

Example workflow:
1. list_groups → find "work" group
2. get_entities(group_id="work") → find Alice entity with UUID abc-123
3. get_entity_relationships(uuid="abc-123") → see all Alice's connections`,
    inputSchema: {
      type: 'object',
      properties: {
        uuid: {
          type: 'string',
          description: 'UUID of the entity to get relationships for. Get this from get_entities or search results.',
        },
      },
      required: ['uuid'],
    },
  },

  {
    name: 'get_graph_stats',
    description: `Get comprehensive statistics for a specific memory workspace (group).

This provides a high-level overview of your knowledge graph, including:
- Total episodes (conversations/memories stored)
- Total entities (people, places, concepts extracted)
- Total facts (relationships between entities)
- Total communities (topic clusters, if built)
- Oldest and newest memory timestamps

Use this to:
- Monitor knowledge graph growth over time
- Understand the size and scope of your memories
- Validate that memories are being stored correctly
- Get a quick health check of your knowledge graph

Example: "How big is my 'work' knowledge graph?" → Returns comprehensive stats showing you have 145 episodes, 89 entities, 234 facts, etc.`,
    inputSchema: {
      type: 'object',
      properties: {
        group_id: {
          type: 'string',
          description: 'The group_id to get statistics for. Use list_groups to find available groups.',
        },
      },
      required: ['group_id'],
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
    start_time?: string;
    end_time?: string;
  };
  get_episodes: {
    group_id: string;
    last_n?: number;
  };
  delete_episode: {
    uuid: string;
  };
  clear_graph: Record<string, never>;
  get_queue_status: Record<string, never>;
  delete_group: {
    group_id: string;
  };
  delete_fact: {
    uuid: string;
  };
  get_fact_details: {
    uuid: string;
  };
  list_groups: Record<string, never>;
  get_entities: {
    group_id: string;
    limit?: number;
  };
  get_entity_relationships: {
    uuid: string;
  };
  get_graph_stats: {
    group_id: string;
  };
};
