from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from slowapi.util import get_remote_address

from app.api.v1 import api_router
from app.core.config import settings
from app.db.session import engine

logger = logging.getLogger(__name__)


# ── Rate Limiter ──────────────────────────────────────────────────────────────

limiter = Limiter(key_func=get_remote_address, default_limits=[])


# ── Lifespan ──────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Startup / shutdown lifecycle."""
    logger.info("🚀 Starting Biblioteca API — environment: %s", settings.ENVIRONMENT)

    # Test DB connectivity on startup
    try:
        async with engine.begin() as conn:
            await conn.execute(__import__("sqlalchemy").text("ALTER TABLE user_books ADD COLUMN IF NOT EXISTS summary TEXT;"))
            await conn.execute(__import__("sqlalchemy").text("ALTER TABLE book_notes DROP CONSTRAINT IF EXISTS uq_book_notes_user_book;"))
            await conn.execute(__import__("sqlalchemy").text("ALTER TABLE book_notes ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES book_notes(id) ON DELETE CASCADE;"))
            # If no superuser exists yet, promote the first user to superuser
            await conn.execute(
                __import__("sqlalchemy").text("""
                    UPDATE users 
                    SET is_superuser = true 
                    WHERE id = (
                        SELECT id FROM users ORDER BY created_at ASC LIMIT 1
                    )
                    AND NOT EXISTS (
                        SELECT 1 FROM users WHERE is_superuser = true
                    );
                """)
            )
        logger.info("✅ Database connection established, schema and superuser ensured")
    except Exception as e:
        logger.error("❌ Database connection failed: %s", e)
        raise

    yield

    logger.info("👋 Shutting down Biblioteca API")
    await engine.dispose()


# ── App ───────────────────────────────────────────────────────────────────────

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="SaaS API for personal book library management with social discovery",
    version=settings.VERSION,
    docs_url="/api/docs" if not settings.is_production else None,
    redoc_url="/api/redoc" if not settings.is_production else None,
    openapi_url="/api/openapi.json" if not settings.is_production else None,
    lifespan=lifespan,
)

# ── Middleware ────────────────────────────────────────────────────────────────

# Rate limiting (SlowAPI exception handler only)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS — allow all origins with credentials for cookies
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"https?://.*",
    allow_credentials=True,  # Required for HttpOnly cookie auth
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)


# ── Security headers middleware ───────────────────────────────────────────────

@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    if settings.is_production:
        response.headers["Strict-Transport-Security"] = (
            "max-age=31536000; includeSubDomains"
        )
    return response


# ── Routers ───────────────────────────────────────────────────────────────────

app.include_router(api_router, prefix=settings.API_V1_PREFIX)


# ── Health check ──────────────────────────────────────────────────────────────

@app.get("/health", tags=["health"], include_in_schema=False)
async def health_check() -> dict:
    return {
        "status": "ok",
        "version": settings.VERSION,
        "environment": settings.ENVIRONMENT,
    }
