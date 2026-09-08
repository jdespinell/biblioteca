from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr, Field, field_validator


# ── Request schemas ───────────────────────────────────────────────────────────

class UserRegister(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=100)
    full_name: str | None = Field(default=None, max_length=255)
    preferred_language: str = Field(default="es", pattern="^(es|en|pt)$")

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if not any(c.isdigit() for c in v):
            raise ValueError("Password must contain at least one digit")
        return v


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserUpdate(BaseModel):
    full_name: str | None = Field(default=None, max_length=255)
    preferred_language: str | None = Field(default=None, pattern="^(es|en|pt)$")


# ── Response schemas ──────────────────────────────────────────────────────────

class UserResponse(BaseModel):
    id: uuid.UUID
    email: EmailStr
    full_name: str | None
    is_active: bool
    is_superuser: bool = False
    preferred_language: str
    created_at: datetime

    model_config = {"from_attributes": True}
