# GraphiTi 全流程集成测试

## 测试目标

验证完整的技术栈：
1. ✅ Neo4j 图数据库
2. ✅ GraphiTi REST API (FastAPI)
3. ✅ MCP HTTP服务器 (Hono.js + Streamable HTTP)
4. ✅ Token透传机制
5. ✅ Docker Compose集成

## 前置条件

确保以下环境变量已配置：

```bash
# .env 文件
GRAPHITI_API_TOKEN=your-secure-token
NEO4J_PASSWORD=your-neo4j-password
GOOGLE_API_KEY=your-google-api-key  # 或其他LLM provider
```

## 测试步骤

### 1. 启动完整堆栈

```bash
cd /Users/liubiao/Documents/GitHub/graphiti
docker-compose up -d
```

预期输出：
```
✓ neo4j (healthy)
✓ graphiti-api (healthy)
✓ mcp-http-server (healthy)
```

### 2. 验证服务健康状态

```bash
# Neo4j
curl http://localhost:7474 | grep "neo4j"

# GraphiTi API
curl http://localhost:8000/healthcheck | jq

# MCP HTTP Server
curl http://localhost:3000/health | jq
```

### 3. 测试MCP端点（无token - 应失败）

```bash
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
```

预期：401 Unauthorized（如果GraphiTi API需要认证）

### 4. 测试MCP端点（有token - 应成功）

```bash
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "X-GraphiTi-Token: your-secure-token" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
```

预期：返回工具列表（20+工具）

### 5. 测试添加内存

```bash
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "X-GraphiTi-Token: your-secure-token" \
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/call",
    "params": {
      "name": "add_memory",
      "arguments": {
        "name": "Test Memory",
        "content": "This is a test memory for integration testing",
        "group_id": "integration-test"
      }
    }
  }'
```

预期：成功添加记忆

### 6. 测试搜索内存

```bash
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "X-GraphiTi-Token: your-secure-token" \
  -d '{
    "jsonrpc": "2.0",
    "id": 3,
    "method": "tools/call",
    "params": {
      "name": "search_memory",
      "arguments": {
        "query": "test memory",
        "group_ids": ["integration-test"],
        "max_facts": 10
      }
    }
  }'
```

预期：返回刚才添加的记忆

### 7. 验证Neo4j图数据

```bash
# 使用Neo4j浏览器访问
open http://localhost:7474

# 或使用Cypher查询
docker exec -it graphiti-neo4j-1 cypher-shell -u neo4j -p your-neo4j-password \
  "MATCH (n) RETURN count(n) as node_count;"
```

预期：能看到新增的节点

## 性能测试

### 并发测试

```bash
# 使用ab (Apache Bench) 测试
ab -n 100 -c 10 -H "X-GraphiTi-Token: your-token" \
   -H "Content-Type: application/json" \
   -p test-request.json \
   http://localhost:3000/mcp
```

预期指标：
- 请求成功率: 100%
- 平均响应时间: < 100ms
- 吞吐量: > 100 req/s

### 压力测试

```bash
# 使用wrk测试
wrk -t4 -c100 -d30s \
  -H "X-GraphiTi-Token: your-token" \
  -H "Content-Type: application/json" \
  http://localhost:3000/health
```

## 监控检查

### Docker日志

```bash
# 查看所有服务日志
docker-compose logs -f

# 只看MCP服务器
docker-compose logs -f mcp-http-server

# 只看GraphiTi API
docker-compose logs -f graphiti-api
```

### 资源使用

```bash
docker stats
```

预期：
- mcp-http-server: < 100MB RAM
- graphiti-api: < 500MB RAM
- neo4j: < 2GB RAM

## 清理

```bash
# 停止所有服务
docker-compose down

# 清理数据（可选）
docker-compose down -v
```

## 故障排查

### MCP服务器无法连接

1. 检查端口占用：`lsof -i :3000`
2. 查看容器状态：`docker ps | grep mcp`
3. 查看日志：`docker logs graphiti-mcp-http-server-1`

### GraphiTi API错误

1. 检查环境变量：`docker exec graphiti-graphiti-api-1 env | grep GRAPHITI`
2. 测试API直接访问：`curl -H "Authorization: Bearer token" http://localhost:8000/search`

### Neo4j连接失败

1. 检查健康状态：`docker-compose ps neo4j`
2. 查看启动日志：`docker-compose logs neo4j | tail -100`
3. 验证密码：检查.env中的NEO4J_PASSWORD

## 测试通过标准

全流程测试通过需满足：

- [x] 所有服务健康检查通过
- [x] MCP工具列表返回20+工具
- [x] Token透传机制正常工作
- [x] 能成功添加和搜索记忆
- [x] Neo4j中能查询到图数据
- [x] 无内存泄漏（长时间运行）
- [x] 并发请求成功率100%

## 测试报告模板

```markdown
## 集成测试报告

**测试日期**: 2025-10-05
**测试人员**: [姓名]
**测试环境**: Docker Compose

### 测试结果

| 测试项 | 状态 | 备注 |
|--------|------|------|
| Docker启动 | ✅ | 3个服务全部启动 |
| 健康检查 | ✅ | 全部healthy |
| MCP工具列表 | ✅ | 返回24个工具 |
| Token透传 | ✅ | 正常工作 |
| 添加记忆 | ✅ | 成功 |
| 搜索记忆 | ✅ | 成功 |
| Neo4j查询 | ✅ | 能看到数据 |
| 性能测试 | ✅ | 吞吐量150 req/s |

### 问题

无

### 建议

无

**总体评价**: ✅ 全部通过
```

---

**测试完成**后，记得停止服务并清理资源：

```bash
docker-compose down
```
