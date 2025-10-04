# MCP Client Configuration Guide

## Where to Configure?

You have **2 options** for configuring the MCP client:

### Option 1: Claude Desktop Config (Recommended)

**File**: `~/.config/Claude/claude_desktop_config.json` (macOS/Linux) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows)

```json
{
  "mcpServers": {
    "graphiti": {
      "command": "npx",
      "args": ["-y", "@graphiti/mcp-http"],
      "env": {
        "GRAPHITI_API_URL": "http://127.0.0.1:8000",
        "GRAPHITI_API_TOKEN": "your-token-here"
      }
    }
  }
}
```

**Pros**:
- ✅ No need to create `.env` file
- ✅ Config stays with Claude Desktop
- ✅ Easy to update

### Option 2: Local .env File

**File**: `mcp-http-server/.env` (copy from `.env.example`)

```bash
GRAPHITI_API_URL=http://localhost:8000
GRAPHITI_API_TOKEN=your-token-here
```

**Then in Claude Desktop config**:
```json
{
  "mcpServers": {
    "graphiti": {
      "command": "node",
      "args": ["/path/to/mcp-http-server/dist/index.js"]
    }
  }
}
```

**Pros**:
- ✅ Separates config from Claude Desktop
- ✅ Easier for local development

---

## Required Settings

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `GRAPHITI_API_URL` | ✅ Yes | GraphiTi API server URL | `http://127.0.0.1:8000` |
| `GRAPHITI_API_TOKEN` | ⚠️ If auth enabled | Auth token (matches server's `API_AUTH_BEARER_TOKEN`) | `abc123...` |

## Optional Settings

| Variable | Default | Description |
|----------|---------|-------------|
| `GRAPHITI_DEFAULT_GROUP_ID` | `default` | Default project name |
| `LOG_LEVEL` | `info` | Log level (debug, info, warn, error) |
| `GRAPHITI_REQUEST_TIMEOUT` | `30000` | Request timeout in milliseconds |

---

## Common Scenarios

### Local Development (No Auth)
```json
{
  "env": {
    "GRAPHITI_API_URL": "http://127.0.0.1:8000"
  }
}
```

### Production Server (With Auth)
```json
{
  "env": {
    "GRAPHITI_API_URL": "https://api.example.com",
    "GRAPHITI_API_TOKEN": "your-secure-token-here"
  }
}
```

### Debug Mode
```json
{
  "env": {
    "GRAPHITI_API_URL": "http://127.0.0.1:8000",
    "LOG_LEVEL": "debug"
  }
}
```

---

## Server vs Client Configuration

**❌ DO NOT CONFUSE**:

- **Server config** (`.env` in project root):
  - For Docker Compose / GraphiTi API server
  - Contains: Neo4j, LLM provider, API authentication
  - Used by: `docker-compose up`

- **Client config** (`mcp-http-server/.env` or Claude Desktop):
  - For MCP client running on your local machine
  - Contains: API URL, auth token
  - Used by: Claude Desktop / `npx graphiti-mcp`

---

## Troubleshooting

### "Connection refused" error
- ✅ Check `GRAPHITI_API_URL` is correct
- ✅ Ensure GraphiTi server is running (`docker-compose up`)

### "Invalid token" error
- ✅ Check `GRAPHITI_API_TOKEN` matches server's `API_AUTH_BEARER_TOKEN`
- ✅ Ensure server has `API_AUTH_ENABLED=true`

### "No results found" error
- ✅ Use `list_groups` to see available projects
- ✅ Check you're searching in the correct `group_id`
