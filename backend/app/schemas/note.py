from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, Field


# ── Request schemas ───────────────────────────────────────────────────────────

class BookNoteCreate(BaseModel):
    content: str = Field(min_length=1, max_length=100_000)
    is_public: bool = True  # Social comment by default
    parent_id: uuid.UUID | None = None  # Reply to another comment


class BookNoteUpdate(BaseModel):
    content: str | None = Field(default=None, min_length=1, max_length=100_000)
    is_public: bool | None = None


# ── Response schemas ──────────────────────────────────────────────────────────

class BookNoteResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    global_book_id: uuid.UUID
    parent_id: uuid.UUID | None = None
    content: str
    is_public: bool
    author_display_name: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class BookNotePublicResponse(BaseModel):
    """
    Response for public book comments and discussion.
    Does NOT expose user_id — only display name for privacy.
    """
    id: uuid.UUID
    global_book_id: uuid.UUID
    parent_id: uuid.UUID | None = None
    content: str
    author_display_name: str
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
