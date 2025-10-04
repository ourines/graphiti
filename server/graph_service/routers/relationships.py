from fastapi import APIRouter, status
from pydantic import BaseModel, Field

from graph_service.zep_graphiti import ZepGraphitiDep

router = APIRouter(prefix='/relationships', tags=['relationships'])


class RelationshipPathRequest(BaseModel):
    source_entity: str = Field(..., description='Source entity name or UUID')
    target_entity: str | None = Field(None, description='Target entity name or UUID (optional)')
    max_depth: int = Field(2, ge=1, le=5, description='Maximum relationship hops (1-5)')
    group_ids: list[str] | None = Field(None, description='Filter by specific project/group IDs')


class PathNode(BaseModel):
    uuid: str
    name: str
    type: str  # 'node' or 'relationship'
    group_id: str | None = None
    fact: str | None = None  # For relationships
    relation_type: str | None = None  # For relationships


class RelationshipPathResponse(BaseModel):
    paths: list[list[PathNode]]
    total_paths: int


@router.post('/find-path', status_code=status.HTTP_200_OK)
async def find_relationship_path(
    request: RelationshipPathRequest,
    graphiti: ZepGraphitiDep,
) -> RelationshipPathResponse:
    """
    Find relationship paths between entities (up to N hops).

    If target_entity is specified, finds shortest paths between source and target.
    If target_entity is None, finds all entities within max_depth hops from source.
    """

    if request.target_entity:
        # Find shortest paths between source and target
        group_filter = ''
        if request.group_ids:
            group_filter = """
            WHERE ALL(node IN nodes(path)
                WHERE node.group_id IN $group_ids)
            """

        query = f"""
        MATCH (source:Entity)
        WHERE source.name = $source OR source.uuid = $source

        MATCH (target:Entity)
        WHERE target.name = $target OR target.uuid = $target

        MATCH path = allShortestPaths(
            (source)-[*1..{request.max_depth}]-(target)
        )
        {group_filter}

        RETURN path
        LIMIT 10
        """

        records, _, _ = await graphiti.driver.execute_query(
            query,
            source=request.source_entity,
            target=request.target_entity,
            group_ids=request.group_ids,
        )
    else:
        # Find all paths within max_depth hops from source
        group_filter = ''
        if request.group_ids:
            group_filter = """
            WHERE ALL(node IN nodes(path)
                WHERE node.group_id IN $group_ids)
            """

        query = f"""
        MATCH (source:Entity)
        WHERE source.name = $source OR source.uuid = $source

        MATCH path = (source)-[*1..{request.max_depth}]-(connected:Entity)
        {group_filter}

        RETURN path
        LIMIT 50
        """

        records, _, _ = await graphiti.driver.execute_query(
            query,
            source=request.source_entity,
            group_ids=request.group_ids,
        )

    # Parse paths
    paths: list[list[PathNode]] = []
    for record in records:
        path_data = record['path']
        path_nodes: list[PathNode] = []

        nodes = path_data.nodes
        relationships = path_data.relationships

        # Interleave nodes and relationships
        for i, node in enumerate(nodes):
            path_nodes.append(
                PathNode(
                    uuid=node.get('uuid', ''),
                    name=node.get('name', ''),
                    type='node',
                    group_id=node.get('group_id'),
                )
            )

            if i < len(relationships):
                rel = relationships[i]
                path_nodes.append(
                    PathNode(
                        uuid=rel.get('uuid', ''),
                        name=rel.get('name', ''),
                        type='relationship',
                        fact=rel.get('fact'),
                        relation_type=rel.type,
                    )
                )

        paths.append(path_nodes)

    return RelationshipPathResponse(
        paths=paths,
        total_paths=len(paths),
    )


@router.get('/entity/{uuid}/neighbors', status_code=status.HTTP_200_OK)
async def get_entity_neighbors(
    uuid: str,
    graphiti: ZepGraphitiDep,
    depth: int = 1,
):
    """
    Get all neighboring entities within N hops of the specified entity.

    Returns entities sorted by distance and name.
    """
    query = f"""
    MATCH (source:Entity {{uuid: $uuid}})
    MATCH path = (source)-[*1..{depth}]-(neighbor:Entity)

    WITH neighbor, min(length(path)) as distance
    RETURN DISTINCT neighbor, distance
    ORDER BY distance, neighbor.name
    LIMIT 100
    """

    records, _, _ = await graphiti.driver.execute_query(
        query,
        uuid=uuid,
    )

    neighbors = []
    for record in records:
        node = record['neighbor']
        neighbors.append(
            {
                'uuid': node.get('uuid'),
                'name': node.get('name'),
                'group_id': node.get('group_id'),
                'distance': record['distance'],
            }
        )

    return {
        'source_uuid': uuid,
        'neighbors': neighbors,
        'total': len(neighbors),
    }
