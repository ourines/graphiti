# GraphiTi 本地测试指南

完整的本地测试流程，从零到完整验证 mcp-http-server 功能。

---

## 方案 A: 一键测试脚本（推荐）

### 1. 运行测试脚本

```bash
./test-local.sh
```

脚本会自动：
- ✅ 检测并创建 `.env.prod`（如果不存在）
- ✅ 提示输入 Google API Key
- ✅ 自动生成 Neo4j 密码
- ✅ 启动 Docker 服务
- ✅ 等待服务就绪
- ✅ 显示连接信息

### 2. 验证服务

```bash
# 测试 API 健康状态
curl http://localhost:8000/healthcheck

# 查看 API 文档
open http://localhost:8000/docs

# 查看 Neo4j（可选）
open http://localhost:7474
```

### 3. 测试 mcp-http-server

```bash
cd mcp-http-server

# 安装依赖（首次）
pnpm install

# 启动开发模式
GRAPHITI_API_URL=http://localhost:8000 pnpm dev
```

**成功标志**：
```
[INFO] ============================================================
[INFO] GraphiTi MCP Server
[INFO] ============================================================
[INFO] Version: 0.1.0
[INFO] Transport: stdio
[INFO] GraphiTi API: http://localhost:8000
[INFO] ============================================================
[INFO] GraphiTi API health check passed (123ms)
[INFO] MCP server running on stdio
```

---

## 方案 B: 手动测试（完整步骤）

### Step 1: 准备环境变量

```bash
# 创建 .env.prod
cat > .env.prod << 'EOF'
LLM_PROVIDER=gemini
GOOGLE_API_KEY=your-google-api-key-here
MODEL_NAME=gemini-2.5-flash
EMBEDDER_MODEL_NAME=gemini-embedding-001
MAX_TOKENS=64000
OPENAI_API_KEY=
NEO4J_PASSWORD=your-secure-password-here
EOF
```

**获取 Google API Key**:
1. 访问 https://makersuite.google.com/app/apikey
2. 创建 API Key
3. 替换 `your-google-api-key-here`

### Step 2: 启动服务器

```bash
# 启动 Docker 服务
docker-compose -f docker-compose.prod.yml up -d

# 查看日志
docker-compose -f docker-compose.prod.yml logs -f
```

**等待服务就绪**（约 30-60 秒）:
```bash
# 持续测试直到成功
while ! curl -s http://localhost:8000/healthcheck > /dev/null; do
    echo "等待 API 启动..."
    sleep 2
done
echo "✅ API 就绪"
```

### Step 3: 验证 GraphiTi API

#### 3.1 健康检查

```bash
curl http://localhost:8000/healthcheck
```

**期望输出**:
```json
{"status":"healthy"}
```

#### 3.2 查看 API 文档

```bash
# 打开浏览器
open http://localhost:8000/docs
```

#### 3.3 测试添加记忆

```bash
curl -X POST http://localhost:8000/add_episode \
  -H "Content-Type: application/json" \
  -d '{
    "name": "test_memory",
    "content": "这是一个测试记忆",
    "group_id": "test_group"
  }'
```

**期望输出**（JSON 包含 episode、nodes、edges）:
```json
{
  "episode": {
    "uuid": "...",
    "name": "test_memory",
    "content": "这是一个测试记忆",
    ...
  },
  "nodes": [...],
  "edges": [...]
}
```

#### 3.4 测试搜索记忆

```bash
curl -X POST http://localhost:8000/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "测试",
    "group_ids": ["test_group"]
  }'
```

### Step 4: 测试 mcp-http-server

#### 4.1 准备 mcp-http-server

```bash
cd mcp-http-server

# 安装依赖
pnpm install

# 构建（可选）
pnpm build
```

#### 4.2 测试 STDIO 模式（推荐）

```bash
# 方式 1: 使用 pnpm dev
GRAPHITI_API_URL=http://localhost:8000 \
LOG_LEVEL=debug \
pnpm dev
```

**期望输出**:
```
[INFO] ============================================================
[INFO] GraphiTi MCP Server
[INFO] ============================================================
[INFO] Version: 0.1.0
[INFO] Transport: stdio
[INFO] GraphiTi API: http://localhost:8000
[INFO] Log Level: debug
[INFO] ============================================================
[DEBUG] Checking GraphiTi API health
[INFO] GraphiTi API health check passed (123ms)
[INFO] MCP server running on stdio
```

**成功标志**:
- ✅ 没有错误日志
- ✅ 显示 "GraphiTi API health check passed"
- ✅ 显示 "MCP server running on stdio"

#### 4.3 测试 HTTP 模式（调试用）

```bash
# 启动 HTTP 模式
MCP_TRANSPORT=http \
MCP_PORT=3000 \
GRAPHITI_API_URL=http://localhost:8000 \
LOG_LEVEL=debug \
pnpm dev
```

**测试 HTTP 端点**:

```bash
# 1. 健康检查
curl http://localhost:3000/health

# 2. 列出工具
curl http://localhost:3000/debug/tools

# 3. 调用工具（add_memory）
curl -X POST http://localhost:3000/debug/call \
  -H "Content-Type: application/json" \
  -d '{
    "name": "add_memory",
    "arguments": {
      "name": "test_via_http",
      "content": "通过 HTTP 测试添加记忆",
      "group_id": "test_http"
    }
  }'
```

### Step 5: 集成到 Claude Desktop

