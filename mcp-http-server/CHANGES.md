# MCP HTTP Server - 升级到 Streamable HTTP

## 📌 主要更改

### 1. SDK 升级
- ✅ **从 0.5.0 → 1.19.1**
- ✅ 采用 Streamable HTTP 传输（MCP 2025-03-26 规范）
- ✅ 移除已弃用的 SSE transport

### 2. 服务器实现重写

**之前（SSE）:**
```typescript
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';

// 需要两个端点：
app.get('/mcp', ...)   // SSE连接
app.post('/mcp', ...)  // 消息发送
```

**现在（Streamable HTTP）:**
```typescript
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';

// 单一端点：
app.post('/mcp', async (req, res) => {
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
    enableJsonResponse: true,
  });
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
});
```

### 3. Docker 集成

**之前:**
- mcp-http-server 有独立的 docker-compose.yml
- 需要手动管理多个 compose 文件

**现在:**
- 集成到主 `docker-compose.yml`
- 一键启动完整堆栈：
  - neo4j
  - graphiti-api
  - mcp-http-server

```bash
docker-compose up -d
```

### 4. 架构改进

#### 无状态设计
- 每个请求创建新的 transport 实例
- 避免 JSON-RPC ID 冲突
- 更适合容器化部署

#### 简化的端点
| 之前 (SSE) | 现在 (Streamable HTTP) |
|------------|------------------------|
| GET /mcp | POST /mcp |
| POST /mcp?sessionId=xxx | POST /mcp |
| GET /health | GET /health |
| GET /debug/tools | GET /debug/tools |

#### 响应模式
- 从 Server-Sent Events 改为直接 JSON 响应
- 更简单的客户端集成
- 更好的错误处理

### 5. 文档更新

更新的文档：
- ✅ README_HTTP_MODE.md - 快速开始指南
- ✅ HTTP_SERVER_GUIDE.md - 完整部署指南
- ✅ test-http-server.sh - 测试脚本

新增的文件：
- ✅ build.sh - 构建脚本
- ✅ CHANGES.md - 本文档

## 🚀 迁移指南

### 对于现有部署

1. **更新依赖**
   ```bash
   cd mcp-http-server
   pnpm install
   ```

2. **重新构建**
   ```bash
   ./build.sh
   # 或
   docker-compose build mcp-http-server
   ```

3. **更新客户端代码**
   ```typescript
   // 旧代码
   import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
   const transport = new SSEClientTransport(new URL('http://localhost:3000/mcp'));

   // 新代码
   import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
   const transport = new StreamableHTTPClientTransport(new URL('http://localhost:3000/mcp'));
   ```

### 对于新部署

使用主 docker-compose.yml：

```bash
# 1. 配置环境变量
cp .env.example .env
# 编辑 .env 填入 API keys

# 2. 启动完整堆栈
docker-compose up -d

# 3. 验证
curl http://localhost:3000/health
```

## 📊 性能优势

1. **更少的网络开销**
   - 无需维护长连接（SSE）
   - 请求-响应模式更简单

2. **更好的可扩展性**
   - 无状态设计
   - 支持水平扩展
   - 适合 K8s/负载均衡

3. **简化的调试**
   - 标准 HTTP 请求/响应
   - 易于使用 curl/Postman 测试
   - 清晰的错误消息

## 🔒 向后兼容性

⚠️ **破坏性更改:**

- 需要升级到 MCP SDK 1.19.1+
- 端点从 GET+POST 改为仅 POST
- 移除 sessionId 查询参数

✅ **保持兼容:**

- stdio 模式不受影响
- 环境变量配置相同
- 工具定义和参数相同

## 📝 技术栈

- **MCP SDK**: 1.19.1
- **MCP Specification**: 2025-03-26
- **Transport**: Streamable HTTP
- **Node.js**: 20+
- **TypeScript**: 5.0+
- **Express**: 4.18+

## 🎯 下一步

建议的后续改进：

1. **监控和指标**
   - 添加 Prometheus metrics
   - 请求延迟追踪
   - 错误率监控

2. **高级功能**
   - 请求缓存
   - 速率限制
   - 批量请求支持

3. **安全增强**
   - CORS 配置
   - 请求签名验证
   - IP 白名单

## 📚 参考资源

- [MCP Specification 2025-03-26](https://modelcontextprotocol.io/specification/2025-03-26/basic/transports)
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [Streamable HTTP Transport Docs](https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/streamable-http.md)

---

**升级完成时间**: 2025-10-05
**升级版本**: SDK 0.5.0 → 1.19.1
**协议版本**: MCP 2024-11-05 → 2025-03-26
