# GraphiTi Admin UI - MVP Implementation Plan

## 项目概述

构建一个基于 React 的 GraphiTi 管理界面，提供知识图谱可视化和备份管理功能。

## 技术栈

### 前端框架
- **React 18** - UI 框架
- **Vite** - 构建工具（快速、现代）
- **TypeScript** - 类型安全
- **React Router v6** - 路由管理

### 图谱可视化
- **@react-sigma/core** (主要方案)
  - WebGL 高性能渲染
  - 支持 100-10,000 节点
  - 良好的 React 集成
  - 官方 React 包

### UI 组件库
- **Tailwind CSS** - 样式框架
- **Headless UI / Radix UI** - 无样式组件
- **Lucide React** - 图标库

### 状态管理
- **TanStack Query (React Query)** - 服务器状态管理
- **Zustand** - 客户端状态管理（轻量级）

### HTTP 客户端
- **Axios** - API 请求

## 项目结构

```
graphiti-admin/
├── public/
│   └── favicon.ico
├── src/
│   ├── api/                    # API 客户端
│   │   ├── graphiti.ts         # GraphiTi API 客户端
│   │   ├── backup.ts           # 备份服务 API
│   │   └── types.ts            # API 类型定义
│   ├── components/             # React 组件
│   │   ├── layout/
│   │   │   ├── Layout.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   └── Header.tsx
│   │   ├── graph/
│   │   │   ├── GraphVisualization.tsx
│   │   │   ├── GraphControls.tsx
│   │   │   ├── NodeDetails.tsx
│   │   │   └── GraphStats.tsx
│   │   ├── backup/
│   │   │   ├── BackupSettings.tsx
│   │   │   ├── BackupHistory.tsx
│   │   │   ├── BackupSchedule.tsx
│   │   │   └── ManualBackup.tsx
│   │   └── ui/                 # 可复用 UI 组件
│   │       ├── Button.tsx
│   │       ├── Card.tsx
│   │       ├── Input.tsx
│   │       └── ...
│   ├── hooks/                  # 自定义 Hooks
│   │   ├── useGraph.ts
│   │   ├── useBackup.ts
│   │   └── useWebSocket.ts
│   ├── pages/                  # 页面组件
│   │   ├── Dashboard.tsx
│   │   ├── GraphView.tsx
│   │   ├── BackupManagement.tsx
│   │   └── Settings.tsx
│   ├── store/                  # 状态管理
│   │   ├── graphStore.ts
│   │   └── uiStore.ts
│   ├── utils/                  # 工具函数
│   │   ├── graphUtils.ts
│   │   └── formatters.ts
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── .env.example
├── .env.local
├── package.json
├── tsconfig.json
├── vite.config.ts
└── tailwind.config.js
```

## 核心功能设计

### 1. 图谱可视化

#### 功能需求
- ✅ 从 GraphiTi API 获取图谱数据
- ✅ 使用 Sigma.js 渲染节点和关系
- ✅ 支持缩放、平移、拖拽
- ✅ 节点/关系按类型着色
- ✅ 搜索和过滤节点
- ✅ 点击节点查看详情
- ✅ 显示图谱统计信息

#### 数据流
```
Neo4j (via GraphiTi API)
  ↓
GraphiTi API (:8000)
  ↓
React Query 缓存
  ↓
Sigma.js 渲染
```

#### 性能优化策略
1. **虚拟化加载**
   - 初始加载限制节点数（如 1000 个）
   - 按需加载相邻节点
   - 使用分页或游标

2. **WebGL 渲染**
   - Sigma.js 原生 WebGL 支持
   - GPU 加速图形渲染

3. **数据缓存**
   - React Query 缓存 API 响应
   - 本地状态缓存已渲染的图谱

4. **节点聚合**
   - 相似节点分组显示
   - 缩放时展开聚合

### 2. 备份管理

