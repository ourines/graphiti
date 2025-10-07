# 配置指南

## 配置文件位置

```
📁 Graphiti Project
├── .env                    ← 服务器配置 (Docker Compose)
│                             Neo4j, LLM, API认证
│
└── mcp-http-server/
    └── README.md           ← MCP服务器说明
```

## 快速配置

### 1. 服务器配置

**文件**: `.env` (从 `.env.example` 复制)

```bash
cp .env.example .env
```

**必填**:
```bash
NEO4J_PASSWORD=secure-password
GOOGLE_API_KEY=your-api-key
```

**可选（公网部署）**:
```bash
GRAPHITI_API_TOKEN=your-secure-token
```

### 2. 启动服务

```bash
docker-compose up -d
```

### 3. 使用MCP服务器

客户端通过 `X-GraphiTi-Token` header传递认证token：

```bash
curl -X POST http://localhost:3100/mcp \
  -H "Content-Type: application/json" \
  -H "X-GraphiTi-Token: your-api-token" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
```

## 配置详情

### 环境变量

| 变量 | 必填 | 说明 | 示例 |
|------|------|------|------|
| `NEO4J_PASSWORD` | ✅ | Neo4j密码 | `secure-password` |
| `GOOGLE_API_KEY` | ✅ | Google API Key | `AIza...` |
| `LLM_PROVIDER` | ⚠️ | LLM提供商 | `gemini` (默认) |
| `MODEL_NAME` | ⚠️ | 模型名称 | `gemini-2.5-flash` (默认) |
| `EMBEDDER_MODEL_NAME` | ⚠️ | Embedding模型 | `gemini-embedding-001` (默认) |
| `GRAPHITI_API_TOKEN` | ⚠️ | API认证token | `openssl rand -hex 32` |

### 生成安全密钥

```bash
# Neo4j密码
openssl rand -base64 24

# API Token (公网部署)
openssl rand -hex 32
```

## 认证方式

### MCP服务器认证 (默认启用)

**认证流程**：

```
MCP Client (ultrathink, Claude Desktop)
  ↓ X-GraphiTi-Token: your-graphiti-token
MCP HTTP Server (验证token是否存在)
  ✓ Token存在 → 转发请求
  ✗ Token缺失 → 返回401错误
  ↓ Authorization: Bearer your-graphiti-token
GraphiTi API (验证token有效性)
```

**安全性**：
- ✅ **默认启用认证** - 防止未授权访问MCP服务器
- ✅ **Token透传** - 客户端token直接传递给GraphiTi API
- ✅ **单点认证** - 只需配置一个GraphiTi API token

**配置选项**：

1. **生产环境**（推荐）- 要求认证：
   ```bash
   # docker-compose.yml 或 .env
   MCP_REQUIRE_AUTH=true  # 默认值
   ```

2. **本地开发**（仅限内网）- 可选认证：
   ```bash
   MCP_REQUIRE_AUTH=false  # 禁用认证检查
   ```

**MCP客户端配置** (`.mcp.json`):
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

**优势**:
- 防止未授权访问MCP端点
- 支持多租户（每个客户端使用自己的token）
- 无需额外的MCP服务器token
- Token验证由GraphiTi API统一处理

### 服务器级认证 (可选)

在 `.env` 中配置 `GRAPHITI_API_TOKEN`，所有请求使用同一token：

```bash
GRAPHITI_API_TOKEN=your-secure-token
```

**使用场景**:
- 单用户环境
- 需要API级别保护

## 服务端口

| 服务 | 端口 | 访问范围 |
|------|------|----------|
| Neo4j UI | 7474 | 仅本地 (127.0.0.1) |
| Neo4j Bolt | 7687 | 仅本地 (127.0.0.1) |
| GraphiTi API | 8000 | 公开 (0.0.0.0) |
| MCP HTTP Server | 3000 | 公开 (0.0.0.0) |

## 常见问题

**Q: 是否必须配置 `GRAPHITI_API_TOKEN`?**
- 本地开发: 可选
- 公网部署: 强烈推荐

**Q: 客户端如何传递token?**
- 通过 `X-GraphiTi-Token` HTTP header

**Q: 如何生成安全token?**
- `openssl rand -hex 32`

**Q: 支持哪些LLM提供商?**
- Gemini (推荐)
- OpenAI
- Anthropic
- Groq

## 相关文档

- [部署指南](./DEPLOYMENT.md)
- [MCP服务器说明](./mcp-http-server/README.md)
- [Docker Compose配置](./docker-compose.yml)
