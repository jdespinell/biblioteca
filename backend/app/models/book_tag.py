from __future__ import annotations

import uuid
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.user_book import UserBook


class BookTag(Base):
    """
    Hashtag/label associated with a UserBook.
    UniqueConstraint prevents duplicate tags per book-user combination.
    """

    __tablename__ = "book_tags"
    __table_args__ = (
        UniqueConstraint(
            "user_book_id", "tag", name="uq_book_tags_user_book_tag"
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_book_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("user_books.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    tag: Mapped[str] = mapped_column(String(100), nullable=False, index=True)

    # Relationship
    user_book: Mapped["UserBook"] = relationship("UserBook", back_populates="tags")

    def __repr__(self) -> str:
        return f"<BookTag id={self.id} tag={self.tag!r}>"
