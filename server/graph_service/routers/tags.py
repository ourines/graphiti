"""
Tags Management Router
Provides tag/label management APIs for knowledge graph organization
"""

from typing import Any

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

from graph_service.zep_graphiti import ZepGraphitiDep

router = APIRouter(prefix='/tags', tags=['tags'])


# ==================== DTOs ====================


class ListTagsResponse(BaseModel):
    """Response from list tags operation"""

    tags: list[str]
    count: int
    entity_tags: list[str]
    message: str


class RenameTagRequest(BaseModel):
    """Request to rename a tag"""

    old_tag: str = Field(..., min_length=1)
    new_tag: str = Field(..., min_length=1)
    group_id: str | None = Field(None, description='Optional: limit to specific group')


class RenameTagResponse(BaseModel):
    """Response from rename tag operation"""

    message: str
    success: bool
    updated_count: int


# ==================== Endpoints ====================


@router.get('', response_model=ListTagsResponse)
async def list_tags(group_id: str | None = None, graphiti: ZepGraphitiDep = None):
    """
    List all unique tags/labels used in the knowledge graph.

    Returns:
    - All unique tags across entities
    - Can be filtered by group_id
    - Useful for tag discovery and management
    """
    try:
        # Get entity tags
        entity_query = """
        MATCH (n:Entity)
        """
        params: dict[str, Any] = {}

        if group_id:
            entity_query += ' WHERE n.group_id = $group_id'
            params['group_id'] = group_id

        entity_query += """
        UNWIND n.labels AS label
        RETURN DISTINCT label
        ORDER BY label
        """

        entity_result = await graphiti.driver.execute_query(entity_query, **params)
        entity_tags = [
            record['label'] for record in entity_result.records if record['label'] != 'Entity'
        ]

        # For now, return entity tags
        # In the future, facts could also have tags if we add that field
        all_tags = sorted(set(entity_tags))

        return ListTagsResponse(
            tags=all_tags,
            count=len(all_tags),
            entity_tags=entity_tags,
            message=f'Found {len(all_tags)} unique tags',
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f'Error listing tags: {str(e)}',
        )


@router.post('/rename', response_model=RenameTagResponse)
async def rename_tag(request: RenameTagRequest, graphiti: ZepGraphitiDep):
    """
    Rename a tag across all entities in the knowledge graph.

    This operation:
    - Finds all entities with the old tag
    - Replaces it with the new tag
    - Can be scoped to a specific group_id

    Useful for:
    - Fixing typos in tags
    - Standardizing tag naming
    - Consolidating similar tags
    """
    try:
        # Build query to find and update entities with the old tag
        query = """
        MATCH (n:Entity)
        WHERE $old_tag IN n.labels
        """
        params: dict[str, Any] = {
            'old_tag': request.old_tag,
            'new_tag': request.new_tag,
        }

        if request.group_id:
            query += ' AND n.group_id = $group_id'
            params['group_id'] = request.group_id

        query += """
        SET n.labels = [label IN n.labels WHERE label <> $old_tag] + $new_tag
        RETURN count(n) as updated_count
        """

        result = await graphiti.driver.execute_query(query, **params)

        updated_count = result.records[0]['updated_count'] if result.records else 0

        return RenameTagResponse(
            message=f'Successfully renamed tag "{request.old_tag}" to "{request.new_tag}" on {updated_count} entities',
            success=True,
            updated_count=updated_count,
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f'Error renaming tag: {str(e)}',
        )
