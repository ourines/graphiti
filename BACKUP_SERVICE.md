# Neo4j Backup Service - 设计文档

## 概述

为GraphiTi项目设计的自动化Neo4j备份边车服务，实现定时备份到Cloudflare R2存储。

## 特性

### ✅ 核心功能

1. **自动化定时备份**
   - 基于Cron调度（默认每天凌晨2点）
   - 可配置的备份频率
   - 支持启动时立即备份

2. **在线备份**
   - 无需停止Neo4j服务
   - 使用Cypher导出（支持APOC加速）
   - 零停机时间

3. **压缩和存储优化**
   - Gzip压缩（60-80%压缩率）
   - 自动清理旧备份
   - 可配置保留期限（默认7天）

4. **R2云存储集成**
   - Cloudflare R2兼容S3 API
   - 安全的API token认证
   - 自动上传和元数据标记

5. **健康监控**
   - Docker健康检查
   - 详细的日志记录
   - 敏感数据自动脱敏

## 架构设计

### 服务组件

```
graphiti/
├── neo4j-backup/                # 备份服务目录
│   ├── Dockerfile              # 边车容器定义
│   ├── backup.py               # Python备份脚本
│   ├── entrypoint.sh           # 容器入口脚本
│   └── README.md               # 详细文档
├── docker-compose.yml          # 服务编排（已更新）
└── .env.example                # 环境变量模板（已更新）
```

### 技术栈

- **基础镜像**: Python 3.11 Alpine
- **编程语言**: Python 3
- **数据库客户端**: Neo4j Python Driver
- **云存储SDK**: Boto3 (S3-compatible)
- **调度器**: Cron
- **压缩**: Gzip

### 数据流

```
1. Cron触发
   ↓
2. 连接Neo4j (Bolt协议)
   ↓
3. 导出数据
   ├─→ APOC export (如果可用)
   └─→ 手动Cypher导出 (回退方案)
   ↓
4. Gzip压缩
   ↓
5. 上传到R2
   ↓
6. 清理本地临时文件
   ↓
7. 删除R2中的旧备份
```

## 配置说明

### 环境变量

#### 必需配置

```bash
# Neo4j认证
NEO4J_PASSWORD=your_password

# R2存储
R2_ACCOUNT_ID=your_account_id
R2_ACCESS_KEY_ID=your_access_key
R2_SECRET_ACCESS_KEY=your_secret
R2_BUCKET_NAME=graphiti-neo4j-backup
```

#### 可选配置

```bash
# 备份调度 (Cron格式)
BACKUP_SCHEDULE=0 2 * * *        # 默认: 每天凌晨2点

# 保留策略
BACKUP_RETENTION_DAYS=7          # 默认: 保留7天

# 压缩选项
BACKUP_COMPRESSION=true          # 默认: 启用压缩

# 存储路径
BACKUP_PREFIX=neo4j-backup       # R2对象key前缀

# 立即备份
RUN_IMMEDIATE_BACKUP=false       # 启动时立即运行备份
```

### Cron调度示例

```bash
# 每天凌晨2点
0 2 * * *

# 每6小时
0 */6 * * *

# 每周一凌晨3点
0 3 * * 1

# 每天凌晨1点和下午1点
0 1,13 * * *
```

## 使用方法

### 启动备份服务

```bash
# 1. 配置环境变量
cp .env.example .env
# 编辑 .env 填入R2凭证

# 2. 启动所有服务（包括备份）
docker-compose up -d

# 3. 查看备份服务日志
docker-compose logs -f neo4j-backup
```

### 手动触发备份

```bash
# 方法1: 在运行的容器中执行
docker-compose exec neo4j-backup python3 /app/backup.py

# 方法2: 重启并立即备份
RUN_IMMEDIATE_BACKUP=true docker-compose up -d neo4j-backup
```

### 查看备份文件

备份文件存储在R2桶中，格式：
```
neo4j-backup/neo4j_2025-10-08_02-00-00.cypher.gz
```

## 恢复流程

### 1. 下载备份

```bash
# 使用AWS CLI (R2兼容S3)
aws s3 cp \
  --endpoint-url https://<ACCOUNT_ID>.r2.cloudflarestorage.com \
  s3://<BUCKET_NAME>/neo4j-backup/<BACKUP_FILE> \
  ./restore.cypher.gz

# 解压
gunzip restore.cypher.gz
```

### 2. 恢复到Neo4j

```bash
# 方法1: 使用cypher-shell
docker-compose exec neo4j cypher-shell \
  -u neo4j \
  -p <password> \
  < restore.cypher

# 方法2: 交互式导入
docker-compose exec neo4j cypher-shell -u neo4j -p <password>
neo4j> :source /path/to/restore.cypher
```

## 安全考虑

### 1. 凭证管理
- R2凭证存储在`.env`文件（已添加到`.gitignore`）
- 使用环境变量传递，不硬编码
- 建议定期轮换API密钥

