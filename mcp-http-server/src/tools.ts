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
- Use cases: "What did we discuss last week?", "Memories from January 2024"

🆕 MULTI-PROJECT SEARCH: Enhanced search capabilities for managing multiple projects!
- priority_group_id: Prioritize results from a specific project (e.g., "keymize" over "xiaoman")
- min_priority: Only return facts with priority >= this value (0-10 scale)
- tags: Filter by tags (e.g., ["#Rust", "#工具"])
- Results now include source_group_id, relevance_score, tags, and priority fields`,
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
        priority_group_id: {
          type: 'string',
          description: '🆕 Optional: Prioritize results from this specific project/group. Results from this group will rank higher in search results.',
        },
        min_priority: {
          type: 'number',
          description: '🆕 Optional: Only return facts with priority >= this value (0-10 scale). Use to filter for important memories.',
          minimum: 0,
          maximum: 10,
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: '🆕 Optional: Filter results by tags (e.g., ["#Rust", "#前端"]). Only facts containing at least one of these tags will be returned.',
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

  {
    name: 'find_relationship_path',
    description: `Find relationship paths between two entities in the knowledge graph (up to N hops).

This tool performs graph traversal to discover how entities are connected through intermediate relationships.

🔍 Use cases:
- "How is Alice connected to the Project X?"
- "What's the relationship between concept A and concept B?"
- "Find all paths linking these two entities within 3 hops"
- "Show me entities that connect User and Organization"

💡 Two modes:
1. **Specific target**: Provide both source_entity and target_entity to find shortest paths between them
2. **Exploration**: Only provide source_entity to discover all entities within N hops

📊 Returns:
- Structured paths showing alternating nodes and relationships
- Each node includes: uuid, name, group_id
- Each relationship includes: fact, relation_type
- Respects group_ids filter if provided`,
    inputSchema: {
      type: 'object',
      properties: {
        source_entity: {
          type: 'string',
          description: 'Source entity name or UUID. The starting point for path finding.',
        },
        target_entity: {
          type: 'string',
          description: 'Optional: Target entity name or UUID. If provided, finds paths between source and target. If omitted, explores all paths from source.',
        },
        max_depth: {
          type: 'number',
          description: 'Maximum number of hops/relationships to traverse (1-5). Default: 2',
          minimum: 1,
          maximum: 5,
          default: 2,
        },
        group_ids: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional: Limit search to specific projects/workspaces. Only paths through entities in these groups will be returned.',
        },
      },
      required: ['source_entity'],
    },
  },

  {
    name: 'get_entity_neighbors',
    description: `Get all neighboring entities within N hops of a specific entity.

This tool discovers the local "neighborhood" around an entity by traversing the graph.

🔍 Use cases:
- "What entities are directly connected to Alice?"
- "Show me all related concepts within 2 hops of 'Machine Learning'"
- "Find entities near this node in the knowledge graph"
- "Explore the local context around this entity"

📊 Returns:
- List of neighboring entities sorted by distance
- Each neighbor includes: uuid, name, group_id, distance (number of hops)
- Distance = 1 means directly connected
- Distance = 2 means connected through one intermediate entity

💡 Tip: Use depth=1 for immediate connections, depth=2-3 for broader context exploration.`,
    inputSchema: {
      type: 'object',
      properties: {
        uuid: {
          type: 'string',
          description: 'UUID of the entity to get neighbors for. Get this from get_entities or search results.',
        },
        depth: {
          type: 'number',
          description: 'Maximum number of hops to explore (1-5). Default: 1',
          minimum: 1,
          maximum: 5,
          default: 1,
        },
      },
      required: ['uuid'],
    },
  },

  {
    name: 'set_context',
    description: `Set the current conversation context (active project/workspace).

🎯 Purpose:
This tool enables context-aware memory operations by setting which group_id should be prioritized in searches.

🔍 How it works:
- Sets the active group_id for the current conversation
- Future search_memory calls will automatically prioritize results from this group
- Tracks recently used groups for easy context switching
- Auto-applied to add_memory operations

💡 Use cases:
- "Switch to project keymize context" → set_context(group_id="keymize")
- "Work on personal memories now" → set_context(group_id="default_user")
- "Focus on work-related knowledge" → set_context(group_id="work")

