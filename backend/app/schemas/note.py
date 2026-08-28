from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, Field


# ── Request schemas ───────────────────────────────────────────────────────────

class BookNoteCreate(BaseModel):
    content: str = Field(default="", max_length=100_000)
    is_public: bool = False  # Privacy by default


class BookNoteUpdate(BaseModel):
    content: str | None = Field(default=None, max_length=100_000)
    is_public: bool | None = None


# ── Response schemas ──────────────────────────────────────────────────────────

class BookNoteResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    global_book_id: uuid.UUID
    content: str
    is_public: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class BookNotePublicResponse(BaseModel):
    """
    Response for public discovery feed.
    Does NOT expose user_id — only display name for privacy.
    """
    id: uuid.UUID
    global_book_id: uuid.UUID
    content: str
    author_display_name: str  # Injected from user.full_name or 'Reader'
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class DiscoverNote(BaseModel):
    """Extended public note with book info for the discover feed."""
    note_id: uuid.UUID
    content: str
    author_display_name: str
    updated_at: datetime
    # Book info
    book_id: uuid.UUID
    book_title: str
    book_author: str
    book_cover_url: str | None
