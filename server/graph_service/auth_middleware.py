import logging
import secrets

from fastapi import HTTPException, Request, status
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from graph_service.config import Settings

logger = logging.getLogger(__name__)

PUBLIC_ENDPOINTS = ['/healthcheck', '/docs', '/openapi.json']


class AuthMiddleware(BaseHTTPMiddleware):
    """Simple bearer token authentication middleware."""

    def __init__(self, app, settings: Settings):
        super().__init__(app)
        self.token = settings.graphiti_api_token

    async def dispatch(self, request: Request, call_next):
        # No token = no auth required
        if not self.token:
            return await call_next(request)

        # Public endpoints always allowed
        if any(request.url.path.startswith(ep) for ep in PUBLIC_ENDPOINTS):
            return await call_next(request)

        # Validate token
        auth_header = request.headers.get('Authorization', '')
        if not auth_header.startswith('Bearer '):
            return JSONResponse(
                status_code=status.HTTP_401_UNAUTHORIZED,
                content={'detail': 'Missing or invalid Authorization header'},
                headers={'WWW-Authenticate': 'Bearer'},
            )

        token = auth_header[7:]
        if not secrets.compare_digest(token, self.token):
            return JSONResponse(
                status_code=status.HTTP_401_UNAUTHORIZED,
                content={'detail': 'Invalid token'},
                headers={'WWW-Authenticate': 'Bearer'},
            )

        return await call_next(request)
