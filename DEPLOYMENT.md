# GraphiTi 公网部署指南

本指南帮助你安全地将 GraphiTi API 部署到公网。

## 📋 目录

- [架构说明](#架构说明)
- [部署步骤](#部署步骤)
- [安全配置](#安全配置)
- [客户端配置](#客户端配置)
- [故障排查](#故障排查)

## 🏗️ 架构说明

```
┌─────────────────┐
│  Claude Desktop │  (本地)
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│ mcp-http-server │  (本地客户端)
└────────┬────────┘
         │ HTTPS + Bearer Token
         ↓
┌─────────────────┐
│  graphiti-api   │  (公网服务器，需要认证保护)
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│     Neo4j       │  (内部数据库)
└─────────────────┘
```

**关键点：**
- ✅ `graphiti-api` 是公网暴露的，**必须启用认证**
- ✅ `mcp-http-server` 是本地客户端，不需要认证
- ✅ Neo4j 仅内部访问（127.0.0.1）

## 🚀 部署步骤

### 1. 生成安全密钥

```bash
# 生成 Neo4j 密码
export NEO4J_PASSWORD=$(openssl rand -base64 24)
echo "NEO4J_PASSWORD=$NEO4J_PASSWORD"

# 生成 API Bearer Token
export API_AUTH_BEARER_TOKEN=$(openssl rand -hex 32)
echo "API_AUTH_BEARER_TOKEN=$API_AUTH_BEARER_TOKEN"
```

### 2. 配置环境变量

创建 `.env` 文件（从 `.env.example` 复制）：

```bash
cp .env.example .env
```

编辑 `.env` 文件，**必须配置**：

```bash
# Neo4j 密码
NEO4J_PASSWORD=<上面生成的密码>

# LLM Provider
LLM_PROVIDER=gemini
GOOGLE_API_KEY=<你的 Gemini API Key>

# 🔒 API 认证（公网必须启用）
API_AUTH_ENABLED=true
API_AUTH_METHOD=bearer
API_AUTH_BEARER_TOKEN=<上面生成的 token>
```

### 3. 启动服务

```bash
# 构建并启动
docker-compose up -d

# 查看日志（确认认证已启用）
docker-compose logs graphiti-api
```

你应该看到：
```
🔒 API Authentication enabled: bearer method
📋 Public endpoints: /healthcheck,/docs,/openapi.json
```

### 4. 测试认证

```bash
# 测试公共端点（无需认证）
curl http://localhost:8000/healthcheck

# 测试受保护端点（需要认证）
curl http://localhost:8000/retrieve/search \
  -H "Authorization: Bearer your-token" \
  -H "Content-Type: application/json" \
  -d '{"query":"test"}'

# 无认证应该返回 401
curl http://localhost:8000/retrieve/search
```

### 5. 配置反向代理（生产环境）

使用 Nginx 或 Caddy 添加 HTTPS：

**Nginx 示例：**
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
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

**Caddy 示例（更简单）：**
```
api.your-domain.com {
    reverse_proxy localhost:8000
}
```

## 🔒 安全配置

### 认证方法选择

#### Bearer Token（推荐）

**优点：**
- ✅ OAuth 2.1 标准
- ✅ 更安全
- ✅ 支持 token 过期和刷新

**配置：**
```bash
API_AUTH_ENABLED=true
API_AUTH_METHOD=bearer
API_AUTH_BEARER_TOKEN=<32字节十六进制>
```

**客户端使用：**
```bash
curl -H "Authorization: Bearer your-token" https://api.example.com/endpoint
```

#### API Key（简化版）

**优点：**
- ✅ 配置简单
- ✅ 易于理解

**缺点：**
- ❌ 不支持过期
- ❌ 不是标准协议

**配置：**
```bash
API_AUTH_ENABLED=true
API_AUTH_METHOD=apikey
API_AUTH_API_KEY=<32字节十六进制>
```

**客户端使用：**
```bash
curl -H "X-API-Key: your-key" https://api.example.com/endpoint
```

### 公共端点配置

默认公共端点（无需认证）：
- `/healthcheck` - 健康检查
- `/docs` - Swagger UI
- `/openapi.json` - OpenAPI 规范

自定义公共端点：
```bash
API_AUTH_PUBLIC_ENDPOINTS=/healthcheck,/docs,/openapi.json,/metrics
```

## 💻 客户端配置

### 本地 MCP 客户端配置

编辑 `mcp-http-server/.env`：

```bash
# API 地址（使用 HTTPS）
GRAPHITI_API_URL=https://api.your-domain.com

# 认证 Header（与服务器的 API_AUTH_BEARER_TOKEN 一致）
GRAPHITI_API_HEADERS={"Authorization":"Bearer your-secure-bearer-token"}

# 或使用简化格式
# GRAPHITI_API_HEADERS=Authorization:Bearer your-secure-bearer-token
```

### Python 客户端示例

```python
import requests

# 配置
API_URL = "https://api.your-domain.com"
BEARER_TOKEN = "your-secure-bearer-token"

# 请求
headers = {
    "Authorization": f"Bearer {BEARER_TOKEN}",
    "Content-Type": "application/json"
}

response = requests.post(
    f"{API_URL}/retrieve/search",
    headers=headers,
    json={"query": "test", "group_ids": ["default"]}
)

print(response.json())
```

### JavaScript/TypeScript 客户端

```typescript
const API_URL = "https://api.your-domain.com";
const BEARER_TOKEN = "your-secure-bearer-token";

const response = await fetch(`${API_URL}/retrieve/search`, {
  method: "POST",
  headers: {
    "Authorization": `Bearer ${BEARER_TOKEN}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    query: "test",
    group_ids: ["default"],
  }),
});

const data = await response.json();
console.log(data);
```

## 🔧 故障排查

### 问题 1: 401 Unauthorized

**症状：**
```json
{"detail": "Missing Authorization header"}
```

**解决：**
- 检查是否添加了 `Authorization` header
- 确认 header 格式：`Authorization: Bearer <token>`
- Bearer 和 token 之间有空格

### 问题 2: Invalid bearer token

**症状：**
```json
{"detail": "Invalid bearer token"}
```

**解决：**
- 检查 token 是否与服务器配置一致
- 确认 `.env` 文件中的 `API_AUTH_BEARER_TOKEN`
- 重启服务加载新配置：`docker-compose restart graphiti-api`

### 问题 3: 认证未启用

**症状：**
日志中看到：
```
⚠️  API Authentication disabled - not recommended for public deployment
```

**解决：**
- 确认 `.env` 中设置了 `API_AUTH_ENABLED=true`
- 重启服务：`docker-compose restart graphiti-api`

### 问题 4: CORS 错误

**症状：**
浏览器控制台显示 CORS 错误

**解决：**
在 `server/graph_service/main.py` 添加 CORS 中间件：

```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://your-frontend-domain.com"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

## 📊 监控和日志

### 查看认证日志

```bash
# 实时日志
docker-compose logs -f graphiti-api

# 认证相关日志
docker-compose logs graphiti-api | grep -i auth
```

### 健康检查

```bash
# 服务健康状态
docker-compose ps

# API 健康检查（公共端点）
curl https://api.your-domain.com/healthcheck
```

## 🔐 安全最佳实践

### 部署前检查清单

- [ ] ✅ `API_AUTH_ENABLED=true`
- [ ] ✅ 使用 `openssl rand -hex 32` 生成 token
- [ ] ✅ 使用 HTTPS（不要用 HTTP）
- [ ] ✅ Neo4j 端口仅本地访问（127.0.0.1）
- [ ] ✅ 配置防火墙规则
- [ ] ✅ `.env` 文件不提交到 git
- [ ] ✅ 定期轮换 token（建议每3个月）
- [ ] ✅ 监控认证失败日志
- [ ] ✅ 限制 API 请求速率（使用 Nginx/Caddy）

### 密钥管理

**不要：**
- ❌ 将 `.env` 提交到 git
- ❌ 在代码中硬编码 token
- ❌ 通过 email/聊天分享 token
- ❌ 使用弱密码或简单 token

**应该：**
- ✅ 使用环境变量
- ✅ 使用密钥管理工具（如 AWS Secrets Manager）
- ✅ 定期轮换密钥
- ✅ 限制 token 权限和范围

## 📚 相关文档

- [Docker Compose 配置](./docker-compose.yml)
- [环境变量示例](./.env.example)
- [MCP 客户端配置](./mcp-http-server/.env.example)
- [FastAPI 认证中间件](./server/graph_service/auth_middleware.py)

## 🆘 获取帮助

遇到问题？
1. 检查本文档的故障排查部分
2. 查看服务日志：`docker-compose logs graphiti-api`
3. 在 GitHub 上提 issue

---

**重要提醒：公网部署必须启用认证！** 🔒
