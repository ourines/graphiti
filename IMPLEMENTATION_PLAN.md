# Graphiti MCP HTTP Server Implementation Plan

## 项目目标

创建一个基于 TypeScript 的 MCP HTTP Server，通过 npx 发布，作为 Graphiti FastAPI 后端的 MCP 协议适配层。

## 架构概览

```
Claude Code/Claude Desktop
         ↓ MCP Protocol (stdio)
NPX Package (@your-org/graphiti-mcp)
         ↓ HTTP REST API
FastAPI Server (server/)
         ↓
graphiti_core + Neo4j
```

## Milestone 1: 核心基础设施 (Week 1)

### Issue #1: 项目初始化和基础配置
**优先级**: P0 (Critical)
**工作量**: 4h

- [ ] 创建独立的 TypeScript 项目目录 `mcp-http-server/`
- [ ] 配置 package.json 支持 npx 启动
- [ ] 配置 TypeScript (tsconfig.json)
- [ ] 配置 ESLint + Prettier
- [ ] 添加 .gitignore
- [ ] 创建基础项目结构

**验收标准**:
- `pnpm install` 成功
- `pnpm build` 生成 dist/
- `npx .` 可以启动（即使只是打印 hello world）

---

### Issue #2: 配置管理系统
**优先级**: P0 (Critical)
**工作量**: 3h

- [ ] 实现 `src/config.ts` - 配置加载逻辑
- [ ] 支持环境变量配置
  - `GRAPHITI_API_URL`
  - `GRAPHITI_API_HEADERS` (JSON 或 Key:Value 格式)
  - `MCP_PORT`, `MCP_HOST`
- [ ] 创建 `.env.example`
- [ ] 添加配置验证逻辑
- [ ] 编写配置文档

**验收标准**:
- 可以通过环境变量配置所有参数
- Headers 支持 JSON 和简化格式
- 配置错误时有清晰的错误提示

---

### Issue #3: FastAPI 客户端封装
**优先级**: P0 (Critical)
**工作量**: 5h

- [ ] 实现 `src/client.ts` - GraphitiClient 类
- [ ] 实现所有 FastAPI 接口调用:
  - `POST /messages` - add_memory
  - `POST /search` - search_memory
  - `GET /episodes/{group_id}` - get_episodes
  - `DELETE /episode/{uuid}` - delete_episode
  - `POST /clear` - clear_graph
- [ ] 添加错误处理和重试逻辑
- [ ] 添加请求日志
- [ ] 单元测试（mock fetch）

**验收标准**:
- 所有方法正确调用 FastAPI 接口
- Headers 正确传递
- 错误有详细的堆栈信息
- 测试覆盖率 > 80%

---

## Milestone 2: MCP 协议实现 (Week 2)

### Issue #4: MCP 工具定义
**优先级**: P0 (Critical)
**工作量**: 3h

- [ ] 实现 `src/tools.ts` - 工具定义
- [ ] 定义 5 个核心工具:
  - `add_memory`
  - `search_memory`
  - `get_episodes`
  - `delete_episode`
  - `clear_graph`
- [ ] 为每个工具编写详细的 description
- [ ] 定义完整的 JSON Schema
- [ ] 添加参数验证

**验收标准**:
- 工具定义符合 MCP 规范
- Schema 完整且类型正确
- 所有必填/可选参数标注清晰

---

### Issue #5: MCP Server 核心实现
**优先级**: P0 (Critical)
**工作量**: 6h

- [ ] 实现 `src/server.ts` - GraphitiMCPServer 类
- [ ] 实现 MCP 协议处理器:
  - `ListToolsRequestSchema` handler
  - `CallToolRequestSchema` handler
- [ ] 工具调用路由逻辑
- [ ] 统一的响应格式
- [ ] 错误处理和日志

**验收标准**:
- 可以通过 stdio 接收 MCP 请求
- 工具调用正确转发到 FastAPI
- 错误响应格式正确
- 有详细的调试日志

---

### Issue #6: Stdio 和 HTTP 双模式支持
**优先级**: P1 (High)
**工作量**: 4h

- [ ] 实现 stdio 传输模式（用于 Claude Desktop）
- [ ] 实现 HTTP 传输模式（用于调试）
- [ ] 通过环境变量切换模式
- [ ] 添加健康检查端点 `/health`
- [ ] 添加调试端点 `/debug/tools`

**验收标准**:
- stdio 模式可以与 Claude Desktop 通信
- HTTP 模式可以通过 curl 测试
- `/health` 返回服务状态

---

## Milestone 3: 测试和文档 (Week 3)

### Issue #7: 集成测试
**优先级**: P1 (High)
**工作量**: 6h

