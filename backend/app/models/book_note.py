from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import TYPE_CHECKING

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.global_book import GlobalBook
    from app.models.user import User


class BookNote(Base):
    """
    Social comments and personal notes written by users about a book.
    - Multiple comments/notes allowed per user per book.
    - Can have parent_id to support reply threads.
    - is_public=True for public community comments, False for private notes.
    """

    __tablename__ = "book_notes"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    # RLS: validate user_id on every write
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    global_book_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("global_books.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Threading: reply to an existing comment
    parent_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("book_notes.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )

    content: Mapped[str] = mapped_column(Text, nullable=False, default="")

    # PRIVACY: False for private note, True for public community comment
    is_public: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=lambda: datetime.now(UTC),
        nullable=False,
    )

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="book_notes")
    global_book: Mapped["GlobalBook"] = relationship(
        "GlobalBook", back_populates="book_notes"
    )

    parent: Mapped["BookNote | None"] = relationship(
        "BookNote",
        remote_side="BookNote.id",
        back_populates="replies",
    )
    replies: Mapped[list["BookNote"]] = relationship(
        "BookNote",
        back_populates="parent",
        cascade="all, delete-orphan",
        order_by="BookNote.created_at.asc()",
    )

    def __repr__(self) -> str:
        return f"<BookNote id={self.id} user_id={self.user_id} parent_id={self.parent_id} is_public={self.is_public}>"
