from __future__ import annotations

import uuid
from typing import Literal

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import selectinload

from app.core.dependencies import CurrentUser, DBSession
from app.models.attachment import Attachment
from app.models.book_tag import BookTag
from app.models.global_book import GlobalBook
from app.models.location import Location
from app.models.user_book import UserBook
from app.schemas.user_book import (
    AttachmentResponse,
    LocationBrief,
    TagsUpdate,
    UploadUrlRequest,
    UploadUrlResponse,
    UserBookCreate,
    UserBookResponse,
    UserBookStats,
    UserBookUpdate,
)
from app.services import storage_service

router = APIRouter(prefix="/user-books", tags=["user-books"])


async def _get_user_book_or_404(
    user_book_id: uuid.UUID, user_id: uuid.UUID, db
) -> UserBook:
    """Fetch a UserBook and verify ownership (RLS)."""
    result = await db.execute(
        select(UserBook)
        .options(
            selectinload(UserBook.global_book),
            selectinload(UserBook.location),
            selectinload(UserBook.attachments),
            selectinload(UserBook.tags),
        )
        .where(
            UserBook.id == user_book_id,
            UserBook.user_id == user_id,  # RLS
        )
    )
    ub: UserBook | None = result.scalar_one_or_none()
    if not ub:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="UserBook not found")
    return ub


def _serialize_user_book(ub: UserBook) -> UserBookResponse:
    from app.schemas.book import GlobalBookResponse

    return UserBookResponse(
        id=ub.id,
        global_book=GlobalBookResponse.model_validate(ub.global_book),
        status=ub.status,
        rating=ub.rating,
        location=LocationBrief.model_validate(ub.location) if ub.location else None,
        tags=[bt.tag for bt in ub.tags],
        attachments=[AttachmentResponse.model_validate(a) for a in ub.attachments],
        added_at=ub.added_at,
        updated_at=ub.updated_at,
    )


@router.get("/stats", response_model=UserBookStats)
async def get_stats(
    current_user: CurrentUser,
    db: DBSession,
) -> UserBookStats:
    """Return library statistics for the current user."""
    result = await db.execute(
        select(UserBook.status, func.count(UserBook.id))
        .where(UserBook.user_id == current_user.id)
        .group_by(UserBook.status)
    )
    rows = dict(result.all())
    return UserBookStats(
        total=sum(rows.values()),
        unread=rows.get("unread", 0),
        reading=rows.get("reading", 0),
        read=rows.get("read", 0),
        wishlist=rows.get("wishlist", 0),
    )


@router.get("/", response_model=list[UserBookResponse])
async def list_user_books(
    current_user: CurrentUser,
    db: DBSession,
    status_filter: str | None = Query(default=None, alias="status"),
    location_id: uuid.UUID | None = Query(default=None),
    tag: str | None = Query(default=None),
    search: str | None = Query(default=None, max_length=200),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> list[UserBookResponse]:
    """List the current user's books with optional filtering."""
    query = (
        select(UserBook)
        .options(
            selectinload(UserBook.global_book),
            selectinload(UserBook.location),
            selectinload(UserBook.attachments),
            selectinload(UserBook.tags),
        )
        .where(UserBook.user_id == current_user.id)  # RLS
    )

    if status_filter:
        query = query.where(UserBook.status == status_filter)

    if location_id:
        query = query.where(UserBook.location_id == location_id)

    if tag:
        query = query.join(UserBook.tags).where(BookTag.tag.ilike(f"%{tag}%"))

    if search:
        query = query.join(UserBook.global_book).where(
            or_(
                GlobalBook.title.ilike(f"%{search}%"),
                GlobalBook.author.ilike(f"%{search}%"),
            )
        )

    query = query.order_by(UserBook.added_at.desc()).limit(limit).offset(offset)
    result = await db.execute(query)
    user_books = result.scalars().unique().all()

    return [_serialize_user_book(ub) for ub in user_books]


@router.post("/", response_model=UserBookResponse, status_code=status.HTTP_201_CREATED)
async def create_user_book(
    body: UserBookCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> UserBookResponse:
    """Add a GlobalBook to the current user's library."""
    # Verify GlobalBook exists
    book_result = await db.execute(
        select(GlobalBook).where(GlobalBook.id == body.global_book_id)
    )
    if not book_result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="GlobalBook not found",
        )

    # Verify location belongs to user (if provided)
    if body.location_id:
        loc_result = await db.execute(
            select(Location).where(
                Location.id == body.location_id,
                Location.user_id == current_user.id,  # RLS
            )
        )
        if not loc_result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Location not found",
            )

    user_book = UserBook(
        user_id=current_user.id,
        global_book_id=body.global_book_id,
        status=body.status,
        location_id=body.location_id,
        rating=body.rating,
    )
    db.add(user_book)

    try:
        await db.flush()
    except IntegrityError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This book is already in your library",
        )

    # Add tags
    for tag_str in set(body.tags):
        db.add(BookTag(user_book_id=user_book.id, tag=tag_str.lower().strip()))

    await db.flush()

    # Reload with relationships
    return await _get_user_book_or_404(user_book.id, current_user.id, db)


