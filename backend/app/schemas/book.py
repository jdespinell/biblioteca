from __future__ import annotations

import uuid
from datetime import datetime
from typing import Literal

from pydantic import AnyHttpUrl, BaseModel, Field


# ── Request schemas ───────────────────────────────────────────────────────────

class GlobalBookCreate(BaseModel):
    isbn: str | None = Field(default=None, max_length=20)
    isbn13: str | None = Field(default=None, max_length=20)
    title: str = Field(min_length=1, max_length=500)
    author: str = Field(min_length=1, max_length=500)
    publisher: str | None = Field(default=None, max_length=255)
    language: str = Field(default="es", max_length=10)
    cover_url: str | None = None
    description: str | None = None
    published_year: int | None = Field(default=None, ge=1000, le=2100)
    page_count: int | None = Field(default=None, ge=1)
    source: Literal["manual", "openlibrary", "googlebooks", "ai"] = "manual"


class GlobalBookUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=500)
    author: str | None = Field(default=None, min_length=1, max_length=500)
    publisher: str | None = None
    language: str | None = None
    cover_url: str | None = None
    description: str | None = None
    published_year: int | None = Field(default=None, ge=1000, le=2100)
    page_count: int | None = Field(default=None, ge=1)


# ── Response schemas ──────────────────────────────────────────────────────────

class GlobalBookResponse(BaseModel):
    id: uuid.UUID
    isbn: str | None
    isbn13: str | None
    title: str
    author: str
    publisher: str | None
    language: str
    cover_url: str | None
    description: str | None
    published_year: int | None
    page_count: int | None
    source: str
    created_at: datetime

    model_config = {"from_attributes": True}


class GlobalBookSearchResult(BaseModel):
    """Lightweight response for search results."""
    id: uuid.UUID
    isbn: str | None
    title: str
    author: str
    publisher: str | None = None
    cover_url: str | None
    published_year: int | None
    description: str | None = None

    model_config = {"from_attributes": True}
