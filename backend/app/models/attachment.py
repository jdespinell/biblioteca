from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, Enum, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.user_book import UserBook


class Attachment(Base):
    """
    Reference to a file (PDF or image) stored in MinIO/S3.
    Always scoped to a specific UserBook (and thus a specific user).
    Actual file content is retrieved via presigned URLs from MinIO.
    """

    __tablename__ = "attachments"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_book_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("user_books.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # S3/MinIO object key (e.g., 'users/{user_id}/books/{book_id}/file.pdf')
    file_key: Mapped[str] = mapped_column(String(1000), nullable=False)

    file_type: Mapped[str] = mapped_column(
        Enum("pdf", "image", name="attachment_type_enum"),
        nullable=False,
    )

    original_filename: Mapped[str] = mapped_column(String(255), nullable=False)

    uploaded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationship
    user_book: Mapped["UserBook"] = relationship(
        "UserBook", back_populates="attachments"
    )

    def __repr__(self) -> str:
        return f"<Attachment id={self.id} type={self.file_type} file={self.file_key!r}>"
