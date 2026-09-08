from __future__ import annotations

import uuid

from fastapi import APIRouter, Query
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.dependencies import CurrentUserOptional, DBSession
from app.models.book_note import BookNote
from app.models.global_book import GlobalBook
from app.models.user import User
from app.schemas.note import BookNotePublicResponse, DiscoverNote

router = APIRouter(prefix="/social", tags=["social"])

_ANONYMOUS_DISPLAY = "Un lector"  # Fallback when user has no name


@router.get("/notes/{global_book_id}", response_model=list[BookNotePublicResponse])
async def get_public_notes_for_book(
    global_book_id: uuid.UUID,
    db: DBSession,
    _current_user: CurrentUserOptional = None,
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> list[BookNotePublicResponse]:
    """
    Return public notes for a specific book.
    CRITICAL: WHERE is_public = true — never exposes private notes.
    Does NOT expose user_id in the response (privacy by design).
    """
    result = await db.execute(
        select(BookNote, User.full_name)
        .join(User, User.id == BookNote.user_id)
        .where(
            BookNote.global_book_id == global_book_id,
            BookNote.is_public == True,  # noqa: E712 — SQLAlchemy requires == True
        )
        .order_by(BookNote.updated_at.desc())
        .limit(limit)
        .offset(offset)
    )

    rows = result.all()
    return [
        BookNotePublicResponse(
            id=note.id,
            global_book_id=note.global_book_id,
            parent_id=note.parent_id,
            content=note.content,
            author_display_name=full_name or _ANONYMOUS_DISPLAY,
            created_at=note.created_at,
            updated_at=note.updated_at,
        )
        for note, full_name in rows
    ]


@router.get("/discover", response_model=list[DiscoverNote])
async def discover_feed(
    db: DBSession,
    _current_user: CurrentUserOptional = None,
    language: str | None = Query(default=None, max_length=10),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> list[DiscoverNote]:
    """
    Global feed of the most recently updated public notes.
    Includes book metadata for context.
    CRITICAL: WHERE is_public = true — strictly enforced.
    """
    query = (
        select(BookNote, User.full_name, GlobalBook)
        .join(User, User.id == BookNote.user_id)
        .join(GlobalBook, GlobalBook.id == BookNote.global_book_id)
        .where(
            BookNote.is_public == True,  # noqa: E712
            BookNote.content != "",  # Skip empty notes
        )
    )

    if language:
        query = query.where(GlobalBook.language == language)

    query = (
        query.order_by(BookNote.updated_at.desc())
        .limit(limit)
        .offset(offset)
    )

    result = await db.execute(query)
    rows = result.all()

    return [
        DiscoverNote(
            note_id=note.id,
            content=note.content,
            author_display_name=full_name or _ANONYMOUS_DISPLAY,
            updated_at=note.updated_at,
            book_id=book.id,
            book_title=book.title,
            book_author=book.author,
            book_cover_url=book.cover_url,
        )
        for note, full_name, book in rows
    ]
