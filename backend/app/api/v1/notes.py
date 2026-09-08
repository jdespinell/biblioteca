from __future__ import annotations

import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.dependencies import CurrentUser, DBSession
from app.models.book_note import BookNote
from app.models.global_book import GlobalBook
from app.schemas.note import BookNoteCreate, BookNoteResponse, BookNoteUpdate

router = APIRouter(prefix="/notes", tags=["notes"])


@router.get("/book/{global_book_id}", response_model=list[BookNoteResponse])
async def get_my_notes(
    global_book_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> list[BookNoteResponse]:
    """
    Get all notes and comments written by the current user for a specific book.
    Returns an empty list if none exist.
    """
    result = await db.execute(
        select(BookNote)
        .where(
            BookNote.global_book_id == global_book_id,
            BookNote.user_id == current_user.id,  # RLS
        )
        .order_by(BookNote.created_at.asc())
    )
    notes = result.scalars().all()

    return [
        BookNoteResponse(
            id=n.id,
            user_id=n.user_id,
            global_book_id=n.global_book_id,
            parent_id=n.parent_id,
            content=n.content,
            is_public=n.is_public,
            author_display_name=current_user.full_name or current_user.email,
            created_at=n.created_at,
            updated_at=n.updated_at,
        )
        for n in notes
    ]


@router.post("/book/{global_book_id}", response_model=BookNoteResponse, status_code=status.HTTP_201_CREATED)
@router.put("/book/{global_book_id}", response_model=BookNoteResponse)
async def create_note(
    global_book_id: uuid.UUID,
    body: BookNoteCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> BookNoteResponse:
    """
    Create a new comment or private note for a book, or reply to an existing comment.
    Allows multiple comments/notes per user per book.
    """
    # Verify GlobalBook exists
    book_result = await db.execute(
        select(GlobalBook).where(GlobalBook.id == global_book_id)
    )
    if not book_result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Libro no encontrado"
        )

    # If parent_id provided, verify parent exists and belongs to same book
    if body.parent_id:
        parent_res = await db.execute(
            select(BookNote).where(
                BookNote.id == body.parent_id,
                BookNote.global_book_id == global_book_id,
            )
        )
        if not parent_res.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="El comentario al que intentas responder no existe",
            )

    now = datetime.now(UTC)
    note = BookNote(
        user_id=current_user.id,
        global_book_id=global_book_id,
        parent_id=body.parent_id,
        content=body.content.strip(),
        is_public=body.is_public,
        created_at=now,
        updated_at=now,
    )
    db.add(note)
    await db.flush()

    return BookNoteResponse(
        id=note.id,
        user_id=note.user_id,
        global_book_id=note.global_book_id,
        parent_id=note.parent_id,
        content=note.content,
        is_public=note.is_public,
        author_display_name=current_user.full_name or current_user.email,
        created_at=note.created_at,
        updated_at=note.updated_at,
    )


@router.patch("/{note_id}", response_model=BookNoteResponse)
async def update_note(
    note_id: uuid.UUID,
    body: BookNoteUpdate,
    current_user: CurrentUser,
    db: DBSession,
) -> BookNoteResponse:
    """Update a specific note/comment. (RLS: must belong to current user)."""
    result = await db.execute(
        select(BookNote).where(
            BookNote.id == note_id,
            BookNote.user_id == current_user.id,  # RLS
        )
    )
    note: BookNote | None = result.scalar_one_or_none()

    if not note:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Nota o comentario no encontrado",
        )

    if body.content is not None:
        note.content = body.content.strip()
    if body.is_public is not None:
        note.is_public = body.is_public

    note.updated_at = datetime.now(UTC)
    db.add(note)
    await db.flush()

    return BookNoteResponse(
        id=note.id,
        user_id=note.user_id,
        global_book_id=note.global_book_id,
        parent_id=note.parent_id,
        content=note.content,
        is_public=note.is_public,
        author_display_name=current_user.full_name or current_user.email,
        created_at=note.created_at,
        updated_at=note.updated_at,
    )


@router.delete("/{note_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_note(
    note_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> None:
    """Delete a specific note/comment by ID (RLS enforced)."""
    result = await db.execute(
        select(BookNote).where(
            BookNote.id == note_id,
            BookNote.user_id == current_user.id,  # RLS
        )
    )
    note: BookNote | None = result.scalar_one_or_none()

    if not note:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Nota o comentario no encontrado"
        )

    await db.delete(note)
    await db.flush()
