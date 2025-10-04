# GraphiTi MCP HTTP Server

## 🎯 快速开始

### 两种使用模式

#### 1. stdio模式（本地 - Claude Desktop）
```bash
export MCP_TRANSPORT=stdio
export GRAPHITI_API_URL=http://localhost:8000
export GRAPHITI_API_TOKEN=your-token
node dist/index.js
```

#### 2. HTTP模式（远程服务器）
```bash
export MCP_TRANSPORT=http
export MCP_HOST=0.0.0.0
export MCP_PORT=3000
export GRAPHITI_API_URL=http://localhost:8000
export GRAPHITI_API_TOKEN=your-token
node dist/index.js
```

## 📡 MCP端点规范

### POST /mcp
**用途**: MCP协议端点（Streamable HTTP）

**请求头**:
```
Content-Type: application/json
```

**请求**:
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/list",
  "params": {}
}
```

**响应**:
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "tools": [...]
  }
}
```

## 🔧 测试

### 使用 Docker Compose（推荐）

```bash
# 从项目根目录启动所有服务
docker-compose up -d

# 查看MCP服务日志
docker-compose logs -f mcp-http-server

# 停止所有服务
docker-compose down
```

### 手动测试

1. **启动HTTP服务器**:
```bash
cd mcp-http-server
pnpm install
pnpm build
cp .env.http .env
node dist/index.js
```

2. **测试MCP端点**:
```bash
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
```

3. **健康检查**:
```bash
curl http://localhost:3000/health | jq
```

## 🐳 Docker部署

### 使用主docker-compose.yml（推荐）

```bash
# 从项目根目录启动完整堆栈
docker-compose up -d

# 服务包括：
# - neo4j: 图数据库
# - graphiti-api: GraphiTi REST API
# - mcp-http-server: MCP HTTP服务器
```

### 单独构建和运行

```bash
# 构建（从项目根目录）
docker build -t graphiti-mcp-http -f mcp-http-server/Dockerfile .

# 运行
docker run -d -p 3000:3000 \
  -e MCP_TRANSPORT=http \
  -e GRAPHITI_API_URL=http://host.docker.internal:8000 \
  -e GRAPHITI_API_TOKEN=your-token \
  graphiti-mcp-http
```

## 📋 环境变量

| 变量 | 必须 | 默认值 | 说明 |
|------|------|--------|------|
| `MCP_TRANSPORT` | ✅ | `stdio` | 传输模式: stdio 或 http |
| `MCP_HOST` | ❌ | `localhost` | HTTP监听地址 |
| `MCP_PORT` | ❌ | `3000` | HTTP监听端口 |
| `GRAPHITI_API_URL` | ✅ | - | GraphiTi API地址 |
| `GRAPHITI_API_TOKEN` | ❌ | - | API认证Token（可选，推荐客户端透传） |
| `LOG_LEVEL` | ❌ | `info` | 日志级别 |

## 🔐 Token认证

支持两种方式：

### 方式1: 客户端透传（推荐）

客户端通过 `X-GraphiTi-Token` header传递token：

```bash
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "X-GraphiTi-Token: your-token-here" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
```

**优点**:
- ✅ 支持多租户（不同客户端用不同token）
- ✅ 无需在服务器配置
- ✅ 更安全（token不存储在服务器）

### 方式2: 服务器端配置

通过环境变量配置默认token：

```bash
export GRAPHITI_API_TOKEN=your-token
```

**优先级**: 客户端header > 服务器环境变量

详见 [TOKEN_PASSTHROUGH.md](./TOKEN_PASSTHROUGH.md)

## 🔌 客户端集成

### TypeScript/JavaScript (SDK 1.19.1+)

```typescript
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';

// 使用客户端透传token
const transport = new StreamableHTTPClientTransport(
  new URL('http://localhost:3000/mcp'),
  {
    headers: {
      'X-GraphiTi-Token': 'your-graphiti-api-token'
    }
  }
);

const client = new Client({
  name: 'graphiti-client',
  version: '1.0.0'
}, {
  capabilities: {}
});

await client.connect(transport);

// 列出工具
const tools = await client.request({
  method: 'tools/list'
}, {});

console.log(tools);
```

### Python (SDK 1.1.0+)

```python
from mcp import ClientSession
from mcp.client.streamable_http import StreamableHTTPClientTransport
import asyncio

async def main():
    transport = StreamableHTTPClientTransport(
        url="http://localhost:3000/mcp",
        headers={
            "X-GraphiTi-Token": "your-graphiti-api-token"
        }
    )
    async with ClientSession(transport) as session:
        tools = await session.list_tools()
        print(tools)

asyncio.run(main())
```

### Claude Desktop

```json
{
  "mcpServers": {
    "graphiti": {
      "url": "http://localhost:3000/mcp"
    }
  }
}
```

## 📚 更多文档

- [HTTP服务器完整指南](./HTTP_SERVER_GUIDE.md)
- [认证配置](./AUTH.md)
- [配置说明](./CONFIG.md)

## ✅ 验证

所有测试通过后，你应该看到：

```
✓ 服务正在运行
✓ 后端GraphiTi API连接正常
✓ 活跃MCP连接: 0
✓ 可用工具数量: 20+
✓ 传输协议: streamable-http
```

---

**技术栈**:
- MCP SDK 1.19.1+ with Streamable HTTP transport
- MCP Specification 2025-03-26
- Node.js 20+ with Hono.js (轻量高性能框架)
