# GraphiTi MCP - 简化部署指南

## 架构说明

```
┌─────────────────┐         HTTP          ┌──────────────────┐
│   你的电脑       │  ─────────────────>  │   服务器         │
│                 │                       │                  │
│  npx            │  <─────────────────  │  GraphiTi API    │
│  @graphiti/     │         JSON          │  + Neo4j         │
│  mcp-http       │                       │                  │
└─────────────────┘                       └──────────────────┘
```

**服务器**：运行 GraphiTi + Neo4j（数据处理和存储）
**客户端**：通过 `npx` 命令连接服务器（无需安装 Neo4j）

---

## 服务器部署

### 在你的服务器上运行

```bash
# 1. 克隆仓库
git clone https://github.com/getzep/graphiti.git
cd graphiti

# 2. 一键部署
./deploy.sh
```

脚本会提示你选择：
- **LLM Provider**: Gemini（默认）、OpenAI、Anthropic、Groq
- **API Key**: 对应的 API Key
- **模型**: 可选择具体模型

### 配置示例（.env.prod）

```bash
# LLM Provider
LLM_PROVIDER=gemini

# Gemini（默认）
GOOGLE_API_KEY=your-google-api-key
GEMINI_MODEL=gemini-2.5-flash

# OpenAI（可选）
OPENAI_API_KEY=your-openai-key

# Neo4j
NEO4J_PASSWORD=auto-generated
```

### 验证服务

```bash
# 检查 API
curl http://localhost:8000/healthcheck

# 查看 API 文档
open http://localhost:8000/docs

# 查看 Neo4j
open http://localhost:7474
```

---

## 客户端配置

### Claude Desktop

编辑 `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "graphiti": {
      "command": "npx",
      "args": ["-y", "@graphiti/mcp-http"],
      "env": {
        "GRAPHITI_API_URL": "http://your-server:8000"
      }
    }
  }
}
```

重启 Claude Desktop 即可使用！

---

## 支持的 LLM Provider

| Provider | 配置变量 | 默认模型 |
|----------|---------|----------|
| **Gemini** | `GOOGLE_API_KEY` | `gemini-2.5-flash` |
| OpenAI | `OPENAI_API_KEY` | `gpt-4o` |
| Anthropic | `ANTHROPIC_API_KEY` | `claude-3-5-sonnet-20241022` |
| Groq | `GROQ_API_KEY` | `llama-3.3-70b-versatile` |

---

## 常用命令

```bash
# 查看服务状态
docker-compose -f docker-compose.prod.yml ps

# 查看日志
docker-compose -f docker-compose.prod.yml logs -f

# 重启服务
docker-compose -f docker-compose.prod.yml restart

# 停止服务
docker-compose -f docker-compose.prod.yml down

# 更新服务
git pull && ./deploy.sh
```

---

## 为什么简化了？

### 之前的架构（3 个服务）

```
客户端 → mcp-server (Docker) → graphiti-api → neo4j
```

**问题**：
- ❌ mcp-server 在服务器上没用（Claude Desktop 用 STDIO）
- ❌ 多一层代理降低性能
- ❌ 配置复杂

### 现在的架构（2 个服务）

```
客户端 (npx @graphiti/mcp-http) → graphiti-api → neo4j
```

**优点**：
- ✅ 客户端直接连接 API
- ✅ 减少一层代理
- ✅ 配置简单
- ✅ 性能更好

---

## 为什么从源码构建？

### 之前用 Docker 镜像

```yaml
graphiti-api:
  image: zepai/graphiti:latest  # 预构建镜像
```

**问题**：
- ❌ 只支持 OpenAI
- ❌ 无法自定义 LLM provider
- ❌ 无法修改配置

### 现在从源码构建

```yaml
graphiti-api:
  build:
    context: .
    dockerfile: server/Dockerfile  # 从源码构建
  environment:
    - LLM_PROVIDER=gemini  # 可自定义
```

**优点**：
- ✅ 支持 4 种 LLM provider（Gemini、OpenAI、Anthropic、Groq）
- ✅ 可自定义模型和参数
- ✅ 灵活配置

---

## 故障排查

### API 连接失败

```bash
# 检查服务状态
docker-compose -f docker-compose.prod.yml ps

# 查看日志
docker-compose -f docker-compose.prod.yml logs graphiti-api

# 测试连接
curl http://localhost:8000/healthcheck
```

### Gemini API 错误

```bash
# 检查 API Key
echo $GOOGLE_API_KEY

# 测试 Gemini API
curl -H "Content-Type: application/json" \
  -d '{"contents":[{"parts":[{"text":"Hello"}]}]}' \
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=$GOOGLE_API_KEY"
```

### 切换 LLM Provider

```bash
# 编辑配置
nano .env.prod

# 修改 LLM_PROVIDER
LLM_PROVIDER=openai
OPENAI_API_KEY=your-key

# 重启服务
docker-compose -f docker-compose.prod.yml restart
```

---

## 总结

### 服务器端（一次性）

```bash
cd graphiti
./deploy.sh  # 选择 Gemini，输入 API Key
```

### 客户端（Claude Desktop）

```json
{
  "mcpServers": {
    "graphiti": {
      "command": "npx",
      "args": ["-y", "@graphiti/mcp-http"],
      "env": {
        "GRAPHITI_API_URL": "http://your-server:8000"
      }
    }
  }
}
```

完成！🎉
