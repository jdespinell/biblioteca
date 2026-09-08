from __future__ import annotations

import uuid
from datetime import datetime
from pydantic import BaseModel, EmailStr, Field


class AdminUserResponse(BaseModel):
    id: uuid.UUID
    email: EmailStr
    full_name: str | None
    is_active: bool
    is_superuser: bool
    preferred_language: str
    created_at: datetime
    updated_at: datetime
    user_books_count: int = 0
    notes_count: int = 0

    model_config = {"from_attributes": True}


class AdminUserUpdate(BaseModel):
    is_active: bool | None = None
    is_superuser: bool | None = None
    full_name: str | None = None


class AdminPasswordReset(BaseModel):
    new_password: str = Field(min_length=8, max_length=100)


class AdminStatsResponse(BaseModel):
    total_users: int
    active_users: int
    superusers: int
    total_global_books: int
    total_user_books: int
    total_notes: int
    public_notes: int