#### 功能需求
- ✅ 显示备份配置
- ✅ 修改备份计划（cron 表达式）
- ✅ 查看备份历史
- ✅ 手动触发备份
- ✅ 下载备份文件（从 R2）
- ✅ 删除旧备份
- ✅ 查看备份服务状态

#### 备份 API 设计
```typescript
// 备份服务需要新增 REST API
// 在 neo4j-backup 容器中添加简单的 HTTP server

GET    /api/backup/status        # 备份服务状态
GET    /api/backup/schedule      # 获取备份计划
PUT    /api/backup/schedule      # 更新备份计划
POST   /api/backup/trigger       # 手动触发备份
GET    /api/backup/history       # 备份历史（从 R2 列表）
DELETE /api/backup/:id           # 删除备份
GET    /api/backup/:id/download  # 下载备份文件
```

### 3. 高性能渲染方案

#### 选择：@react-sigma/core (Sigma.js)

**优势**：
- WebGL 渲染，GPU 加速
- 专为大规模网络设计
- 良好的 React 集成
- 活跃的社区支持

**实现示例**：
```tsx
import { SigmaContainer, useLoadGraph } from '@react-sigma/core';
import '@react-sigma/core/lib/react-sigma.min.css';

function GraphVisualization({ graphData }) {
  const loadGraph = useLoadGraph();

  useEffect(() => {
    // 加载图谱数据到 Sigma
    const graph = new Graph();

    graphData.nodes.forEach(node => {
      graph.addNode(node.id, {
        label: node.name,
        x: Math.random(),
        y: Math.random(),
        size: 10,
        color: getColorByType(node.type)
      });
    });

    graphData.edges.forEach(edge => {
      graph.addEdge(edge.source, edge.target, {
        label: edge.type,
        size: 2
      });
    });

    loadGraph(graph);
  }, [graphData]);

  return (
    <SigmaContainer
      style={{ height: '600px' }}
      settings={{
        renderLabels: true,
        labelDensity: 0.07,
        labelGridCellSize: 60
      }}
    />
  );
}
```

## API 集成

### GraphiTi API Endpoints

```typescript
// src/api/graphiti.ts

class GraphitiAPI {
  private baseURL = 'http://localhost:8000';

  // 获取所有节点
  async getNodes(limit = 1000, offset = 0) {
    return axios.get(`${this.baseURL}/nodes`, {
      params: { limit, offset }
    });
  }

  // 获取节点的邻居
  async getNeighbors(nodeId: string, depth = 1) {
    return axios.get(`${this.baseURL}/nodes/${nodeId}/neighbors`, {
      params: { depth }
    });
  }

  // 搜索节点
  async searchNodes(query: string) {
    return axios.get(`${this.baseURL}/search`, {
      params: { q: query }
    });
  }

  // 获取图谱统计
  async getStats() {
    return axios.get(`${this.baseURL}/stats`);
  }
}
```

### 备份服务 API

需要在 `neo4j-backup` 服务中添加一个简单的 HTTP API：

```python
# neo4j-backup/api.py

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

app = FastAPI()

class BackupSchedule(BaseModel):
    cron: str
    retention_days: int
    compression: bool

@app.get("/api/backup/status")
async def get_backup_status():
    # 返回备份服务状态
    pass

@app.get("/api/backup/schedule")
async def get_backup_schedule():
    # 返回当前备份计划
    pass

@app.put("/api/backup/schedule")
async def update_backup_schedule(schedule: BackupSchedule):
    # 更新备份计划（修改 crontab）
    pass

@app.post("/api/backup/trigger")
async def trigger_backup():
    # 手动触发备份
    pass

@app.get("/api/backup/history")
async def get_backup_history():
    # 从 R2 获取备份历史
    pass
```

## Docker 集成

### docker-compose.yml 更新

