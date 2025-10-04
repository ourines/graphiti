from datetime import datetime, timezone
from typing import Any, Dict, List

from fastapi import APIRouter, Query, status

from graph_service.dto import (
    GetMemoryRequest,
    GetMemoryResponse,
    Message,
    SearchQuery,
    SearchResults,
    UpdateEntityRequest,
    UpdateEntityResponse,
    UpdateFactRequest,
    UpdateFactResponse,
)
from graph_service.zep_graphiti import ZepGraphitiDep, get_fact_result_from_edge

router = APIRouter()


@router.post('/search', status_code=status.HTTP_200_OK)
async def search(query: SearchQuery, graphiti: ZepGraphitiDep):
    # 构建 group_ids 优先级列表
    group_ids = query.group_ids or []

    # 如果指定了优先组，确保它在列表最前面
    if query.priority_group_id:
        if query.priority_group_id not in group_ids:
            group_ids = [query.priority_group_id] + group_ids
        else:
            # 移动到最前面
            group_ids = [query.priority_group_id] + [
                g for g in group_ids if g != query.priority_group_id
            ]

    # Search with potentially more results for time/priority/tag filtering
    search_limit = (
        query.max_facts * 3
        if (query.start_time or query.end_time or query.min_priority is not None or query.tags)
        else query.max_facts
    )

    # TODO: 后续需要修改 graphiti.search 以支持 priority_group_id
    # 目前先通过 group_ids 顺序来实现优先级
    relevant_edges = await graphiti.search(
        group_ids=group_ids if group_ids else None,
        query=query.query,
        num_results=search_limit,
    )

    # Convert to facts
    facts = [get_fact_result_from_edge(edge) for edge in relevant_edges]

    # Apply time filtering if specified
    if query.start_time or query.end_time:
        filtered_facts = []
        for fact in facts:
            # Check if fact is valid within the time range
            if query.start_time and fact.valid_at:
                if fact.valid_at < query.start_time:
                    continue
            if query.end_time and fact.valid_at:
                if fact.valid_at > query.end_time:
                    continue
            filtered_facts.append(fact)
        facts = filtered_facts

    # Apply priority filtering
    if query.min_priority is not None:
        facts = [f for f in facts if f.priority >= query.min_priority]

    # Apply tags filtering
    if query.tags:
        facts = [f for f in facts if any(tag in f.tags for tag in query.tags)]

    # Limit results
    facts = facts[: query.max_facts]

    return SearchResults(
        facts=facts,
    )


@router.get('/entity-edge/{uuid}', status_code=status.HTTP_200_OK)
async def get_entity_edge(uuid: str, graphiti: ZepGraphitiDep):
    entity_edge = await graphiti.get_entity_edge(uuid)
    return get_fact_result_from_edge(entity_edge)


@router.get('/episodes/{group_id}', status_code=status.HTTP_200_OK)
async def get_episodes(group_id: str, last_n: int, graphiti: ZepGraphitiDep):
    episodes = await graphiti.retrieve_episodes(
        group_ids=[group_id], last_n=last_n, reference_time=datetime.now(timezone.utc)
    )
    return episodes


@router.post('/get-memory', status_code=status.HTTP_200_OK)
async def get_memory(
    request: GetMemoryRequest,
    graphiti: ZepGraphitiDep,
):
    combined_query = compose_query_from_messages(request.messages)
    result = await graphiti.search(
        group_ids=[request.group_id],
        query=combined_query,
        num_results=request.max_facts,
    )
    facts = [get_fact_result_from_edge(edge) for edge in result]
    return GetMemoryResponse(facts=facts)


def compose_query_from_messages(messages: list[Message]):
    combined_query = ''
    for message in messages:
        combined_query += f'{message.role_type or ""}({message.role or ""}): {message.content}\n'
    return combined_query


@router.get('/groups', status_code=status.HTTP_200_OK)
async def list_groups(graphiti: ZepGraphitiDep) -> Dict[str, List[str]]:
    """List all unique group_ids in the knowledge graph"""
    query = """
    MATCH (n)
    WHERE n.group_id IS NOT NULL
    RETURN DISTINCT n.group_id as group_id
    ORDER BY group_id
    """
    records, _, _ = await graphiti.driver.execute_query(query)
    group_ids = [record['group_id'] for record in records]
    return {'group_ids': group_ids}


