import logging
from typing import Annotated

from fastapi import Depends, HTTPException
from graphiti_core import Graphiti  # type: ignore
from graphiti_core.edges import EntityEdge  # type: ignore
from graphiti_core.embedder import EmbedderClient, OpenAIEmbedder, OpenAIEmbedderConfig  # type: ignore
from graphiti_core.embedder.gemini import GeminiEmbedder, GeminiEmbedderConfig  # type: ignore
from graphiti_core.errors import EdgeNotFoundError, GroupsEdgesNotFoundError, NodeNotFoundError
from graphiti_core.llm_client import LLMClient  # type: ignore
from graphiti_core.llm_client.config import LLMConfig  # type: ignore
from graphiti_core.llm_client.gemini_client import GeminiClient  # type: ignore
from graphiti_core.llm_client.openai_client import OpenAIClient  # type: ignore
from graphiti_core.nodes import EntityNode, EpisodicNode  # type: ignore

from graph_service.config import ZepEnvDep
from graph_service.dto import FactResult

logger = logging.getLogger(__name__)


def create_llm_client(settings: ZepEnvDep) -> LLMClient:
    """根据配置创建相应的 LLM client"""
    provider = settings.llm_provider.lower()

    if provider == 'gemini':
        if not settings.google_api_key:
            raise ValueError('GOOGLE_API_KEY is required for Gemini provider')

        config = LLMConfig(
            api_key=settings.google_api_key,
            model=settings.model_name or 'gemini-2.5-flash',
        )
        logger.info(f'Using Gemini LLM client with model: {config.model}')
        logger.info(f'Gemini embedder model: {settings.embedder_model_name}')
        logger.info(f'Max tokens: {settings.max_tokens}')

        return GeminiClient(
            config=config,
            max_tokens=settings.max_tokens or 64000,
        )

    elif provider == 'openai':
        if not settings.openai_api_key:
            raise ValueError('OPENAI_API_KEY is required for OpenAI provider')

        config = LLMConfig(
            api_key=settings.openai_api_key,
            model=settings.model_name or 'gpt-4o',
        )
        if settings.openai_base_url:
            config.base_url = settings.openai_base_url

        logger.info(f'Using OpenAI LLM client with model: {config.model}')
        return OpenAIClient(config=config)

    elif provider == 'anthropic':
        try:
            from graphiti_core.llm_client.anthropic_client import AnthropicClient  # type: ignore
        except ImportError:
            raise ImportError(
                'anthropic is required for Anthropic provider. '
                'Install it with: pip install graphiti-core[anthropic]'
            )

        if not settings.anthropic_api_key:
            raise ValueError('ANTHROPIC_API_KEY is required for Anthropic provider')

        config = LLMConfig(
            api_key=settings.anthropic_api_key,
            model=settings.model_name or 'claude-3-5-sonnet-20241022',
        )
        logger.info(f'Using Anthropic LLM client with model: {config.model}')
        return AnthropicClient(config=config)

    elif provider == 'groq':
        try:
            from graphiti_core.llm_client.groq_client import GroqClient  # type: ignore
        except ImportError:
            raise ImportError(
                'groq is required for Groq provider. '
                'Install it with: pip install graphiti-core[groq]'
            )

        if not settings.groq_api_key:
            raise ValueError('GROQ_API_KEY is required for Groq provider')

        config = LLMConfig(
            api_key=settings.groq_api_key,
            model=settings.model_name or 'llama-3.3-70b-versatile',
        )
        logger.info(f'Using Groq LLM client with model: {config.model}')
        return GroqClient(config=config)

    else:
        raise ValueError(
            f'Unknown LLM provider: {provider}. '
            'Supported providers: gemini, openai, anthropic, groq'
        )