⚡ Benefits:
- No need to manually specify priority_group_id in every search
- Reduces context-switching overhead
- Makes multi-project workflows more natural

Example workflow:
1. set_context(group_id="project_x")
2. search_memory(query="API design", group_ids=["project_x", "shared"])
   → Automatically prioritizes project_x results`,
    inputSchema: {
      type: 'object',
      properties: {
        group_id: {
          type: 'string',
          description: 'The group_id to set as current context. Use list_groups to see available groups.',
        },
      },
      required: ['group_id'],
    },
  },

  {
    name: 'get_context',
    description: `Get the current conversation context state.

📊 Returns:
- Current active group_id (or null if not set)
- Recently used group_ids (last 10)
- Last updated timestamp

💡 Use cases:
- "What context am I in?" → Check currentGroupId
- "What projects have I worked on recently?" → Check recentGroupIds
- Debugging context-related issues
- Verifying context switches

This helps you understand which project/workspace is currently active and will be prioritized in searches.`,
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },

  {
    name: 'update_fact',
    description: `Update an existing fact/relationship in the knowledge graph.

🔧 Purpose:
Modify properties of an existing fact without deleting and recreating it.

🎯 Use cases:
- Fix incorrect information in a fact
- Update temporal bounds (valid_at/invalid_at) when relationships change
- Adjust priority or add tags to existing facts
- Correct fact descriptions while preserving the relationship structure

⚠️ IMPORTANT:
- Requires the fact's UUID (get it from search_memory or get_fact_details)
- All fields are optional - only provide what you want to change
- If you update the fact description, embeddings will be automatically regenerated
- Cannot change source/target entities (delete and recreate instead)

💡 Example workflow:
1. search_memory to find the fact UUID
2. update_fact(uuid="abc123", fact="Updated description", priority=8)`,
    inputSchema: {
      type: 'object',
      properties: {
        uuid: {
          type: 'string',
          description: 'UUID of the fact to update',
        },
        fact: {
          type: 'string',
          description: 'Optional: New fact description text',
        },
        valid_at: {
          type: 'string',
          description: 'Optional: New valid_at timestamp (ISO 8601 format)',
        },
        invalid_at: {
          type: 'string',
          description: 'Optional: New invalid_at timestamp (ISO 8601 format)',
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional: New tags list',
        },
        priority: {
          type: 'number',
          description: 'Optional: New priority (0-10)',
          minimum: 0,
          maximum: 10,
        },
        metadata: {
          type: 'object',
          description: 'Optional: New metadata (arbitrary JSON object)',
        },
      },
      required: ['uuid'],
    },
  },

  {
    name: 'update_entity',
    description: `Update an existing entity in the knowledge graph.

🔧 Purpose:
Modify properties of an existing entity without deleting and recreating it.

🎯 Use cases:
- Correct entity names or summaries
- Update entity metadata as information evolves
- Adjust priority or add tags to entities
- Fix typos or improve entity descriptions

⚠️ IMPORTANT:
- Requires the entity's UUID (get it from get_entities or search results)
- All fields are optional - only provide what you want to change
- If you update the name, name embeddings will be automatically regenerated
- Changing the name doesn't affect existing relationships

💡 Example workflow:
1. get_entities(group_id="work") to find the entity UUID
2. update_entity(uuid="xyz789", summary="Improved summary", tags=["#project", "#active"])`,
    inputSchema: {
      type: 'object',
      properties: {
        uuid: {
          type: 'string',
          description: 'UUID of the entity to update',
        },
        name: {
          type: 'string',
          description: 'Optional: New entity name',
        },
        summary: {
          type: 'string',
          description: 'Optional: New entity summary/description',
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional: New tags list',
        },
        priority: {
          type: 'number',
          description: 'Optional: New priority (0-10)',
          minimum: 0,
          maximum: 10,
        },
        metadata: {
          type: 'object',
          description: 'Optional: New metadata (arbitrary JSON object)',
        },
      },
      required: ['uuid'],
    },
  },

  {
    name: 'batch_add_memories',
    description: `Add multiple memories/episodes at once for efficient bulk import.

