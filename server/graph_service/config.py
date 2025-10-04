from functools import lru_cache
from typing import Annotated

from fastapi import Depends
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict  # type: ignore


class Settings(BaseSettings):
    # LLM Provider selection
    llm_provider: str = Field('gemini', description='LLM provider: gemini, openai, anthropic, groq')

    # Gemini settings
    google_api_key: str | None = Field(None)
    model_name: str | None = Field('gemini-2.5-flash')  # Gemini 使用 model_name 而非 gemini_model
    embedder_model_name: str | None = Field('gemini-embedding-001')  # Gemini embedding 模型
    max_tokens: int | None = Field(64000)  # 最大 token（防止 JSON 截断）

    # OpenAI settings (Anthropic/Groq 需要用于 embedding)
    openai_api_key: str | None = Field(None)
    openai_base_url: str | None = Field(None)
    embedding_model_name: str | None = Field(None)  # OpenAI embedding 模型（Anthropic/Groq 需要）

    # Anthropic settings
    anthropic_api_key: str | None = Field(None)

    # Groq settings
    groq_api_key: str | None = Field(None)

    # Neo4j settings
    neo4j_uri: str
    neo4j_user: str
    neo4j_password: str

    # API Authentication (if set, enables bearer token auth)
    graphiti_api_token: str | None = Field(None, description='API token for authentication')

    model_config = SettingsConfigDict(
        extra='ignore',
        # Docker 容器中从环境变量读取，不需要 .env 文件
    )


@lru_cache
def get_settings():
    return Settings()  # type: ignore[call-arg]


ZepEnvDep = Annotated[Settings, Depends(get_settings)]