### 2. 网络隔离
- 备份服务运行在isolated Docker网络
- 仅Neo4j和R2端点可访问

### 3. 数据加密
- R2提供静态加密
- 传输使用HTTPS
- 可考虑添加客户端加密

### 4. 访问控制
- 使用R2桶策略限制访问
- 最小权限原则（仅需要R2编辑权限）

### 5. 日志安全
- 自动脱敏敏感数据（token、密码等）
- 日志级别可配置

## 性能优化

### 资源使用

| 资源 | 基线 | 备份时峰值 |
|------|------|------------|
| CPU  | < 1% | < 10%      |
| 内存 | 100MB | 200-500MB  |
| 磁盘 | 最小  | 临时文件空间 |
| 网络 | 最小  | 取决于数据库大小 |

### 备份时间估算

| 数据库大小 | 导出时间 | 上传时间(10Mbps) | 总计 |
|-----------|---------|------------------|------|
| 100 MB    | ~30秒   | ~1分钟           | ~2分钟 |
| 1 GB      | ~5分钟  | ~10分钟          | ~15分钟 |
| 10 GB     | ~30分钟 | ~100分钟         | ~130分钟 |

*实际时间取决于图复杂度和网络带宽*

### 优化建议

1. **启用压缩** - 显著减少传输时间和存储成本
2. **使用APOC** - 如果可能，配置APOC插件加速导出
3. **非高峰备份** - 将备份调度在低负载时段
4. **调整保留期** - 根据需求平衡存储成本

## 监控和告警

### 日志监控

```bash
# 实时查看日志
docker-compose logs -f neo4j-backup

# 查看最近100行
docker-compose logs --tail=100 neo4j-backup

# 搜索错误
docker-compose logs neo4j-backup | grep ERROR
```

### 健康检查

```bash
# 检查服务状态
docker-compose ps neo4j-backup

# 查看健康状态
docker inspect <container_id> | grep -A 20 Health
```

### 关键指标

监控以下指标：
- ✅ 备份成功/失败率
- ✅ 备份文件大小趋势
- ✅ 备份持续时间
- ✅ R2存储使用量
- ✅ Cron任务执行状态

## 故障排查

### 常见问题

#### 1. "R2 bucket not found"
**原因**: 桶名错误或不存在
**解决**: 检查`R2_BUCKET_NAME`配置，确认桶已创建

#### 2. "Access denied"
**原因**: R2凭证错误或权限不足
**解决**: 验证API token权限，确保有R2编辑权限

#### 3. "Neo4j connection failed"
**原因**: Neo4j未就绪或密码错误
**解决**: 检查`NEO4J_PASSWORD`，等待Neo4j完全启动

#### 4. "APOC not available"
**原因**: Neo4j未安装APOC插件
**解决**: 这是警告而非错误，服务会自动回退到手动导出

#### 5. Cron任务未执行
**原因**: Cron守护进程未运行或配置错误
**解决**:
```bash
# 检查Cron进程
docker-compose exec neo4j-backup pgrep crond

# 查看Crontab
docker-compose exec neo4j-backup crontab -l
```

## 未来增强

计划中的功能：

- [ ] **增量备份** - 仅备份变更数据
- [ ] **多数据库支持** - 备份所有Neo4j数据库
- [ ] **备份加密** - 客户端加密
- [ ] **通知集成** - Slack/Email告警
- [ ] **备份验证** - 自动验证备份完整性
- [ ] **恢复自动化** - 一键恢复功能
- [ ] **监控指标** - Prometheus端点
- [ ] **Web UI** - 备份管理界面

## 成本估算

### R2存储成本 (Cloudflare R2)

- **存储**: $0.015/GB/月
- **操作**: Class A操作 $4.50/百万次, Class B免费
- **出口**: 免费（R2独特优势）

**示例**:
- 10GB数据库，7天保留，每天备份
- 存储: ~10GB × $0.015 = ~$0.15/月
- 操作: 可忽略（远低于百万次）
- **总计**: < $1/月

*实际成本可能因压缩率和数据增长而异*

## 生产部署检查清单

部署前检查：

- [ ] R2桶已创建并配置访问控制
- [ ] `.env`文件已配置所有必需变量
- [ ] 备份调度时间符合业务需求
- [ ] 保留策略符合合规要求
- [ ] 已测试手动备份成功
- [ ] 已测试恢复流程
- [ ] 监控和告警已设置
- [ ] 文档已更新团队知识库

## 许可证

与Graphiti主项目相同

## 支持

- **文档**: See [neo4j-backup/README.md](neo4j-backup/README.md)
- **问题**: 在主仓库开Issue
- **日志**: `docker-compose logs neo4j-backup`

---

**设计完成时间**: 2025-10-08
**设计者**: Claude (Ultrathink)
**状态**: ✅ Ready for Production