#### 5.1 配置 Claude Desktop

编辑配置文件：

**macOS**:
```bash
nano ~/Library/Application\ Support/Claude/claude_desktop_config.json
```

**Windows**:
```
%APPDATA%\Claude\claude_desktop_config.json
```

**配置内容**:
```json
{
  "mcpServers": {
    "graphiti": {
      "command": "npx",
      "args": ["-y", "@graphiti/mcp-http"],
      "env": {
        "GRAPHITI_API_URL": "http://localhost:8000",
        "GRAPHITI_DEFAULT_GROUP_ID": "claude_test",
        "LOG_LEVEL": "info"
      }
    }
  }
}
```

#### 5.2 重启 Claude Desktop

完全退出并重新启动 Claude Desktop。

#### 5.3 验证工具可用

在 Claude Desktop 中输入：

```
请列出你可以使用的工具
```

**期望响应**:
Claude 应该列出以下工具：
- ✅ `add_memory` - 添加记忆
- ✅ `search_memory` - 搜索记忆
- ✅ `get_episodes` - 获取历史
- ✅ `delete_episode` - 删除记忆
- ✅ `clear_graph` - 清空图谱

#### 5.4 功能测试

**测试 1: 添加记忆**
```
请帮我记住：我喜欢使用 Gemini 作为 LLM，因为它速度快且成本低
```

**测试 2: 搜索记忆**
```
我之前说过我喜欢什么 LLM？
```

**测试 3: 查看历史**
```
显示最近的 5 条记忆
```

---

## 故障排查

### 问题 1: API 连接失败

**症状**:
```
[ERROR] GraphiTi API at http://localhost:8000 is not responding
```

**解决**:
```bash
# 检查服务状态
docker-compose -f docker-compose.prod.yml ps

# 查看 API 日志
docker-compose -f docker-compose.prod.yml logs graphiti-api

# 测试 API 可达性
curl http://localhost:8000/healthcheck
```

### 问题 2: Gemini API 错误

**症状**:
```
[ERROR] Failed to generate response: Invalid API key
```

**解决**:
```bash
# 检查 API Key
source .env.prod
echo $GOOGLE_API_KEY

# 测试 Gemini API
curl -H "Content-Type: application/json" \
  -d '{"contents":[{"parts":[{"text":"Hello"}]}]}' \
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=$GOOGLE_API_KEY"
```

### 问题 3: mcp-http-server 无法启动

**症状**:
```
Error: GRAPHITI_API_URL is required
```

**解决**:
```bash
# 确保设置了环境变量
export GRAPHITI_API_URL=http://localhost:8000

# 或者使用 .env 文件
cd mcp-http-server
cat > .env << 'EOF'
GRAPHITI_API_URL=http://localhost:8000
LOG_LEVEL=debug
EOF
```

### 问题 4: Claude Desktop 看不到工具

**症状**:
Claude 说它没有 graphiti 相关工具。

**解决**:
1. 检查配置文件格式（JSON 必须正确）
2. 完全退出 Claude Desktop（检查菜单栏）
3. 重新启动 Claude Desktop
4. 检查日志（如果有）

### 问题 5: 端口被占用

**症状**:
```
Error: Port 8000 already in use
```

**解决**:
```bash
# 查找占用端口的进程
lsof -i :8000

# 停止现有服务
docker-compose -f docker-compose.prod.yml down

# 或者修改端口（docker-compose.prod.yml）
```

---

## 测试清单

完整测试通过标准：

- [ ] **服务器端**
  - [ ] Neo4j 正常运行（http://localhost:7474）
  - [ ] GraphiTi API 健康检查通过
  - [ ] 可以成功调用 `/add_episode` API
  - [ ] 可以成功调用 `/search` API

- [ ] **mcp-http-server (STDIO)**
  - [ ] 启动无错误
  - [ ] 显示 "health check passed"
  - [ ] 显示 "MCP server running on stdio"

- [ ] **mcp-http-server (HTTP 调试)**
  - [ ] `/health` 端点返回成功
  - [ ] `/debug/tools` 列出 5 个工具
  - [ ] `/debug/call` 可以成功调用工具

- [ ] **Claude Desktop 集成**
  - [ ] 配置文件格式正确
  - [ ] Claude 可以列出工具
  - [ ] 可以成功添加记忆
  - [ ] 可以成功搜索记忆
  - [ ] 可以查看历史记忆

---

## 清理环境

测试完成后清理：

```bash
# 停止服务
docker-compose -f docker-compose.prod.yml down

# 清理数据（可选，会删除所有数据）
docker-compose -f docker-compose.prod.yml down -v

# 清理 mcp-http-server 构建产物
cd mcp-http-server
rm -rf dist node_modules
```

---

## 下一步

测试成功后，你可以：

1. **部署到生产服务器**: 使用 `./deploy.sh` 部署到远程服务器
2. **发布 npm 包**: `cd mcp-http-server && pnpm publish`
3. **集成到项目**: 在你的项目中使用 GraphiTi 作为 AI 记忆系统

---

## 参考文档

- [SIMPLE_DEPLOY.md](mcp-http-server/SIMPLE_DEPLOY.md) - 简化部署指南
- [mcp-http-server/README.md](mcp-http-server/README.md) - MCP 服务器文档
- [GraphiTi Core](https://github.com/getzep/graphiti) - GraphiTi 核心库
- [Model Context Protocol](https://modelcontextprotocol.io) - MCP 协议规范