@router.get("/{user_book_id}", response_model=UserBookResponse)
async def get_user_book(
    user_book_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> UserBookResponse:
    """Get a specific UserBook by ID (RLS: must belong to current user)."""
    ub = await _get_user_book_or_404(user_book_id, current_user.id, db)
    return _serialize_user_book(ub)


@router.patch("/{user_book_id}", response_model=UserBookResponse)
async def update_user_book(
    user_book_id: uuid.UUID,
    body: UserBookUpdate,
    current_user: CurrentUser,
    db: DBSession,
) -> UserBookResponse:
    """Update status, location or rating of a UserBook (RLS enforced)."""
    ub = await _get_user_book_or_404(user_book_id, current_user.id, db)

    if body.status is not None:
        ub.status = body.status
    if body.location_id is not None:
        ub.location_id = body.location_id
    if body.rating is not None:
        ub.rating = body.rating

    if body.tags is not None:
        # Replace all tags atomically
        for existing_tag in ub.tags:
            await db.delete(existing_tag)
        for tag_str in set(body.tags):
            db.add(BookTag(user_book_id=ub.id, tag=tag_str.lower().strip()))

    db.add(ub)
    await db.flush()

    return await _get_user_book_or_404(user_book_id, current_user.id, db)


@router.delete("/{user_book_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user_book(
    user_book_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> None:
    """Remove a book from the user's library (RLS enforced)."""
    ub = await _get_user_book_or_404(user_book_id, current_user.id, db)
    await db.delete(ub)


@router.post("/{user_book_id}/attachments/upload-url", response_model=UploadUrlResponse)
async def get_upload_url(
    user_book_id: uuid.UUID,
    body: UploadUrlRequest,
    current_user: CurrentUser,
    db: DBSession,
) -> UploadUrlResponse:
    """
    Generate a presigned MinIO URL for the client to upload a file directly.
    The backend never receives the file content — only the metadata reference.
    """
    ub = await _get_user_book_or_404(user_book_id, current_user.id, db)

    file_key = storage_service.build_file_key(
        user_id=current_user.id,
        user_book_id=ub.id,
        file_type=body.file_type,
        original_filename=body.original_filename,
    )

    upload_url = storage_service.get_presigned_upload_url(
        file_key=file_key,
        content_type=body.content_type,
        expires=3600,
    )

    # Register the attachment record (file will be uploaded by client)
    attachment = Attachment(
        user_book_id=ub.id,
        file_key=file_key,
        file_type=body.file_type,
        original_filename=body.original_filename,
    )
    db.add(attachment)

    return UploadUrlResponse(
        upload_url=upload_url,
        file_key=file_key,
        expires_in=3600,
    )


@router.get("/{user_book_id}/attachments", response_model=list[AttachmentResponse])
async def list_attachments(
    user_book_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> list[AttachmentResponse]:
    """List all attachments for a UserBook, with presigned download URLs."""
    ub = await _get_user_book_or_404(user_book_id, current_user.id, db)

    responses = []
    for attachment in ub.attachments:
        resp = AttachmentResponse.model_validate(attachment)
        # Inject presigned download URL
        resp.__dict__["download_url"] = storage_service.get_presigned_download_url(
            attachment.file_key
        )
        responses.append(resp)

    return responses


@router.delete(
    "/{user_book_id}/attachments/{attachment_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_attachment(
    user_book_id: uuid.UUID,
    attachment_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> None:
    """Delete an attachment from MinIO and remove the DB record (RLS enforced)."""
    ub = await _get_user_book_or_404(user_book_id, current_user.id, db)

    result = await db.execute(
        select(Attachment).where(
            Attachment.id == attachment_id,
            Attachment.user_book_id == ub.id,
        )
    )
    attachment: Attachment | None = result.scalar_one_or_none()

    if not attachment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Attachment not found"
        )

    storage_service.delete_file(attachment.file_key)
    await db.delete(attachment)