@router.get('/entities/{group_id}', status_code=status.HTTP_200_OK)
async def get_entities(
    group_id: str, graphiti: ZepGraphitiDep, limit: int = Query(50, ge=1, le=200)
) -> Dict[str, Any]:
    """Get entities for a specific group"""
    from graphiti_core.nodes import EntityNode

    entities = await EntityNode.get_by_group_ids(graphiti.driver, [group_id])

    # Limit results
    entities = entities[:limit]

    # Convert to dict
    entity_list = [
        {
            'uuid': entity.uuid,
            'name': entity.name,
            'group_id': entity.group_id,
            'summary': entity.summary if hasattr(entity, 'summary') else None,
            'created_at': entity.created_at.isoformat() if entity.created_at else None,
        }
        for entity in entities
    ]

    return {
        'group_id': group_id,
        'count': len(entity_list),
        'limit': limit,
        'entities': entity_list,
    }


@router.get('/entities/{uuid}/relationships', status_code=status.HTTP_200_OK)
async def get_entity_relationships(uuid: str, graphiti: ZepGraphitiDep) -> Dict[str, Any]:
    """Get all relationships for a specific entity"""
    from graphiti_core.edges import EntityEdge

    # Get all edges connected to this entity (both source and target)
    edges = await EntityEdge.get_by_node_uuid(graphiti.driver, uuid)

    # Convert to facts
    facts = [get_fact_result_from_edge(edge) for edge in edges]

    return {'entity_uuid': uuid, 'relationship_count': len(facts), 'relationships': facts}


@router.get('/stats/{group_id}', status_code=status.HTTP_200_OK)
async def get_graph_stats(group_id: str, graphiti: ZepGraphitiDep) -> Dict[str, Any]:
    """Get statistics for a specific group's knowledge graph"""

    # Count episodes
    episodes_query = """
    MATCH (e:Episodic)
    WHERE e.group_id = $group_id
    RETURN count(e) as count,
           min(e.valid_at) as oldest,
           max(e.valid_at) as newest
    """
    episodes_result, _, _ = await graphiti.driver.execute_query(episodes_query, group_id=group_id)
    episodes_count = episodes_result[0]['count'] if episodes_result else 0
    oldest_memory = (
        episodes_result[0]['oldest'] if episodes_result and episodes_result[0]['oldest'] else None
    )
    newest_memory = (
        episodes_result[0]['newest'] if episodes_result and episodes_result[0]['newest'] else None
    )

    # Count entities
    entities_query = """
    MATCH (n:Entity)
    WHERE n.group_id = $group_id
    RETURN count(n) as count
    """
    entities_result, _, _ = await graphiti.driver.execute_query(entities_query, group_id=group_id)
    entities_count = entities_result[0]['count'] if entities_result else 0

    # Count facts (entity edges)
    facts_query = """
    MATCH (s:Entity)-[r:RELATES_TO]->(t:Entity)
    WHERE s.group_id = $group_id
    RETURN count(r) as count
    """
    facts_result, _, _ = await graphiti.driver.execute_query(facts_query, group_id=group_id)
    facts_count = facts_result[0]['count'] if facts_result else 0

    # Count communities (if they exist)
    communities_query = """
    MATCH (c:Community)
    WHERE c.group_id = $group_id
    RETURN count(c) as count
    """
    communities_result, _, _ = await graphiti.driver.execute_query(
        communities_query, group_id=group_id
    )
    communities_count = communities_result[0]['count'] if communities_result else 0

    return {
        'group_id': group_id,
        'total_episodes': episodes_count,
        'total_entities': entities_count,
        'total_facts': facts_count,
        'total_communities': communities_count,
        'oldest_memory': oldest_memory.isoformat() if oldest_memory else None,
        'newest_memory': newest_memory.isoformat() if newest_memory else None,
    }


