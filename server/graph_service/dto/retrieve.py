from datetime import datetime, timezone

from pydantic import BaseModel, Field

from graph_service.dto.common import Message


class SearchQuery(BaseModel):
    group_ids: list[str] | None = Field(
        None, description='The group ids for the memories to search'
    )
    priority_group_id: str | None = Field(None, description='优先搜索的 group_id，结果会排在前面')
    query: str
    max_facts: int = Field(default=10, description='The maximum number of facts to retrieve')
    start_time: datetime | None = Field(
        None, description='Filter facts valid after this time (ISO 8601 format)'
    )
    end_time: datetime | None = Field(
        None, description='Filter facts valid before this time (ISO 8601 format)'
    )
    min_priority: int | None = Field(None, description='最小优先级过滤（0-10）', ge=0, le=10)
    tags: list[str] | None = Field(None, description='按标签过滤')


class FactResult(BaseModel):
    uuid: str
    name: str
    fact: str
    valid_at: datetime | None
    invalid_at: datetime | None
    created_at: datetime
    expired_at: datetime | None
    # 新增字段
    source_group_id: str = Field(..., description='来源项目的 group_id')
    relevance_score: float | None = Field(None, description='相关性评分 0-1')
    tags: list[str] = Field(default_factory=list, description='标签列表')
    priority: int = Field(default=0, description='优先级 0-10', ge=0, le=10)

    class Config:
        json_encoders = {datetime: lambda v: v.astimezone(timezone.utc).isoformat()}


class SearchResults(BaseModel):
    facts: list[FactResult]


class GetMemoryRequest(BaseModel):
    group_id: str = Field(..., description='The group id of the memory to get')
    max_facts: int = Field(default=10, description='The maximum number of facts to retrieve')
    center_node_uuid: str | None = Field(
        ..., description='The uuid of the node to center the retrieval on'
    )
    messages: list[Message] = Field(
        ..., description='The messages to build the retrieval query from '
    )


class GetMemoryResponse(BaseModel):
    facts: list[FactResult] = Field(..., description='The facts that were retrieved from the graph')