- [ ] 编写端到端测试
- [ ] Mock FastAPI 服务器
- [ ] 测试所有工具调用流程
- [ ] 测试错误场景
- [ ] 测试配置加载
- [ ] 添加 CI/CD 配置（GitHub Actions）

**验收标准**:
- 测试覆盖率 > 85%
- 所有核心流程有集成测试
- CI 自动运行测试

---

### Issue #8: 文档编写
**优先级**: P1 (High)
**工作量**: 4h

- [ ] README.md - 项目介绍和快速开始
- [ ] CONFIGURATION.md - 详细配置说明
- [ ] API.md - 工具 API 文档
- [ ] DEPLOYMENT.md - 部署指南
- [ ] 添加使用示例
- [ ] 添加故障排查指南

**验收标准**:
- 新用户可以通过 README 5 分钟内启动
- 所有配置项有详细说明
- 有完整的使用示例

---

## Milestone 4: 发布和优化 (Week 4)

### Issue #9: NPM 发布准备
**优先级**: P1 (High)
**工作量**: 3h

- [ ] 配置 `.npmignore`
- [ ] 添加 `prepublishOnly` 脚本
- [ ] 配置语义化版本
- [ ] 添加 LICENSE
- [ ] 添加 CHANGELOG.md
- [ ] 配置 npm 发布流程

**验收标准**:
- `npm publish` 成功
- npx 可以直接启动
- 包体积 < 500KB

---

### Issue #10: 性能优化和监控
**优先级**: P2 (Medium)
**工作量**: 5h

- [ ] 添加请求缓存（可选）
- [ ] 添加连接池管理
- [ ] 添加性能指标收集
- [ ] 添加请求日志（可配置级别）
- [ ] 优化启动时间
- [ ] 添加超时控制

**验收标准**:
- 启动时间 < 2s
- 请求延迟 < 100ms (不含 FastAPI)
- 有可选的性能监控

---

### Issue #11: 高级特性
**优先级**: P3 (Low)
**工作量**: 6h

- [ ] 添加批量操作支持
- [ ] 添加流式响应（如果需要）
- [ ] 添加 WebSocket 支持（可选）
- [ ] 添加请求重试和熔断
- [ ] 添加更多配置选项

**验收标准**:
- 功能可选启用
- 不影响核心功能
- 有详细文档

---

## Issue #12: Claude Code 集成测试
**优先级**: P0 (Critical)
**工作量**: 3h

- [ ] 在 Claude Code 中配置 MCP Server
- [ ] 测试所有工具在真实环境中的表现
- [ ] 测试错误处理
- [ ] 性能压测
- [ ] 编写集成测试报告

**验收标准**:
- 所有工具在 Claude Code 中正常工作
- 错误提示清晰
- 性能满足要求

---

## 技术栈

- **语言**: TypeScript 5.3+
- **运行时**: Node.js 18+
- **MCP SDK**: @modelcontextprotocol/sdk ^0.5.0
- **HTTP 框架**: Express ^4.18 (仅用于 HTTP 模式)
- **构建工具**: tsc
- **包管理**: pnpm
- **测试**: Vitest
- **CI/CD**: GitHub Actions

## 依赖关系

```
Issue #1 (项目初始化)
  ↓
Issue #2 (配置管理)
  ↓
Issue #3 (FastAPI 客户端)
  ↓
Issue #4 (工具定义) → Issue #5 (MCP Server)
                              ↓
                         Issue #6 (双模式)
                              ↓
Issue #7 (集成测试) ← Issue #8 (文档)
  ↓
Issue #9 (发布准备)
  ↓
Issue #12 (Claude 集成测试)
  ↓
Issue #10 (性能优化) → Issue #11 (高级特性)
```

## 时间线

- **Week 1**: Milestone 1 - 基础设施
- **Week 2**: Milestone 2 - MCP 协议
- **Week 3**: Milestone 3 - 测试和文档
- **Week 4**: Milestone 4 - 发布和优化

**总工作量**: 约 52 小时（13 天 @ 4h/天）

## 风险评估

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| MCP SDK 版本不兼容 | High | 使用稳定版本，添加版本锁定 |
| FastAPI 接口变更 | Medium | 添加版本检查，文档清晰标注兼容版本 |
| NPM 发布权限问题 | Low | 提前配置 NPM token 和组织权限 |
| 性能不满足要求 | Medium | 早期性能测试，预留优化时间 |

## 成功标准

- ✅ 通过 npx 一键启动
- ✅ 支持环境变量配置 URL 和 headers
- ✅ 所有核心工具正常工作
- ✅ 在 Claude Code 中完整集成测试通过
- ✅ 测试覆盖率 > 85%
- ✅ 文档完整清晰
- ✅ 成功发布到 NPM
