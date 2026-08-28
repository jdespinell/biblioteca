from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, Enum, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.book_note import BookNote
    from app.models.user_book import UserBook


class GlobalBook(Base):
    """
    Universal book catalog. One record per unique book (keyed by ISBN).
    Shared across ALL users — no user-specific data lives here.
    """

    __tablename__ = "global_books"
    __table_args__ = (
        UniqueConstraint("isbn", name="uq_global_books_isbn"),
        UniqueConstraint("isbn13", name="uq_global_books_isbn13"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    # ISBN-10 or ISBN-13 — nullable for books without ISBNs (old/rare books)
    isbn: Mapped[str | None] = mapped_column(String(20), nullable=True, index=True)
    isbn13: Mapped[str | None] = mapped_column(String(20), nullable=True, index=True)

    title: Mapped[str] = mapped_column(String(500), nullable=False, index=True)
    author: Mapped[str] = mapped_column(String(500), nullable=False, index=True)
    publisher: Mapped[str | None] = mapped_column(String(255), nullable=True)
    language: Mapped[str] = mapped_column(String(10), default="es", nullable=False)
    cover_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    published_year: Mapped[int | None] = mapped_column(Integer, nullable=True)
    page_count: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Track where this book was sourced from
    source: Mapped[str] = mapped_column(
        Enum(
            "manual",
            "openlibrary",
            "googlebooks",
            "ai",
            name="book_source_enum",
        ),
        default="manual",
        nullable=False,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    user_books: Mapped[list["UserBook"]] = relationship(
        "UserBook", back_populates="global_book", cascade="all, delete-orphan"
    )
    book_notes: Mapped[list["BookNote"]] = relationship(
        "BookNote", back_populates="global_book", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<GlobalBook id={self.id} isbn={self.isbn} title={self.title!r}>"
