from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class LocationCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=1000)


class LocationUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None


class LocationResponse(BaseModel):
    id: uuid.UUID
    name: str
    description: str | None
    created_at: datetime
    book_count: int = 0  # Injected by endpoint

    model_config = {"from_attributes": True}
