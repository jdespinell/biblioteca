from __future__ import annotations

import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.core.dependencies import CurrentUser, DBSession
from app.models.book_note import BookNote
from app.models.global_book import GlobalBook
from app.schemas.note import BookNoteCreate, BookNoteResponse, BookNoteUpdate

router = APIRouter(prefix="/notes", tags=["notes"])


@router.get("/book/{global_book_id}", response_model=BookNoteResponse | None)
async def get_my_note(
    global_book_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> BookNoteResponse | None:
    """
    Get the current user's note for a specific book.
    Returns null if no note exists yet (not 404 — no note is valid state).
    """
    result = await db.execute(
        select(BookNote).where(
            BookNote.global_book_id == global_book_id,
            BookNote.user_id == current_user.id,  # RLS
        )
    )
    note: BookNote | None = result.scalar_one_or_none()

    if note is None:
        return None

    return BookNoteResponse.model_validate(note)


@router.put("/book/{global_book_id}", response_model=BookNoteResponse)
async def upsert_note(
    global_book_id: uuid.UUID,
    body: BookNoteCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> BookNoteResponse:
    """
    Create or update the current user's note for a book (upsert).
    Uses PostgreSQL INSERT ... ON CONFLICT DO UPDATE for atomic upsert.
    RLS: user_id is always taken from the JWT — client cannot spoof it.
    """
    # Verify GlobalBook exists
    book_result = await db.execute(
        select(GlobalBook).where(GlobalBook.id == global_book_id)
    )
    if not book_result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Book not found"
        )

    now = datetime.now(UTC)

    stmt = (
        pg_insert(BookNote)
        .values(
            user_id=current_user.id,
            global_book_id=global_book_id,
            content=body.content,
            is_public=body.is_public,
            created_at=now,
            updated_at=now,
        )
        .on_conflict_do_update(
            constraint="uq_book_notes_user_book",
            set_={
                "content": body.content,
                "is_public": body.is_public,
                "updated_at": now,
            },
        )
        .returning(BookNote)
    )

    result = await db.execute(stmt)
    note = result.scalar_one()

    return BookNoteResponse.model_validate(note)


@router.patch("/book/{global_book_id}", response_model=BookNoteResponse)
async def update_note(
    global_book_id: uuid.UUID,
    body: BookNoteUpdate,
    current_user: CurrentUser,
    db: DBSession,
) -> BookNoteResponse:
    """Partially update an existing note (content and/or is_public)."""
    result = await db.execute(
        select(BookNote).where(
            BookNote.global_book_id == global_book_id,
            BookNote.user_id == current_user.id,  # RLS
        )
    )
    note: BookNote | None = result.scalar_one_or_none()

    if not note:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Note not found. Create it first with PUT.",
        )

    if body.content is not None:
        note.content = body.content
    if body.is_public is not None:
        note.is_public = body.is_public

    note.updated_at = datetime.now(UTC)
    db.add(note)

    return BookNoteResponse.model_validate(note)


@router.delete("/book/{global_book_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_note(
    global_book_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> None:
    """Delete the current user's note for a book (RLS enforced)."""
    result = await db.execute(
        select(BookNote).where(
            BookNote.global_book_id == global_book_id,
            BookNote.user_id == current_user.id,  # RLS
        )
    )
    note: BookNote | None = result.scalar_one_or_none()

    if not note:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Note not found"
        )

    await db.delete(note)
