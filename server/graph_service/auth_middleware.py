"""
API Authentication Middleware for GraphiTi FastAPI Server

Implements Bearer Token and API Key authentication for public deployment.
"""

from fastapi import Request, HTTPException, status
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
import logging

from graph_service.config import Settings

logger = logging.getLogger(__name__)


class AuthMiddleware(BaseHTTPMiddleware):
    """Authentication middleware for FastAPI."""

    def __init__(self, app, settings: Settings):
        super().__init__(app)
        self.settings = settings
        self.public_endpoints = [
            endpoint.strip()
            for endpoint in settings.api_auth_public_endpoints.split(',')
        ]

    async def dispatch(self, request: Request, call_next):
        """Process request and validate authentication."""

        # Skip authentication if disabled
        if not self.settings.api_auth_enabled:
            return await call_next(request)

        # Check if this is a public endpoint
        if self._is_public_endpoint(request.url.path):
            logger.debug(f"Public endpoint accessed: {request.url.path}")
            return await call_next(request)

        # Validate authentication
        try:
            if self.settings.api_auth_method == 'bearer':
                self._validate_bearer_token(request)
            elif self.settings.api_auth_method == 'apikey':
                self._validate_api_key(request)
            else:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Invalid auth method: {self.settings.api_auth_method}"
                )

            # Authentication successful
            return await call_next(request)

        except HTTPException as e:
            logger.warning(
                f"Authentication failed for {request.method} {request.url.path}: {e.detail}"
            )

            # Return authentication error
            if self.settings.api_auth_method == 'bearer':
                return JSONResponse(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    content={"detail": e.detail},
                    headers={"WWW-Authenticate": "Bearer realm=\"GraphiTi API\""}
                )
            else:
                return JSONResponse(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    content={"detail": e.detail}
                )

    def _is_public_endpoint(self, path: str) -> bool:
        """Check if the path is a public endpoint."""
        return any(
            path == endpoint or path.startswith(f"{endpoint}/")
            for endpoint in self.public_endpoints
        )

    def _validate_bearer_token(self, request: Request) -> None:
        """Validate Bearer token authentication."""
        auth_header = request.headers.get("Authorization")

        if not auth_header:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Missing Authorization header"
            )

        if not auth_header.startswith("Bearer "):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid Authorization header format. Expected: Bearer <token>"
            )

        token = auth_header[7:].strip()  # Remove "Bearer " prefix

        if not token:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Empty bearer token"
            )

        if token != self.settings.api_auth_bearer_token:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid bearer token"
            )

        logger.debug("Bearer token validated successfully")

    def _validate_api_key(self, request: Request) -> None:
        """Validate API Key authentication."""
        api_key = request.headers.get("X-API-Key")

        if not api_key:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Missing X-API-Key header"
            )

        if not api_key.strip():
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Empty API key"
            )

        if api_key != self.settings.api_auth_api_key:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid API key"
            )

        logger.debug("API key validated successfully")
