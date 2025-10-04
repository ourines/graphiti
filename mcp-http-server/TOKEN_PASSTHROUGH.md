# Token透传机制

## 概述

MCP HTTP服务器支持客户端透传（pass-through）认证token，无需在服务器端配置。这样的好处是：

1. ✅ **多租户支持** - 不同客户端可使用不同的token
2. ✅ **更好的安全性** - 服务器不需要存储token
3. ✅ **更灵活** - 无需重启服务器即可更换token
4. ✅ **更简单的部署** - Docker部署时无需配置token环境变量

## 工作原理

```
客户端 --[X-GraphiTi-Token: token123]--> MCP HTTP服务器 --[Authorization: Bearer token123]--> GraphiTi API
```

1. 客户端在HTTP请求中添加 `X-GraphiTi-Token` header
2. MCP服务器提取这个token
3. 转发请求到GraphiTi API时使用 `Authorization: Bearer {token}`

## 使用方法

### HTTP客户端

使用curl测试：

```bash
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "X-GraphiTi-Token: your-token-here" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
```

### MCP客户端（TypeScript）

对于MCP SDK客户端，需要配置HTTP请求的额外headers：

```typescript
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';

// 创建带有自定义headers的transport
const transport = new StreamableHTTPClientTransport(
  new URL('http://localhost:3000/mcp'),
  {
    headers: {
      'X-GraphiTi-Token': 'your-graphiti-api-token-here'
    }
  }
);

const client = new Client({
  name: 'my-graphiti-client',
  version: '1.0.0'
}, {
  capabilities: {}
});

await client.connect(transport);

// 使用client调用工具
const tools = await client.request({
  method: 'tools/list'
}, {});
```

### Python客户端

```python
from mcp import ClientSession
from mcp.client.streamable_http import StreamableHTTPClientTransport

async def main():
    transport = StreamableHTTPClientTransport(
        url="http://localhost:3000/mcp",
        headers={
            "X-GraphiTi-Token": "your-graphiti-api-token-here"
        }
    )

    async with ClientSession(transport) as session:
        tools = await session.list_tools()
        print(tools)
```

### Claude Desktop配置

对于stdio模式（本地），仍需要在配置中指定token：

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

对于HTTP模式，客户端需要支持自定义headers（当前Claude Desktop可能不支持）。

## 向后兼容性

### 服务器端Token（可选）

MCP服务器仍然支持通过环境变量配置默认token（向后兼容）：

```bash
export GRAPHITI_API_TOKEN=default-token
```

### 优先级

1. **最高优先级**: 客户端提供的 `X-GraphiTi-Token` header
2. **备用方案**: 服务器环境变量 `GRAPHITI_API_TOKEN`

如果两者都没有提供，请求将不带认证header发送（如果GraphiTi API不需要认证则可以工作）。

## Docker部署

### docker-compose.yml

```yaml
services:
  mcp-http-server:
    environment:
      - MCP_TRANSPORT=http
      - GRAPHITI_API_URL=http://graphiti-api:8000
      # 不需要配置GRAPHITI_API_TOKEN
      # Token由客户端透传
```

### 测试

启动服务后，使用不同的token测试：

```bash
# 用户1
curl -X POST http://localhost:3000/mcp \
  -H "X-GraphiTi-Token: user1-token" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"search_memory","params":{"query":"test","group_ids":["user1-group"]}}'

# 用户2
curl -X POST http://localhost:3000/mcp \
  -H "X-GraphiTi-Token: user2-token" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":2,"method":"search_memory","params":{"query":"test","group_ids":["user2-group"]}}'
```

## 安全建议

1. **使用HTTPS** - 在生产环境中，始终使用HTTPS传输token
2. **Token轮换** - 定期轮换API token
3. **最小权限** - 为不同客户端分配最小必要权限的token
4. **日志审计** - MCP服务器会记录token使用（token值被自动脱敏）

## 故障排查

### 401 Unauthorized错误

**问题**: 收到401认证错误

**检查清单**:
1. 确认客户端发送了 `X-GraphiTi-Token` header
2. 验证token格式正确
3. 检查token是否有效（通过直接调用GraphiTi API测试）
4. 查看MCP服务器日志确认token被正确接收

### Token未透传

**问题**: 请求没有携带认证header

**解决方案**:
1. 检查HTTP客户端配置
2. 确认header名称为 `X-GraphiTi-Token`（区分大小写）
3. 查看服务器日志中的 "Using client-provided token" 消息

## 示例代码

完整的客户端示例代码见 [examples/](./examples/) 目录：

- `examples/typescript-client.ts` - TypeScript客户端
- `examples/python-client.py` - Python客户端
- `examples/curl-examples.sh` - curl示例

---

**升级建议**: 对于新部署，推荐使用token透传机制。对于现有部署，可以继续使用服务器端token配置，或逐步迁移到透传模式。
