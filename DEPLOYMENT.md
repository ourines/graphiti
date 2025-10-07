# GraphiTi 部署指南

简化的Docker Compose部署方案。

## 快速部署

### 1. 配置环境变量

```bash
cp .env.example .env
```

编辑 `.env`：

```bash
# 必填
NEO4J_PASSWORD=$(openssl rand -base64 24)
GOOGLE_API_KEY=your_google_api_key

# 选填
LLM_PROVIDER=gemini
MODEL_NAME=gemini-2.5-flash
EMBEDDER_MODEL_NAME=gemini-embedding-001

# 公网部署需启用
GRAPHITI_API_TOKEN=$(openssl rand -hex 32)
```

### 2. 启动服务

```bash
docker-compose up -d
```

### 3. 验证

```bash
# 检查服务状态
docker-compose ps

# 健康检查
curl http://localhost:8000/healthcheck
curl http://localhost:3100/health
```

## 服务端口

- **Neo4j**: 127.0.0.1:7474 (UI), 127.0.0.1:7687 (Bolt)
- **GraphiTi API**: 0.0.0.0:8000
- **MCP HTTP Server**: 0.0.0.0:3000

## 认证说明

### 客户端传递Token

MCP服务器支持客户端通过 `X-GraphiTi-Token` header传递认证token：

```bash
curl -X POST http://localhost:3100/mcp \
  -H "Content-Type: application/json" \
  -H "X-GraphiTi-Token: your-api-token" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
```

Token会被自动转换为 `Authorization: Bearer` 并传递给GraphiTi API。

### 服务器级认证（可选）

如果需要服务器级别的API认证保护，在 `.env` 中配置：

```bash
GRAPHITI_API_TOKEN=your_secure_token
```

## 公网部署

### HTTPS反向代理

**Caddy (推荐):**
```
api.your-domain.com {
    reverse_proxy localhost:8000
}

mcp.your-domain.com {
    reverse_proxy localhost:3100
}
```

**Nginx:**
```nginx
server {
    listen 443 ssl http2;
    server_name api.your-domain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### 安全检查清单

- [ ] 设置 `GRAPHITI_API_TOKEN`
- [ ] 使用 HTTPS
- [ ] Neo4j仅本地访问 (127.0.0.1)
- [ ] `.env` 不提交到git
- [ ] 定期更新密钥

## 常见问题

**401 Unauthorized**
- 检查 `Authorization: Bearer <token>` header格式
- 确认token与 `.env` 中的 `GRAPHITI_API_TOKEN` 一致

**服务启动失败**
- 检查端口是否被占用: `lsof -i :3000,8000,7474,7687`
- 查看日志: `docker-compose logs`

**无法连接GraphiTi API**
- 确认API服务运行: `docker-compose ps`
- 检查防火墙规则

## 停止服务

```bash
docker-compose down
```

## 架构

```
Client
  ↓ X-GraphiTi-Token header
MCP HTTP Server (port 3100)
  ↓ Authorization: Bearer token
GraphiTi API (port 8000)
  ↓
Neo4j (port 7687)
```
