# GraphiTi MCP HTTP Server 部署指南

## 🎯 两种部署模式

### 模式1: stdio (本地 - Claude Desktop)
- **用途**: Claude Desktop本地调用
- **传输**: stdin/stdout
- **配置**: `MCP_TRANSPORT=stdio`

### 模式2: Streamable HTTP (远程服务器)
- **用途**: 远程部署，多客户端访问
- **传输**: Streamable HTTP (MCP 2025-03-26)
- **配置**: `MCP_TRANSPORT=http`

---

## 📋 本地模式 (stdio)

### Claude Desktop配置

```json
{
  "mcpServers": {
    "graphiti": {
      "command": "node",
      "args": ["/path/to/mcp-http-server/dist/index.js"],
      "env": {
        "MCP_TRANSPORT": "stdio",
        "GRAPHITI_API_URL": "http://127.0.0.1:8000",
        "GRAPHITI_API_TOKEN": "your-token-here"
      }
    }
  }
}
```

**优点**:
- ✅ 无需网络配置
- ✅ 安全性高
- ✅ 延迟低

**缺点**:
- ❌ 仅限本地使用
- ❌ 每个客户端需要独立进程

---

## 🌐 HTTP服务器模式

### 1. 环境配置

创建 `.env.http`:

```bash
# Transport模式
MCP_TRANSPORT=http
MCP_HOST=0.0.0.0
MCP_PORT=3000

# GraphiTi API (可以是远程地址)
GRAPHITI_API_URL=http://localhost:8000
GRAPHITI_API_TOKEN=your-secure-token

# 可选配置
GRAPHITI_DEFAULT_GROUP_ID=default
LOG_LEVEL=info
GRAPHITI_REQUEST_TIMEOUT=30000
```

### 2. 启动服务器

**方式A: 直接运行**
```bash
cd mcp-http-server
cp .env.http .env
pnpm build
node dist/index.js
```

**方式B: Docker Compose（推荐）**
```bash
# 从项目根目录启动完整堆栈
docker-compose up -d

# 查看MCP服务日志
docker-compose logs -f mcp-http-server
```

### 3. 验证服务

```bash
# 健康检查
curl http://localhost:3000/health

# 查看可用工具
curl http://localhost:3000/debug/tools

# MCP协议测试
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
```

### 4. 客户端连接

MCP客户端需要使用Streamable HTTP传输：

```typescript
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const transport = new StreamableHTTPClientTransport(
  new URL('http://localhost:3000/mcp')
);
```

**Claude Desktop配置** (使用HTTP):
```json
{
  "mcpServers": {
    "graphiti": {
      "url": "http://localhost:3000/mcp"
    }
  }
}
```

---

## 🐳 Docker部署

### 构建镜像

```bash
docker build -t graphiti-mcp-server .
```

### 运行容器

```bash
docker run -d \
  -p 3000:3000 \
  -e MCP_TRANSPORT=http \
  -e GRAPHITI_API_URL=http://host.docker.internal:8000 \
  -e GRAPHITI_API_TOKEN=your-token \
  --name graphiti-mcp \
  graphiti-mcp-server
```

### Docker Compose

```yaml
services:
  graphiti-mcp-server:
    build: .
    ports:
      - "3000:3000"
    environment:
      - MCP_TRANSPORT=http
      - GRAPHITI_API_URL=http://graphiti-api:8000
      - GRAPHITI_API_TOKEN=${GRAPHITI_API_TOKEN}
    restart: unless-stopped
```

---

## 🔌 API端点

### POST /mcp
MCP协议端点（Streamable HTTP），处理所有MCP JSON-RPC请求。

**请求**:
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/list"
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

### GET /health
健康检查端点。

**响应**:
```json
{
  "status": "ok",
  "backend": {
    "url": "http://localhost:8000",
    "healthy": true,
    "latency": 15
  },
  "server": {
    "transport": "sse",
    "port": 3000,
    "uptime": 1234,
    "activeConnections": 2
  }
}
```

### GET /debug/tools
列出所有可用的MCP工具。

---

## 🔒 安全配置

### 1. 认证

确保设置了`GRAPHITI_API_TOKEN`以连接到受保护的GraphiTi API。

### 2. HTTPS

生产环境建议使用反向代理（Nginx/Caddy）启用HTTPS:

```nginx
server {
    listen 443 ssl http2;
    server_name mcp.yourdomain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 3. CORS

如果需要从浏览器访问，配置CORS头部。

---

## 📊 监控

### 日志级别

```bash
LOG_LEVEL=debug  # debug, info, warn, error
```

### 健康检查

定期检查 `/health` 端点确保服务正常。

### 活跃连接

通过健康检查响应中的 `activeConnections` 监控当前连接数。

---

## 🔧 故障排查

### 问题1: MCP连接失败

**检查**:
```bash
curl -v -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
```

**常见原因**:
- 端口未开放
- 防火墙阻止
- 反向代理配置错误

### 问题2: 后端连接失败

**检查后端状态**:
```bash
curl http://localhost:8000/healthcheck
```

**验证token**:
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
     http://localhost:8000/search
```

### 问题3: JSON-RPC错误

**检查请求格式**:
- 确保Content-Type是application/json
- 验证JSON-RPC请求格式正确
- 检查method和params是否有效

---

## 📚 完整示例

### 部署到云服务器

```bash
# 1. SSH到服务器
ssh user@your-server.com

# 2. 克隆代码
git clone https://github.com/getzep/graphiti.git
cd graphiti/mcp-http-server

# 3. 配置环境
cat > .env << EOF
MCP_TRANSPORT=http
MCP_HOST=0.0.0.0
MCP_PORT=3000
GRAPHITI_API_URL=https://your-graphiti-api.com
GRAPHITI_API_TOKEN=$(openssl rand -hex 32)
EOF

# 4. 使用Docker启动
docker-compose up -d

# 5. 验证
curl http://localhost:3000/health
```

### 本地Claude Desktop使用

```json
{
  "mcpServers": {
    "graphiti-local": {
      "command": "node",
      "args": ["/Users/you/graphiti/mcp-http-server/dist/index.js"],
      "env": {
        "MCP_TRANSPORT": "stdio",
        "GRAPHITI_API_URL": "http://127.0.0.1:8000",
        "GRAPHITI_API_TOKEN": "your-local-token"
      }
    }
  }
}
```

---

## 🚀 升级到Streamable HTTP

当SDK升级到1.10.0+时，可以迁移到Streamable HTTP:

```bash
# 升级SDK
pnpm add @modelcontextprotocol/sdk@latest

# 代码中替换
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
```

Streamable HTTP的优势:
- ✅ 单一端点 (`/mcp`)
- ✅ 更好的性能
- ✅ 标准化协议
- ✅ 向后兼容

---

**配置完成！** 🎉

选择适合你的部署模式：
- **本地开发**: stdio模式
- **团队共享**: HTTP/SSE模式
- **生产环境**: Docker + HTTPS