```yaml
services:
  # ... 现有服务 ...

  graphiti-admin:
    build:
      context: ./graphiti-admin
      dockerfile: Dockerfile
    ports:
      - "5173:5173"  # Vite dev server
    environment:
      - VITE_GRAPHITI_API_URL=http://graphiti-api:8000
      - VITE_BACKUP_API_URL=http://neo4j-backup:8080
    depends_on:
      - graphiti-api
      - neo4j-backup
    networks:
      - graphiti-network
    volumes:
      - ./graphiti-admin:/app
      - /app/node_modules

  # 更新 neo4j-backup 添加 API server
  neo4j-backup:
    # ... 现有配置 ...
    ports:
      - "8080:8080"  # 备份 API
```

## 实施步骤

### Phase 1: 项目初始化 (1-2 小时)
- [x] 创建新分支 `feature/graphiti-admin-ui`
- [ ] 使用 Vite 创建 React + TypeScript 项目
- [ ] 安装依赖 (Sigma.js, React Router, TanStack Query, Tailwind)
- [ ] 设置项目结构
- [ ] 配置 TypeScript 和 ESLint

### Phase 2: API 客户端 (2-3 小时)
- [ ] 实现 GraphiTi API 客户端
- [ ] 实现备份 API 客户端（需要先添加备份 API）
- [ ] 设置 React Query
- [ ] 定义类型接口

### Phase 3: 基础布局 (2 小时)
- [ ] 创建 Layout 组件
- [ ] 创建 Sidebar 导航
- [ ] 创建 Header
- [ ] 设置路由

### Phase 4: 图谱可视化 (4-6 小时)
- [ ] 实现基础 Sigma.js 集成
- [ ] 从 API 加载数据
- [ ] 实现节点/边样式
- [ ] 添加交互功能（点击、搜索）
- [ ] 实现性能优化
  - [ ] 虚拟化加载
  - [ ] 分页
  - [ ] 缓存

### Phase 5: 备份管理 (3-4 小时)
- [ ] 添加备份 API server 到 neo4j-backup
- [ ] 实现备份设置界面
- [ ] 实现备份历史列表
- [ ] 手动备份功能
- [ ] 下载备份功能

### Phase 6: Docker 集成 (1-2 小时)
- [ ] 创建 Dockerfile
- [ ] 更新 docker-compose.yml
- [ ] 测试容器化部署

### Phase 7: 测试和优化 (2-3 小时)
- [ ] 功能测试
- [ ] 性能测试（大数据集）
- [ ] UI/UX 优化
- [ ] 文档编写

## 时间估算

- **总开发时间**: 15-22 小时
- **MVP 交付**: 2-3 个工作日

## 性能目标

- **图谱渲染**: 1000 节点 < 2 秒加载
- **交互响应**: < 100ms (60 FPS)
- **API 响应**: < 500ms
- **内存使用**: < 500MB (10,000 节点)

## 测试策略

### 功能测试
- [ ] 图谱数据正确加载和显示
- [ ] 节点搜索和过滤
- [ ] 备份计划修改
- [ ] 手动备份触发
- [ ] 备份历史查看

### 性能测试
- [ ] 1,000 节点加载时间
- [ ] 5,000 节点渲染性能
- [ ] 10,000 节点极限测试
- [ ] 内存占用监控

### 兼容性测试
- [ ] Chrome/Edge
- [ ] Firefox
- [ ] Safari

## 风险和挑战

1. **性能风险**
   - **风险**: 大型图谱可能导致性能问题
   - **缓解**: 实现虚拟化、分页、聚合

2. **备份 API**
   - **风险**: 需要修改现有 neo4j-backup 服务
   - **缓解**: 添加轻量级 FastAPI，不影响现有功能

3. **数据格式**
   - **风险**: GraphiTi API 返回格式可能不匹配
   - **缓解**: 实现数据转换层

## 成功标准

- ✅ 能够可视化 Neo4j 知识图谱
- ✅ 支持至少 5,000 节点流畅渲染
- ✅ 备份管理功能完整可用
- ✅ Docker 一键部署
- ✅ 所有核心功能测试通过

## 下一步行动

1. 创建 `graphiti-admin` 目录
2. 初始化 Vite + React + TypeScript 项目
3. 安装核心依赖
4. 开始 Phase 1 实施
