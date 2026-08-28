"""
SQLAlchemy model exports.
Import all models here so Alembic can discover them for migrations.
"""

from app.models.attachment import Attachment
from app.models.book_note import BookNote
from app.models.book_tag import BookTag
from app.models.global_book import GlobalBook
from app.models.location import Location
from app.models.user import User
from app.models.user_book import UserBook

__all__ = [
    "User",
    "GlobalBook",
    "UserBook",
    "Location",
    "BookNote",
    "Attachment",
    "BookTag",
]
