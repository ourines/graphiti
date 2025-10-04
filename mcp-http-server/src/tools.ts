/**
 * MCP Tool Definitions for GraphiTi
 * These tools are exposed to Claude Code/Claude Desktop via MCP protocol
 */

export const TOOLS = [
  {
    name: 'add_memory',
    description: `Add information to a project's memory.

📖 CONCEPT: group_id = Project/Workspace
Each project has its own isolated memory space. Use consistent project names:
  - "default_user" - Personal memories (default)
  - "keymize" - Keymize project knowledge
  - "client_acme" - Client-specific work
  - "research_ml" - Research notes

🎯 Use this to store:
- User preferences and project settings
- Important facts and decisions
- Context that should persist across sessions
- Any information worth remembering

⚠️ CRITICAL: Use the SAME project name consistently!
  ✅ Good: Always use "keymize" for Keymize project
  ❌ Bad: Mixing "keymize", "project_keymize", "Keymize"

💡 Tip: Use list_groups to see existing projects before creating new ones.`,
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Short title for this memory (e.g., "User prefers dark mode")',
        },
        content: {
          type: 'string',
          description: 'The information to remember',
        },
        group_id: {
          type: 'string',
          description:
            'Project name for this memory. Examples:\n' +
            '  - "default_user" (personal)\n' +
            '  - "keymize" (Keymize project)\n' +
            '  - "client_acme" (Acme Corp work)\n' +
            'All memories in the same project are stored and searched together. Different projects are completely isolated.',
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
    description: `Search memories across one or multiple projects.

📖 PROJECT SEARCH BASICS:
Projects are isolated. You MUST specify which projects to search:
  • Single project: ["keymize"]
  • Multiple projects: ["keymize", "xiaoman", "shared"] ← Cross-project search!
  • Personal only: ["default_user"]

🔍 Hybrid retrieval combines:
- Semantic search (meaning-based)
- Keyword search (exact terms)
- Graph traversal (relationships)

🎯 MULTI-PROJECT FEATURES:
- priority_group_id: Rank one project higher (e.g., search ["keymize", "xiaoman"] but prioritize "keymize")
- min_priority: Filter by importance (0-10 scale)
- tags: Filter by tags (e.g., ["#Rust", "#工具"])

⏰ TIME FILTERING:
- start_time / end_time: Filter by validity period (ISO 8601)

⚠️ COMMON MISTAKE: Searching wrong project returns empty! Use list_groups if unsure.

💡 Example workflow:
  1. list_groups() → See ["keymize", "xiaoman"]
  2. search_memory(query="API design", group_ids=["keymize", "xiaoman"], priority_group_id="keymize")`,
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'What you want to find (e.g., "API design decisions")',
        },
        group_ids: {
          type: 'array',
          items: { type: 'string' },
          description: 'Projects to search in. Examples:\n' +
            '  • ["keymize"] - Single project\n' +
            '  • ["keymize", "xiaoman", "shared"] - Cross-project search\n' +
            '  • ["default_user"] - Personal memories\n' +
            'Results include which project each fact came from (source_group_id).',
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
          description: '🔥 Boost results from one project. When searching multiple projects, this makes one project rank higher.\n' +
            'Example: search ["keymize", "xiaoman"], priority_group_id="keymize" → Keymize results appear first.',
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
    description: `List all projects in your knowledge graph.

📋 Returns: Array of project names (group_ids)
Example: ["default_user", "keymize", "xiaoman", "research_2024"]

💡 When to use:
1. **Before searching** - "What projects exist?" → Avoid searching non-existent projects
2. **Avoid typos** - See exact spelling ("keymize" not "Keymize" or "project_keymize")
3. **Rediscover data** - "Where did I store that?" → Find forgotten projects
4. **Multi-project work** - Get list for cross-project search

🎯 Common workflows:
• Starting fresh:
  list_groups() → See ["default_user", "keymize"]

• Multi-project search:
  list_groups() → Find ["keymize", "xiaoman", "shared"]
  search_memory(query="API", group_ids=["keymize", "xiaoman"], priority_group_id="keymize")

• Lost memories:
  "I can't find my memories!" → list_groups()
  → Discover you used "project_old" not "project-old"

⚠️ Solves: "I stored memories but can't find them!" → Check the list first.`,
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
    description: `Set which project you're currently working on.

📖 CONCEPT: Active Project
Like "opening a project" in VS Code or "switching branches" in Git.
Sets the current project focus for automatic context management.

🎯 What it does:
- Marks one project as "active" (e.g., "keymize")
- Future searches automatically prioritize this project
- Tracks recent projects for easy switching

💡 When to use:
- "I'm working on Keymize now" → set_context(group_id="keymize")
- "Switch to personal tasks" → set_context(group_id="default_user")
- "Focus on client work" → set_context(group_id="client_acme")

⚡ Benefits:
- No manual priority_group_id in every search
- Natural multi-project workflow
- Reduces cognitive overhead

Example:
1. set_context(group_id="keymize")
2. search_memory(query="API", group_ids=["keymize", "shared"])
   → Auto-prioritizes Keymize results!`,
    inputSchema: {
      type: 'object',
      properties: {
        group_id: {
          type: 'string',
          description: 'Project name to set as active. Examples: "keymize", "default_user", "client_acme".\n' +
            'Tip: Use list_groups to see available projects.',
        },
      },
      required: ['group_id'],
    },
  },

  {
    name: 'get_context',
    description: `Check which project is currently active.

📊 Returns:
- currentGroupId: Active project (e.g., "keymize" or null)
- recentGroupIds: Recently used projects (last 10)
- lastUpdated: When context was last changed

💡 Use cases:
- "What project am I working on?" → Check currentGroupId
- "What projects did I use recently?" → Check recentGroupIds
- Verify context after switching projects

Example response:
{
  "currentGroupId": "keymize",
  "recentGroupIds": ["keymize", "xiaoman", "default_user"],
  "lastUpdated": "2024-10-05T10:30:00Z",
  "message": "Current context: keymize"
}`,
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
3. Use merge_entities to combine duplicates`,
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

  {
    name: 'merge_entities',
    description: `Merge two duplicate entities into one, combining all their relationships.

🔧 Purpose:
Consolidate duplicate entities by transferring all relationships from the source entity to the target entity, then deleting the source.

🎯 Use cases:
- Clean up duplicates found by find_duplicate_entities
- Merge entities with different spellings ("NYC" + "New York City")
- Consolidate synonyms or aliases
- Fix entity extraction errors

⚠️ IMPORTANT:
- This operation is IRREVERSIBLE
- The source entity will be DELETED after merge
- All facts/relationships will point to the target entity
- The target entity's information is preserved
- The source entity's relationships are transferred

💡 Workflow:
1. Use find_duplicate_entities to identify duplicates
2. Review the entities to confirm they should be merged
3. Choose which entity to keep as target (usually the one with better name/summary)
4. Execute merge_entities(source_uuid, target_uuid)

📊 Returns:
- Success message with count of transferred relationships
- Error if either entity doesn't exist`,
    inputSchema: {
      type: 'object',
      properties: {
        source_uuid: {
          type: 'string',
          description: 'UUID of the entity to merge FROM (will be deleted)',
        },
        target_uuid: {
          type: 'string',
          description: 'UUID of the entity to merge INTO (will be kept)',
        },
      },
      required: ['source_uuid', 'target_uuid'],
    },
  },

  {
    name: 'batch_delete',
    description: `Delete multiple nodes (entities, episodes, or facts) in a single operation.

🚀 Purpose:
Efficiently delete multiple nodes at once instead of calling delete operations individually.

🎯 Use cases:
- Clean up test data
- Remove multiple duplicate entities after review
- Delete batches of outdated episodes
- Mass cleanup operations

⚠️ IMPORTANT:
- This operation is IRREVERSIBLE
- Can delete any combination of entities, episodes, and facts
- All relationships will be cleaned up automatically
- More efficient than individual deletes

💡 Workflow:
1. Collect UUIDs of nodes to delete (from search, get_entities, etc.)
2. Review the list to ensure you're deleting the right nodes
3. Execute batch_delete with the UUID list

📊 Example:
batch_delete(uuids=["uuid1", "uuid2", "uuid3"])`,
    inputSchema: {
      type: 'object',
      properties: {
        uuids: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of node UUIDs to delete. Can include entities, episodes, or facts.',
          minItems: 1,
        },
      },
      required: ['uuids'],
    },
  },

  {
    name: 'list_tags',
    description: `List all unique tags/labels used in the knowledge graph.

🔍 Purpose:
Discover what tags are being used across your knowledge graph for categorization.

🎯 Use cases:
- Explore available tags before filtering
- Audit tag usage across your knowledge base
- Find inconsistent tag naming (e.g., "Python" vs "python")
- Understand how your knowledge is categorized

📊 Returns:
- tags: List of all unique tag strings
- count: Total number of unique tags
- entity_tags: Tags used on entities
- message: Summary message

💡 Example workflow:
1. list_tags(group_id="work") → See all tags in work context
2. Find inconsistencies like "JavaScript" and "Javascript"
3. Use rename_tag to standardize naming`,
    inputSchema: {
      type: 'object',
      properties: {
        group_id: {
          type: 'string',
          description: 'Optional: Filter tags by group. If omitted, returns tags from all groups.',
        },
      },
      required: [],
    },
  },

  {
    name: 'rename_tag',
    description: `Rename a tag across all entities in the knowledge graph.

🔧 Purpose:
Standardize tag naming by renaming a tag everywhere it's used.

🎯 Use cases:
- Fix typos in tags ("Pyton" → "Python")
- Standardize capitalization ("javascript" → "JavaScript")
- Consolidate similar tags ("#AI" → "#ArtificialIntelligence")
- Rename project/category tags

⚠️ IMPORTANT:
- Updates ALL entities with the old tag
- Operation is immediate and affects all matching entities
- Can be scoped to a specific group_id or applied globally

💡 Workflow:
1. list_tags() → Find tags that need renaming
2. rename_tag(old_tag="Javascript", new_tag="JavaScript")
3. list_tags() → Verify the rename was successful

📊 Returns:
- Success message with count of updated entities
- If no entities have the tag, count will be 0`,
    inputSchema: {
      type: 'object',
      properties: {
        old_tag: {
          type: 'string',
          description: 'The current tag name to replace',
        },
        new_tag: {
          type: 'string',
          description: 'The new tag name',
        },
        group_id: {
          type: 'string',
          description: 'Optional: Limit rename to this group. If omitted, renames across all groups.',
        },
      },
      required: ['old_tag', 'new_tag'],
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
  merge_entities: {
    source_uuid: string;
    target_uuid: string;
  };
  batch_delete: {
    uuids: string[];
  };
  list_tags: {
    group_id?: string;
  };
  rename_tag: {
    old_tag: string;
    new_tag: string;
    group_id?: string;
  };
};
