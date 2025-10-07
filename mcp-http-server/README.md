# GraphiTi MCP HTTP Server

MCP server for GraphiTi knowledge graph with HTTP transport (Streamable HTTP).

## Quick Start

### 1. Configure Environment

Copy `.env.example` to `.env` in project root and configure:

```bash
# Required
NEO4J_PASSWORD=your_password
GOOGLE_API_KEY=your_api_key

# Optional
LLM_PROVIDER=gemini
MODEL_NAME=gemini-2.5-flash
EMBEDDER_MODEL_NAME=gemini-embedding-001
```

### 2. Deploy

From project root:

```bash
docker-compose up -d
```

Services:
- **Neo4j**: localhost:7474 (UI), localhost:7687 (Bolt)
- **GraphiTi API**: localhost:8000
- **MCP HTTP Server**: localhost:3100

### 3. Verify

```bash
curl http://localhost:3100/health
```

## Authentication

**默认启用认证保护** - MCP服务器要求客户端提供`X-GraphiTi-Token` header：

```bash
curl -X POST http://localhost:3100/mcp \
  -H "Content-Type: application/json" \
  -H "X-GraphiTi-Token: your-graphiti-api-token" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
```

**禁用认证**（仅用于本地开发）：

```bash
# 在 docker-compose.yml 或 .env 中设置
MCP_REQUIRE_AUTH=false
```

## MCP Client Configuration

For MCP clients (Claude Desktop, ultrathink, etc.), add to `.mcp.json`:

```json
{
  "mcpServers": {
    "graphiti-mcp": {
      "type": "http",
      "url": "http://127.0.0.1:3100/mcp",
      "headers": {
        "X-GraphiTi-Token": "your-graphiti-api-token"
      }
    }
  }
}
```

**Security Features**:
- ✅ **Authentication required by default** - Prevents unauthorized access
- ✅ **Token pass-through** - Client token forwarded to GraphiTi API
- ✅ **Single sign-on** - One token for both MCP and API access

**Protocol Features**:
- ✅ Standard MCP Streamable HTTP protocol (2024-11-05)
- ✅ Session management with automatic cleanup
- ✅ Client compatibility layer (auto-fixes Accept header)
- ✅ 25 Graphiti tools available

## Endpoints

- `POST /mcp` - MCP protocol endpoint
- `GET /health` - Health check
- `GET /debug/tools` - List tools

## Architecture

```
Client → MCP HTTP (port 3100) → GraphiTi API (port 8000) → Neo4j (port 7687)
```

Token flow: `X-GraphiTi-Token` → `Authorization: Bearer`

## Tech Stack

- Hono.js 4.9.9
- MCP SDK 1.19.1 (Streamable HTTP)
- Node.js 20-alpine
- pnpm

## Stop

```bash
docker-compose down
```
