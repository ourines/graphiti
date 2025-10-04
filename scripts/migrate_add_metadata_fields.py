#!/usr/bin/env python3
"""
数据迁移脚本：为现有节点和边添加元数据字段

使用方法:
    python scripts/migrate_add_metadata_fields.py

需要的环境变量:
    NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD
"""

import asyncio
import os
import sys

# 添加项目根目录到 Python 路径
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from graphiti_core.driver.neo4j_driver import Neo4jDriver


async def migrate():
    """执行数据迁移"""
    uri = os.getenv('NEO4J_URI', 'bolt://localhost:7687')
    user = os.getenv('NEO4J_USER', 'neo4j')
    password = os.getenv('NEO4J_PASSWORD', 'password')
    database = os.getenv('NEO4J_DATABASE', 'neo4j')

    print(f'连接到 Neo4j: {uri}, database: {database}')

    driver = Neo4jDriver(uri=uri, user=user, password=password, database=database)

    try:
        # 1. 为所有 EpisodicNode 添加默认元数据字段
        print('\n迁移 EpisodicNode...')
        query = """
        MATCH (n:Episodic)
        WHERE n.tags IS NULL OR n.priority IS NULL OR n.metadata IS NULL
        SET n.tags = COALESCE(n.tags, []),
            n.priority = COALESCE(n.priority, 0),
            n.metadata = COALESCE(n.metadata, {})
        RETURN count(n) as updated_count
        """
        records, _, _ = await driver.execute_query(query)
        print(f'✓ 更新了 {records[0]["updated_count"]} 个 EpisodicNode')

        # 2. 为所有 EntityNode 添加默认元数据字段
        print('\n迁移 EntityNode...')
        query = """
        MATCH (n:Entity)
        WHERE n.tags IS NULL OR n.priority IS NULL OR n.metadata IS NULL
        SET n.tags = COALESCE(n.tags, []),
            n.priority = COALESCE(n.priority, 0),
            n.metadata = COALESCE(n.metadata, {})
        RETURN count(n) as updated_count
        """
        records, _, _ = await driver.execute_query(query)
        print(f'✓ 更新了 {records[0]["updated_count"]} 个 EntityNode')

        # 3. 为所有 CommunityNode 添加默认元数据字段
        print('\n迁移 CommunityNode...')
        query = """
        MATCH (n:Community)
        WHERE n.tags IS NULL OR n.priority IS NULL OR n.metadata IS NULL
        SET n.tags = COALESCE(n.tags, []),
            n.priority = COALESCE(n.priority, 0),
            n.metadata = COALESCE(n.metadata, {})
        RETURN count(n) as updated_count
        """
        records, _, _ = await driver.execute_query(query)
        print(f'✓ 更新了 {records[0]["updated_count"]} 个 CommunityNode')

        # 4. 为所有 RELATES_TO 关系添加默认元数据字段
        print('\n迁移 RELATES_TO 关系...')
        query = """
        MATCH ()-[r:RELATES_TO]->()
        WHERE r.tags IS NULL OR r.priority IS NULL OR r.metadata IS NULL
        SET r.tags = COALESCE(r.tags, []),
            r.priority = COALESCE(r.priority, 0),
            r.metadata = COALESCE(r.metadata, {})
        RETURN count(r) as updated_count
        """
        records, _, _ = await driver.execute_query(query)
        print(f'✓ 更新了 {records[0]["updated_count"]} 个 RELATES_TO 关系')

        # 5. 为所有 MENTIONS 关系添加默认元数据字段
        print('\n迁移 MENTIONS 关系...')
        query = """
        MATCH ()-[r:MENTIONS]->()
        WHERE r.tags IS NULL OR r.priority IS NULL OR r.metadata IS NULL
        SET r.tags = COALESCE(r.tags, []),
            r.priority = COALESCE(r.priority, 0),
            r.metadata = COALESCE(r.metadata, {})
        RETURN count(r) as updated_count
        """
        records, _, _ = await driver.execute_query(query)
        print(f'✓ 更新了 {records[0]["updated_count"]} 个 MENTIONS 关系')

        # 6. 为所有 HAS_MEMBER 关系添加默认元数据字段
        print('\n迁移 HAS_MEMBER 关系...')
        query = """
        MATCH ()-[r:HAS_MEMBER]->()
        WHERE r.tags IS NULL OR r.priority IS NULL OR r.metadata IS NULL
        SET r.tags = COALESCE(r.tags, []),
            r.priority = COALESCE(r.priority, 0),
            r.metadata = COALESCE(r.metadata, {})
        RETURN count(r) as updated_count
        """
        records, _, _ = await driver.execute_query(query)
        print(f'✓ 更新了 {records[0]["updated_count"]} 个 HAS_MEMBER 关系')

        # 验证迁移结果
        print('\n验证迁移结果...')
        query = """
        MATCH (n)
        WITH labels(n)[0] as type, n
        RETURN type,
               count(n) as total_count,
               count(CASE WHEN n.tags IS NOT NULL THEN 1 END) as with_tags,
               count(CASE WHEN n.priority IS NOT NULL THEN 1 END) as with_priority,
               count(CASE WHEN n.metadata IS NOT NULL THEN 1 END) as with_metadata
        ORDER BY type
        """
        records, _, _ = await driver.execute_query(query)

        print('\n节点类型统计:')
        print(f'{"类型":<20} {"总数":<10} {"有tags":<10} {"有priority":<12} {"有metadata":<12}')
        print('-' * 70)
        for record in records:
            print(
                f'{record["type"]:<20} {record["total_count"]:<10} '
                f'{record["with_tags"]:<10} {record["with_priority"]:<12} '
                f'{record["with_metadata"]:<12}'
            )

        print('\n✅ 迁移完成!')

    except Exception as e:
        print(f'\n❌ 迁移失败: {e}')
        raise
    finally:
        await driver.close()


if __name__ == '__main__':
    asyncio.run(migrate())