🚀 Purpose:
Efficiently add multiple memories in a single operation, ideal for:
- Importing conversation history
- Migrating data from other systems
- Bulk knowledge graph population
- Loading archived memories

⚡ Performance:
- Processes all memories asynchronously
- More efficient than calling add_memory multiple times
- All memories processed in parallel queue

⚠️ IMPORTANT:
- All memories must belong to the same group_id
- Each memory requires: name, content, timestamp
- Returns job IDs for tracking processing status

💡 Example workflow:
1. batch_add_memories with array of memories
2. Use get_queue_status to monitor processing
3. Search for imported memories after processing completes`,
    inputSchema: {
      type: 'object',
      properties: {
        group_id: {
          type: 'string',
          description: 'Group ID for all memories (e.g., "work", "personal")',
        },
        memories: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: {
                type: 'string',
                description: 'Short name/title for this memory',
              },
              content: {
                type: 'string',
                description: 'The content of the memory',
              },
              timestamp: {
                type: 'string',
                description: 'When this memory occurred (ISO 8601 format)',
              },
              role: {
                type: 'string',
                description: 'Optional: Role (default: user)',
              },
              source_description: {
                type: 'string',
                description: 'Optional: Description of the source',
              },
            },
            required: ['name', 'content', 'timestamp'],
          },
          description: 'Array of memories to add',
        },
      },
      required: ['group_id', 'memories'],
    },
  },

  {
    name: 'find_duplicate_entities',
    description: `Detect potential duplicate entities in the knowledge graph using semantic similarity.

🔍 Purpose:
Identify entities that might represent the same real-world concept but have different names or representations.

🎯 Use cases:
- Data quality checks
- Deduplication before merging graphs
- Finding synonyms and aliases
- Identifying entities that should be merged

📊 Returns:
- Groups of similar entities with similarity scores
- Each group includes entity names, UUIDs, and similarity percentage
- Sorted by similarity (most similar first)

⚠️ Parameters:
- group_id: The workspace to check
- similarity_threshold: Minimum similarity (0.0-1.0, default: 0.85)
  - 0.95+ : Near-identical (typos, case differences)
  - 0.85-0.95 : Very similar (synonyms, abbreviations)
  - 0.70-0.85 : Somewhat similar (related concepts)
- limit: Maximum duplicate groups to return (default: 50)

💡 Example workflow:
1. find_duplicate_entities(group_id="work", similarity_threshold=0.9)
2. Review suggested duplicates
3. Use update_entity or manual merge if needed`,
    inputSchema: {
      type: 'object',
      properties: {
        group_id: {
          type: 'string',
          description: 'Group ID to check for duplicates',
        },
        similarity_threshold: {
          type: 'number',
          description: 'Minimum similarity score (0.0-1.0). Default: 0.85',
          minimum: 0.0,
          maximum: 1.0,
          default: 0.85,
        },
        limit: {
          type: 'number',
          description: 'Maximum number of duplicate groups to return. Default: 50',
          minimum: 1,
          maximum: 200,
          default: 50,
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
    // 🆕 Multi-project enhancement fields
    priority_group_id?: string;
    min_priority?: number;
    tags?: string[];
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
  find_relationship_path: {
    source_entity: string;
    target_entity?: string;
    max_depth?: number;
    group_ids?: string[];
  };
  get_entity_neighbors: {
    uuid: string;
    depth?: number;
  };
  set_context: {
    group_id: string;
  };
  get_context: Record<string, never>;
  update_fact: {
    uuid: string;
    fact?: string;
    valid_at?: string;
    invalid_at?: string;
    tags?: string[];
    priority?: number;
    metadata?: Record<string, any>;
  };
  update_entity: {
    uuid: string;
    name?: string;
    summary?: string;
    tags?: string[];
    priority?: number;
    metadata?: Record<string, any>;
  };
  batch_add_memories: {
    group_id: string;
    memories: Array<{
      name: string;
      content: string;
      timestamp: string;
      role?: string;
      source_description?: string;
    }>;
  };
  find_duplicate_entities: {
    group_id: string;
    similarity_threshold?: number;
    limit?: number;
  };
};