@router.put('/fact/{uuid}', status_code=status.HTTP_200_OK)
async def update_fact(
    uuid: str,
    request: UpdateFactRequest,
    graphiti: ZepGraphitiDep,
) -> UpdateFactResponse:
    """Update an existing fact/edge by UUID"""
    from graphiti_core.edges import EntityEdge

    # Get the existing edge
    edge = await EntityEdge.get_by_uuid(graphiti.driver, uuid)

    # Track which fields were updated
    updated_fields = []

    # Update fields that were provided
    if request.fact is not None:
        edge.fact = request.fact
        updated_fields.append('fact')

    if request.valid_at is not None:
        edge.valid_at = request.valid_at
        updated_fields.append('valid_at')

    if request.invalid_at is not None:
        edge.invalid_at = request.invalid_at
        updated_fields.append('invalid_at')

    if request.tags is not None:
        edge.tags = request.tags
        updated_fields.append('tags')

    if request.priority is not None:
        edge.priority = request.priority
        updated_fields.append('priority')

    if request.metadata is not None:
        edge.metadata = request.metadata
        updated_fields.append('metadata')

    # Regenerate embedding if fact changed
    if 'fact' in updated_fields:
        await edge.generate_embedding(graphiti.embedder)
        updated_fields.append('fact_embedding')

    # Save the updated edge
    await edge.save(graphiti.driver)

    return UpdateFactResponse(
        uuid=uuid,
        updated_fields=updated_fields,
        message=f'Successfully updated fact {uuid}',
    )


@router.put('/entity/{uuid}', status_code=status.HTTP_200_OK)
async def update_entity(
    uuid: str,
    request: UpdateEntityRequest,
    graphiti: ZepGraphitiDep,
) -> UpdateEntityResponse:
    """Update an existing entity by UUID"""
    from graphiti_core.nodes import EntityNode

    # Get the existing entity
    entity = await EntityNode.get_by_uuid(graphiti.driver, uuid)

    # Track which fields were updated
    updated_fields = []

    # Update fields that were provided
    if request.name is not None:
        entity.name = request.name
        updated_fields.append('name')

    if request.summary is not None:
        entity.summary = request.summary
        updated_fields.append('summary')

    if request.tags is not None:
        entity.tags = request.tags
        updated_fields.append('tags')

    if request.priority is not None:
        entity.priority = request.priority
        updated_fields.append('priority')

    if request.metadata is not None:
        entity.metadata = request.metadata
        updated_fields.append('metadata')

    # Regenerate embedding if name changed
    if 'name' in updated_fields:
        await entity.generate_name_embedding(graphiti.embedder)
        updated_fields.append('name_embedding')

    # Save the updated entity
    await entity.save(graphiti.driver)

    return UpdateEntityResponse(
        uuid=uuid,
        updated_fields=updated_fields,
        message=f'Successfully updated entity {uuid}',
    )


@router.get('/duplicates/{group_id}', status_code=status.HTTP_200_OK)
async def find_duplicate_entities(
    group_id: str,
    graphiti: ZepGraphitiDep,
    similarity_threshold: float = Query(0.85, ge=0.0, le=1.0),
    limit: int = Query(50, ge=1, le=200),
) -> Dict[str, Any]:
    """Find potential duplicate entities using semantic similarity"""
    from graphiti_core.nodes import EntityNode
    from graphiti_core.utils.maintenance.graph_data_operations import cosine_similarity

    # Get all entities in the group
    entities = await EntityNode.get_by_group_ids(graphiti.driver, [group_id])

    # Load embeddings for all entities
    for entity in entities:
        try:
            await entity.load_name_embedding(graphiti.driver)
        except Exception as e:
            # Skip entities without embeddings
            continue

    duplicates = []
    checked_pairs = set()

    # Compare each pair of entities
    for i, entity1 in enumerate(entities):
        if not entity1.name_embedding:
            continue

        for entity2 in entities[i + 1 :]:
            if not entity2.name_embedding:
                continue

            # Skip if already checked
            pair_key = tuple(sorted([entity1.uuid, entity2.uuid]))
            if pair_key in checked_pairs:
                continue
            checked_pairs.add(pair_key)

            # Calculate similarity
            try:
                similarity = cosine_similarity(entity1.name_embedding, entity2.name_embedding)
            except Exception as e:
                # Skip if similarity calculation fails
                continue

            if similarity >= similarity_threshold:
                duplicates.append(
                    {
                        'entities': [
                            {
                                'uuid': entity1.uuid,
                                'name': entity1.name,
                                'summary': entity1.summary if hasattr(entity1, 'summary') else None,
                            },
                            {
                                'uuid': entity2.uuid,
                                'name': entity2.name,
                                'summary': entity2.summary if hasattr(entity2, 'summary') else None,
                            },
                        ],
                        'similarity': round(similarity, 4),
                    }
                )

    # Sort by similarity (highest first) and limit
    duplicates.sort(key=lambda x: x['similarity'], reverse=True)
    duplicates = duplicates[:limit]

    return {
        'group_id': group_id,
        'similarity_threshold': similarity_threshold,
        'total_duplicates': len(duplicates),
        'duplicates': duplicates,
    }
