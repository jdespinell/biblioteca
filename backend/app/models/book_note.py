from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import TYPE_CHECKING

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Text,
    UniqueConstraint,
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
    Markdown note written by a user about a specific book.
    - One note per user per book (UniqueConstraint).
    - is_public=False by default (privacy first).
    - Public notes are shown in the social discover feed.
    """

    __tablename__ = "book_notes"
    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "global_book_id",
            name="uq_book_notes_user_book",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    # RLS: validate user_id on every read/write
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

    content: Mapped[str] = mapped_column(Text, nullable=False, default="")

    # PRIVACY: False by default — user must explicitly publish
    is_public: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

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

    def __repr__(self) -> str:
        return f"<BookNote id={self.id} user_id={self.user_id} is_public={self.is_public}>"
