#!/usr/bin/env python3
"""
测试多项目增强功能

使用方法:
    python scripts/test_multi_project_features.py

需要的环境变量:
    NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD, OPENAI_API_KEY
"""

import asyncio
import os
import sys
from datetime import datetime, timezone

# 添加项目根目录到 Python 路径
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from graphiti_core import Graphiti
from graphiti_core.nodes import EpisodeType


async def test_metadata_fields():
    """测试元数据字段功能"""
    print('\n=== 测试 1: 元数据字段 ===\n')

    # 初始化 Graphiti
    graphiti = Graphiti(
        uri=os.getenv('NEO4J_URI', 'bolt://localhost:7687'),
        user=os.getenv('NEO4J_USER', 'neo4j'),
        password=os.getenv('NEO4J_PASSWORD', 'password'),
        database=os.getenv('NEO4J_DATABASE', 'neo4j'),
    )

    try:
        # 添加带元数据的 episode
        print('添加测试数据（keymize 项目）...')
        result = await graphiti.add_episode(
            name='keymize_快捷键设计',
            episode_body='keymize 项目使用 Ctrl+Shift+K 作为全局唤醒快捷键，采用 Tauri 框架开发',
            source_description='测试数据',
            reference_time=datetime.now(timezone.utc),
            source=EpisodeType.text,
            group_id='keymize',
        )
        print(f'✓ Episode UUID: {result.episode.uuid}')

        # 添加另一个项目的数据
        print('\n添加测试数据（xiaoman 项目）...')
        result2 = await graphiti.add_episode(
            name='xiaoman_技术栈',
            episode_body='小满项目使用 Tanstack Start 框架，需要避免快捷键冲突',
            source_description='测试数据',
            reference_time=datetime.now(timezone.utc),
            source=EpisodeType.text,
            group_id='xiaoman',
        )
        print(f'✓ Episode UUID: {result2.episode.uuid}')

        # 测试搜索
        print('\n\n=== 测试 2: 搜索功能 ===\n')

        print('测试跨项目搜索...')
        search_results = await graphiti.search(
            query='快捷键', group_ids=['keymize', 'xiaoman'], num_results=10
        )

        print(f'\n找到 {len(search_results.edges)} 个结果:')
        for i, edge in enumerate(search_results.edges, 1):
            print(f'\n结果 {i}:')
            print(f'  UUID: {edge.uuid}')
            print(f'  Group ID: {edge.group_id}')
            print(f'  Fact: {edge.fact}')
            print(f'  Tags: {edge.tags}')
            print(f'  Priority: {edge.priority}')

        # 验证元数据字段存在
        print('\n\n=== 测试 3: 元数据字段验证 ===\n')

        for edge in search_results.edges:
            assert hasattr(edge, 'tags'), 'Edge 应该有 tags 字段'
            assert hasattr(edge, 'priority'), 'Edge 应该有 priority 字段'
            assert hasattr(edge, 'metadata'), 'Edge 应该有 metadata 字段'
            assert isinstance(edge.tags, list), 'tags 应该是列表'
            assert isinstance(edge.priority, int), 'priority 应该是整数'
            assert isinstance(edge.metadata, dict), 'metadata 应该是字典'

        print('✓ 所有元数据字段验证通过!')

        print('\n\n=== 测试 4: group_id 列表 ===\n')

        # 查询所有 group_id
        query = """
        MATCH (n)
        WHERE n.group_id IS NOT NULL
        RETURN DISTINCT n.group_id as group_id
        ORDER BY group_id
        """
        records, _, _ = await graphiti.driver.execute_query(query)
        group_ids = [record['group_id'] for record in records]

        print(f'发现 {len(group_ids)} 个项目:')
        for gid in group_ids:
            print(f'  - {gid}')

        print('\n✅ 所有测试通过!')

    except Exception as e:
        print(f'\n❌ 测试失败: {e}')
        import traceback

        traceback.print_exc()
    finally:
        await graphiti.close()


async def test_api_endpoints():
    """测试 API 端点"""
    import httpx

    print('\n\n=== 测试 5: API 端点 ===\n')

    base_url = os.getenv('GRAPHITI_API_URL', 'http://localhost:8000')

    async with httpx.AsyncClient() as client:
        # 测试搜索 API
        print('测试 /v1/search 端点...')
        try:
            response = await client.post(
                f'{base_url}/v1/search',
                json={
                    'query': '快捷键',
                    'group_ids': ['keymize', 'xiaoman'],
                    'priority_group_id': 'keymize',
                    'max_facts': 10,
                },
            )

            if response.status_code == 200:
                data = response.json()
                print(f'✓ 返回 {len(data["facts"])} 个结果')

                if len(data['facts']) > 0:
                    fact = data['facts'][0]
                    print('\n第一个结果:')
                    print(f'  Source Group ID: {fact.get("source_group_id", "N/A")}')
                    print(f'  Relevance Score: {fact.get("relevance_score", "N/A")}')
                    print(f'  Tags: {fact.get("tags", [])}')
                    print(f'  Priority: {fact.get("priority", 0)}')
            else:
                print(f'❌ API 返回错误: {response.status_code}')
                print(response.text)

        except httpx.ConnectError:
            print('⚠️  API 服务器未运行，跳过 API 测试')
            print('   提示: 运行 `cd server && uvicorn graph_service.main:app --reload`')


async def main():
    """运行所有测试"""
    print('=' * 70)
    print('多项目增强功能测试')
    print('=' * 70)

    await test_metadata_fields()
    await test_api_endpoints()

    print('\n' + '=' * 70)
    print('测试完成!')
    print('=' * 70)


if __name__ == '__main__':
    asyncio.run(main())