def create_embedder(settings: ZepEnvDep) -> EmbedderClient:
    """根据配置创建相应的 Embedder client"""
    provider = settings.llm_provider.lower()

    if provider == 'gemini':
        if not settings.google_api_key:
            raise ValueError('GOOGLE_API_KEY is required for Gemini provider')

        config = GeminiEmbedderConfig(
            api_key=settings.google_api_key,
            embedding_model=settings.embedder_model_name or 'text-embedding-001',
        )
        logger.info(f'Using Gemini Embedder with model: {config.embedding_model}')
        return GeminiEmbedder(config=config)

    elif provider == 'openai':
        if not settings.openai_api_key:
            raise ValueError('OPENAI_API_KEY is required for OpenAI provider')

        config = OpenAIEmbedderConfig(
            api_key=settings.openai_api_key,
            base_url=settings.openai_base_url,
            embedding_model=settings.embedding_model_name or 'text-embedding-3-small',
        )
        logger.info(f'Using OpenAI Embedder with model: {config.embedding_model}')
        return OpenAIEmbedder(config=config)

    elif provider in ['anthropic', 'groq']:
        # Anthropic 和 Groq 没有专用的 embedder，使用 OpenAI embedder
        # 这就是为什么需要 OPENAI_API_KEY 作为 fallback
        if not settings.openai_api_key:
            raise ValueError(
                f'{provider.upper()} provider requires OPENAI_API_KEY for embeddings. '
                f'Please set OPENAI_API_KEY in environment variables.'
            )

        config = OpenAIEmbedderConfig(
            api_key=settings.openai_api_key,
            base_url=settings.openai_base_url,
            embedding_model=settings.embedding_model_name or 'text-embedding-3-small',
        )
        logger.info(
            f'Using OpenAI Embedder as fallback for {provider.upper()} '
            f'(model: {config.embedding_model})'
        )
        return OpenAIEmbedder(config=config)

    else:
        raise ValueError(
            f'Unknown LLM provider: {provider}. '
            'Supported providers: gemini, openai, anthropic, groq'
        )


class ZepGraphiti(Graphiti):
    def __init__(
        self,
        uri: str,
        user: str,
        password: str,
        llm_client: LLMClient | None = None,
        embedder: EmbedderClient | None = None,
    ):
        super().__init__(uri, user, password, llm_client, embedder)

    async def save_entity_node(self, name: str, uuid: str, group_id: str, summary: str = ''):
        new_node = EntityNode(
            name=name,
            uuid=uuid,
            group_id=group_id,
            summary=summary,
        )
        await new_node.generate_name_embedding(self.embedder)
        await new_node.save(self.driver)
        return new_node

    async def get_entity_edge(self, uuid: str):
        try:
            edge = await EntityEdge.get_by_uuid(self.driver, uuid)
            return edge
        except EdgeNotFoundError as e:
            raise HTTPException(status_code=404, detail=e.message) from e

    async def delete_group(self, group_id: str):
        try:
            edges = await EntityEdge.get_by_group_ids(self.driver, [group_id])
        except GroupsEdgesNotFoundError:
            logger.warning(f'No edges found for group {group_id}')
            edges = []

        nodes = await EntityNode.get_by_group_ids(self.driver, [group_id])

        episodes = await EpisodicNode.get_by_group_ids(self.driver, [group_id])

        for edge in edges:
            await edge.delete(self.driver)

        for node in nodes:
            await node.delete(self.driver)

        for episode in episodes:
            await episode.delete(self.driver)

    async def delete_entity_edge(self, uuid: str):
        try:
            edge = await EntityEdge.get_by_uuid(self.driver, uuid)
            await edge.delete(self.driver)
        except EdgeNotFoundError as e:
            raise HTTPException(status_code=404, detail=e.message) from e

    async def delete_episodic_node(self, uuid: str):
        try:
            episode = await EpisodicNode.get_by_uuid(self.driver, uuid)
            await episode.delete(self.driver)
        except NodeNotFoundError as e:
            raise HTTPException(status_code=404, detail=e.message) from e


async def get_graphiti(settings: ZepEnvDep):
    # 创建 LLM client 和 Embedder
    llm_client = create_llm_client(settings)
    embedder = create_embedder(settings)

    client = ZepGraphiti(
        uri=settings.neo4j_uri,
        user=settings.neo4j_user,
        password=settings.neo4j_password,
        llm_client=llm_client,
        embedder=embedder,
    )

    try:
        yield client
    finally:
        await client.close()


async def initialize_graphiti(settings: ZepEnvDep):
    # 创建 LLM client 和 Embedder
    llm_client = create_llm_client(settings)
    embedder = create_embedder(settings)

    client = ZepGraphiti(
        uri=settings.neo4j_uri,
        user=settings.neo4j_user,
        password=settings.neo4j_password,
        llm_client=llm_client,
        embedder=embedder,
    )
    await client.build_indices_and_constraints()


def get_fact_result_from_edge(edge: EntityEdge):
    return FactResult(
        uuid=edge.uuid,
        name=edge.name,
        fact=edge.fact,
        valid_at=edge.valid_at,
        invalid_at=edge.invalid_at,
        created_at=edge.created_at,
        expired_at=edge.expired_at,
    )


ZepGraphitiDep = Annotated[ZepGraphiti, Depends(get_graphiti)]
