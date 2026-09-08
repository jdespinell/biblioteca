from __future__ import annotations

from pydantic import BaseModel, Field


class CoverRecognitionRequest(BaseModel):
    image_base64: str = Field(
        description="Base64-encoded image data (without data URI prefix)"
    )
    mime_type: str = Field(
        default="image/jpeg",
        description="MIME type of the image (image/jpeg, image/png, image/webp)",
    )


class CoverRecognitionResponse(BaseModel):
    title: str | None = None
    author: str | None = None
    publisher: str | None = None
    isbn: str | None = None
    confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    box_2d: list[int] | None = None


class ISBNLookupResponse(BaseModel):
    isbn: str | None = None
    isbn13: str | None = None
    title: str | None = None
    author: str | None = None
    publisher: str | None = None
    language: str | None = None
    cover_url: str | None = None
    description: str | None = None
    published_year: int | None = None
    page_count: int | None = None
    source: str = "openlibrary"
    found: bool = False


class BookSummarizeRequest(BaseModel):
    title: str
    author: str


class BookSummarizeResponse(BaseModel):
    summary: str
