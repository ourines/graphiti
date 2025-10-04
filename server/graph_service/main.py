from contextlib import asynccontextmanager
import logging

from fastapi import FastAPI
from fastapi.responses import JSONResponse

from graph_service.config import get_settings
from graph_service.routers import ingest, relationships, retrieve
from graph_service.zep_graphiti import initialize_graphiti
from graph_service.auth_middleware import AuthMiddleware

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_: FastAPI):
    settings = get_settings()
    await initialize_graphiti(settings)

    # Log authentication status
    if settings.api_auth_enabled:
        logger.info(f"🔒 API Authentication enabled: {settings.api_auth_method} method")
        logger.info(f"📋 Public endpoints: {settings.api_auth_public_endpoints}")
    else:
        logger.warning("⚠️  API Authentication disabled - not recommended for public deployment")

    yield
    # Shutdown
    # No need to close Graphiti here, as it's handled per-request


app = FastAPI(lifespan=lifespan)

# Apply authentication middleware
settings = get_settings()
app.add_middleware(AuthMiddleware, settings=settings)

app.include_router(retrieve.router)
app.include_router(ingest.router)
app.include_router(relationships.router)


@app.get('/healthcheck')
async def healthcheck():
    return JSONResponse(content={'status': 'healthy'}, status_code=200)
