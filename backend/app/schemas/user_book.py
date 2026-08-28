from __future__ import annotations

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.book import GlobalBookResponse


# ── Nested schemas ────────────────────────────────────────────────────────────

class LocationBrief(BaseModel):
    id: uuid.UUID
    name: str

    model_config = {"from_attributes": True}


class AttachmentResponse(BaseModel):
    id: uuid.UUID
    file_type: str
    original_filename: str
    uploaded_at: datetime
    # download_url is injected by the endpoint after generating presigned URL

    model_config = {"from_attributes": True}


# ── Request schemas ───────────────────────────────────────────────────────────

class UserBookCreate(BaseModel):
    global_book_id: uuid.UUID
    status: Literal["unread", "reading", "read", "wishlist"] = "unread"
    location_id: uuid.UUID | None = None
    rating: int | None = Field(default=None, ge=1, le=5)
    summary: str | None = None
    tags: list[str] = Field(default_factory=list, max_length=20)


class UserBookUpdate(BaseModel):
    status: Literal["unread", "reading", "read", "wishlist"] | None = None
    location_id: uuid.UUID | None = None
    rating: int | None = Field(default=None, ge=1, le=5)
    summary: str | None = None
    tags: list[str] | None = None


class UploadUrlRequest(BaseModel):
    file_type: Literal["pdf", "image"]
    original_filename: str = Field(min_length=1, max_length=255)
    content_type: str = Field(min_length=1, max_length=100)


# ── Response schemas ──────────────────────────────────────────────────────────

class UserBookResponse(BaseModel):
    id: uuid.UUID
    global_book: GlobalBookResponse
    status: str
    rating: int | None
    summary: str | None = None
    location: LocationBrief | None
    tags: list[str]
    attachments: list[AttachmentResponse]
    added_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class UserBookStats(BaseModel):
    total: int
    unread: int
    reading: int
    read: int
    wishlist: int


class UploadUrlResponse(BaseModel):
    upload_url: str
    file_key: str
    expires_in: int


class TagsUpdate(BaseModel):
    tags: list[str] = Field(max_length=20)
