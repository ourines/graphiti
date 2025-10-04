// 数据迁移脚本：为现有节点和边添加元数据字段
// 运行方式：在 Neo4j Browser 中执行，或使用 cypher-shell

// 1. 为所有 EpisodicNode 添加默认元数据字段
MATCH (n:Episodic)
WHERE n.tags IS NULL OR n.priority IS NULL OR n.metadata IS NULL
SET n.tags = COALESCE(n.tags, []),
    n.priority = COALESCE(n.priority, 0),
    n.metadata = COALESCE(n.metadata, {});

// 2. 为所有 EntityNode 添加默认元数据字段
MATCH (n:Entity)
WHERE n.tags IS NULL OR n.priority IS NULL OR n.metadata IS NULL
SET n.tags = COALESCE(n.tags, []),
    n.priority = COALESCE(n.priority, 0),
    n.metadata = COALESCE(n.metadata, {});

// 3. 为所有 CommunityNode 添加默认元数据字段
MATCH (n:Community)
WHERE n.tags IS NULL OR n.priority IS NULL OR n.metadata IS NULL
SET n.tags = COALESCE(n.tags, []),
    n.priority = COALESCE(n.priority, 0),
    n.metadata = COALESCE(n.metadata, {});

// 4. 为所有 RELATES_TO 关系添加默认元数据字段
MATCH ()-[r:RELATES_TO]->()
WHERE r.tags IS NULL OR r.priority IS NULL OR r.metadata IS NULL
SET r.tags = COALESCE(r.tags, []),
    r.priority = COALESCE(r.priority, 0),
    r.metadata = COALESCE(r.metadata, {});

// 5. 为所有 MENTIONS 关系添加默认元数据字段
MATCH ()-[r:MENTIONS]->()
WHERE r.tags IS NULL OR r.priority IS NULL OR r.metadata IS NULL
SET r.tags = COALESCE(r.tags, []),
    r.priority = COALESCE(r.priority, 0),
    r.metadata = COALESCE(r.metadata, {});

// 6. 为所有 HAS_MEMBER 关系添加默认元数据字段
MATCH ()-[r:HAS_MEMBER]->()
WHERE r.tags IS NULL OR r.priority IS NULL OR r.metadata IS NULL
SET r.tags = COALESCE(r.tags, []),
    r.priority = COALESCE(r.priority, 0),
    r.metadata = COALESCE(r.metadata, {});

// 验证迁移结果
MATCH (n)
RETURN labels(n)[0] as type,
       count(n) as total_count,
       count(CASE WHEN n.tags IS NOT NULL THEN 1 END) as with_tags,
       count(CASE WHEN n.priority IS NOT NULL THEN 1 END) as with_priority,
       count(CASE WHEN n.metadata IS NOT NULL THEN 1 END) as with_metadata
ORDER BY type;
