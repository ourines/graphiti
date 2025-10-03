# GraphiTi MCP HTTP Server

**Connect Claude to your GraphiTi knowledge graph via Model Context Protocol (MCP)**

This package provides an MCP server that allows Claude Code and Claude Desktop to interact with your [GraphiTi](https://github.com/getzep/graphiti) knowledge graph, enabling persistent memory across conversations.

## Features

- 🔌 **MCP Protocol Support** - Full Model Context Protocol implementation
- 🚀 **NPX Ready** - One command to start: `npx @graphiti/mcp-http`
- 🔄 **Dual Mode** - Supports both stdio (Claude Desktop) and HTTP (debugging)
- ⚙️ **Flexible Configuration** - Environment variables for all settings
- 🔐 **Custom Headers** - Support for authentication and custom API headers
- 🎯 **Type Safe** - Written in TypeScript with full type definitions

## Quick Start

### Prerequisites

1. **GraphiTi FastAPI Server** running (see [server/](../server))
2. **Node.js 18+**

### Installation

```bash
# Using npx (recommended - no installation needed)
npx @graphiti/mcp-http

# Or install globally
pnpm add -g @graphiti/mcp-http
```

### Basic Usage

```bash
# Set your GraphiTi API URL
export GRAPHITI_API_URL=http://localhost:8000

# Start the MCP server
npx @graphiti/mcp-http
```

## Configuration

### Environment Variables

Create a `.env` file or set these environment variables:

```bash
# Required
GRAPHITI_API_URL=http://localhost:8000

# Optional - API Authentication
GRAPHITI_API_HEADERS='{"Authorization":"Bearer YOUR_TOKEN"}'
# Or simple format:
# GRAPHITI_API_HEADERS=Authorization:Bearer YOUR_TOKEN,X-Custom:Value

# Optional - Server Settings
MCP_TRANSPORT=stdio          # or 'http' for debugging
MCP_PORT=3000               # Only for HTTP mode
MCP_HOST=localhost          # Only for HTTP mode

# Optional - Defaults
GRAPHITI_DEFAULT_GROUP_ID=default

# Optional - Logging
LOG_LEVEL=info              # debug, info, warn, error

# Optional - Timeout
GRAPHITI_REQUEST_TIMEOUT=30000  # milliseconds
```

## Usage with Claude

### Claude Code

Add to your `.claude.json` or `.mcp.json`:

```json
{
  "mcpServers": {
    "graphiti": {
      "command": "npx",
      "args": ["-y", "@graphiti/mcp-http"],
      "env": {
        "GRAPHITI_API_URL": "http://localhost:8000",
        "GRAPHITI_DEFAULT_GROUP_ID": "my-project"
      }
    }
  }
}
```

### Claude Desktop

Add to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "graphiti": {
      "command": "npx",
      "args": ["-y", "@graphiti/mcp-http"],
      "env": {
        "GRAPHITI_API_URL": "http://localhost:8000",
        "GRAPHITI_API_HEADERS": "{\"Authorization\":\"Bearer YOUR_TOKEN\"}"
      }
    }
  }
}
```

## Available Tools

Once connected, Claude will have access to these tools:

### `add_memory`
Store information in the knowledge graph.

```typescript
add_memory({
  name: "User Preference",
  content: "User prefers dark mode and TypeScript",
  group_id: "user-123"
})
```

### `search_memory`
Search for relevant facts using hybrid retrieval.

```typescript
search_memory({
  query: "What are the user's preferences?",
  group_ids: ["user-123"],
  max_facts: 10
})
```

### `get_episodes`
Get recent memory episodes in chronological order.

```typescript
get_episodes({
  group_id: "user-123",
  last_n: 10
})
```

### `delete_episode`
Remove a specific episode from memory.

```typescript
delete_episode({
  uuid: "episode-uuid-here"
})
```

### `clear_graph`
⚠️ Clear all data from the graph (destructive!).

```typescript
clear_graph({})
```

## Development

### Setup

```bash
cd mcp-http-server
pnpm install
```

### Build

```bash
pnpm build
```

### Development Mode

```bash
# Watch mode
pnpm dev

# With custom config
GRAPHITI_API_URL=http://localhost:8000 pnpm dev
```

### Testing

```bash
# Run tests
pnpm test

# Watch mode
pnpm test:watch

# Type check
pnpm typecheck
```

### HTTP Mode (Debugging)

Start in HTTP mode for easier debugging:

```bash
MCP_TRANSPORT=http GRAPHITI_API_URL=http://localhost:8000 pnpm dev
```

Then test with curl:

```bash
# Health check
curl http://localhost:3000/health

# List tools
curl http://localhost:3000/debug/tools

# Call a tool (MCP protocol)
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "add_memory",
      "arguments": {
        "name": "Test",
        "content": "This is a test",
        "group_id": "test"
      }
    }
  }'
```

## Architecture

```
Claude Code/Desktop
    ↓ MCP Protocol (stdio)
NPX Package (@graphiti/mcp-http)
    ↓ HTTP REST API
FastAPI Server (../server)
    ↓
graphiti_core + Neo4j
```

## Troubleshooting

### "GRAPHITI_API_URL is required"
Make sure you set the `GRAPHITI_API_URL` environment variable.

### "API Error (404)"
Verify your FastAPI server is running at the specified URL.

### Claude can't see the tools
1. Restart Claude Desktop/Code
2. Check the logs (stderr output)
3. Verify your config file syntax

### Connection timeout
Increase `GRAPHITI_REQUEST_TIMEOUT` if your API is slow to respond.

## License

Apache-2.0

## Links

- [GraphiTi Core](https://github.com/getzep/graphiti)
- [Model Context Protocol](https://modelcontextprotocol.io)
- [Issues](https://github.com/ourines/graphiti/issues)
