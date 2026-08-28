from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import TYPE_CHECKING

from sqlalchemy import (
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.attachment import Attachment
    from app.models.book_tag import BookTag
    from app.models.global_book import GlobalBook
    from app.models.location import Location
    from app.models.user import User


class UserBook(Base):
    """
    Junction between a User and a GlobalBook.
    Stores all user-specific data: reading status, location, rating.
    UniqueConstraint prevents a user from adding the same book twice.
    """

    __tablename__ = "user_books"
    __table_args__ = (
        UniqueConstraint(
            "user_id", "global_book_id", name="uq_user_books_user_book"
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    # ── RLS: always filter by user_id ─────────────────────────────────────────
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
    location_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("locations.id", ondelete="SET NULL"),
        nullable=True,
    )

    status: Mapped[str] = mapped_column(
        String(50),
        default="unread",
        nullable=False,
        index=True,
    )

    rating: Mapped[int | None] = mapped_column(Integer, nullable=True)  # 1-5 stars

    added_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=lambda: datetime.now(UTC),
        nullable=False,
    )

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="user_books")
    global_book: Mapped["GlobalBook"] = relationship(
        "GlobalBook", back_populates="user_books"
    )
    location: Mapped["Location | None"] = relationship(
        "Location", back_populates="user_books"
    )
    attachments: Mapped[list["Attachment"]] = relationship(
        "Attachment", back_populates="user_book", cascade="all, delete-orphan"
    )
    tags: Mapped[list["BookTag"]] = relationship(
        "BookTag", back_populates="user_book", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<UserBook id={self.id} user_id={self.user_id} status={self.status}>"
