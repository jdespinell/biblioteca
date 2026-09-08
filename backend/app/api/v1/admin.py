from __future__ import annotations

import uuid
from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import selectinload

from app.core.dependencies import CurrentSuperuser, DBSession
from app.core.security import hash_password
from app.models.book_note import BookNote
from app.models.global_book import GlobalBook
from app.models.user import User
from app.models.user_book import UserBook
from app.schemas.admin import (
    AdminPasswordReset,
    AdminStatsResponse,
    AdminUserResponse,
    AdminUserUpdate,
)

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/stats", response_model=AdminStatsResponse)
async def get_admin_stats(
    current_admin: CurrentSuperuser,
    db: DBSession,
) -> AdminStatsResponse:
    """Return system-wide counts and statistics. Requires superuser privileges."""
    # User counts
    total_users_res = await db.execute(select(func.count(User.id)))
    total_users = total_users_res.scalar() or 0

    active_users_res = await db.execute(select(func.count(User.id)).where(User.is_active == True))
    active_users = active_users_res.scalar() or 0

    superusers_res = await db.execute(select(func.count(User.id)).where(User.is_superuser == True))
    superusers = superusers_res.scalar() or 0

    # Book counts
    global_books_res = await db.execute(select(func.count(GlobalBook.id)))
    total_global_books = global_books_res.scalar() or 0

    user_books_res = await db.execute(select(func.count(UserBook.id)))
    total_user_books = user_books_res.scalar() or 0

    # Notes counts
    total_notes_res = await db.execute(select(func.count(BookNote.id)))
    total_notes = total_notes_res.scalar() or 0

    public_notes_res = await db.execute(select(func.count(BookNote.id)).where(BookNote.is_public == True))
    public_notes = public_notes_res.scalar() or 0

    return AdminStatsResponse(
        total_users=total_users,
        active_users=active_users,
        superusers=superusers,
        total_global_books=total_global_books,
        total_user_books=total_user_books,
        total_notes=total_notes,
        public_notes=public_notes,
    )


@router.get("/users", response_model=list[AdminUserResponse])
async def list_users(
    current_admin: CurrentSuperuser,
    db: DBSession,
    q: str | None = Query(None, description="Search by email or full name"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
) -> list[AdminUserResponse]:
    """List all registered users with their library counts. Requires superuser privileges."""
    query = select(User).order_by(User.created_at.desc())

    if q and q.strip():
        search_term = f"%{q.strip().lower()}%"
        query = query.where(
            or_(
                func.lower(User.email).ilike(search_term),
                func.lower(User.full_name).ilike(search_term),
            )
        )

    query = query.limit(limit).offset(offset)
    users_res = await db.execute(query)
    users = users_res.scalars().all()

    # Get user_books count and notes count for these users
    user_ids = [u.id for u in users]
    book_counts_map: dict[uuid.UUID, int] = {}
    note_counts_map: dict[uuid.UUID, int] = {}

    if user_ids:
        b_res = await db.execute(
            select(UserBook.user_id, func.count(UserBook.id))
            .where(UserBook.user_id.in_(user_ids))
            .group_by(UserBook.user_id)
        )
        book_counts_map = dict(b_res.all())

        n_res = await db.execute(
            select(BookNote.user_id, func.count(BookNote.id))
            .where(BookNote.user_id.in_(user_ids))
            .group_by(BookNote.user_id)
        )
        note_counts_map = dict(n_res.all())

    results: list[AdminUserResponse] = []
    for u in users:
        results.append(
            AdminUserResponse(
                id=u.id,
                email=u.email,
                full_name=u.full_name,
                is_active=u.is_active,
                is_superuser=u.is_superuser,
                preferred_language=u.preferred_language,
                created_at=u.created_at,
                updated_at=u.updated_at,
                user_books_count=book_counts_map.get(u.id, 0),
                notes_count=note_counts_map.get(u.id, 0),
            )
        )

    return results


@router.patch("/users/{user_id}", response_model=AdminUserResponse)
async def update_user(
    user_id: uuid.UUID,
    body: AdminUserUpdate,
    current_admin: CurrentSuperuser,
    db: DBSession,
) -> AdminUserResponse:
    """Update user status or superuser status. Prevents self-lockout."""
    user_res = await db.execute(select(User).where(User.id == user_id))
    target_user = user_res.scalar_one_or_none()
    if not target_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado")

    # Safety checks for current admin modifying self
    if target_user.id == current_admin.id:
        if body.is_active is False:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No puedes desactivar tu propia cuenta de administrador",
            )
        if body.is_superuser is False:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No puedes revocar tus propios permisos de administrador",
            )

    if body.is_active is not None:
        target_user.is_active = body.is_active
    if body.is_superuser is not None:
        target_user.is_superuser = body.is_superuser
    if body.full_name is not None:
        target_user.full_name = body.full_name

    db.add(target_user)
    await db.flush()

    # Get counts
    b_count_res = await db.execute(select(func.count(UserBook.id)).where(UserBook.user_id == target_user.id))
    n_count_res = await db.execute(select(func.count(BookNote.id)).where(BookNote.user_id == target_user.id))

    return AdminUserResponse(
        id=target_user.id,
        email=target_user.email,
        full_name=target_user.full_name,
        is_active=target_user.is_active,
        is_superuser=target_user.is_superuser,
        preferred_language=target_user.preferred_language,
        created_at=target_user.created_at,
        updated_at=target_user.updated_at,
        user_books_count=b_count_res.scalar() or 0,
        notes_count=n_count_res.scalar() or 0,
    )


@router.post("/users/{user_id}/reset-password", status_code=status.HTTP_200_OK)
async def reset_user_password(
    user_id: uuid.UUID,
    body: AdminPasswordReset,
    current_admin: CurrentSuperuser,
    db: DBSession,
) -> dict[str, str]:
    """Force reset a user's password. Requires superuser privileges."""
    user_res = await db.execute(select(User).where(User.id == user_id))
    target_user = user_res.scalar_one_or_none()
    if not target_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado")

    target_user.hashed_password = hash_password(body.new_password)
    db.add(target_user)
    await db.flush()

    return {"detail": "Contraseña actualizada exitosamente"}


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: uuid.UUID,
    current_admin: CurrentSuperuser,
    db: DBSession,
) -> None:
    """Delete a user account and all their books/notes (cascade). Prevents deleting self."""
    if user_id == current_admin.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No puedes eliminar tu propia cuenta de administrador",
        )

    user_res = await db.execute(select(User).where(User.id == user_id))
    target_user = user_res.scalar_one_or_none()
    if not target_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado")

    await db.delete(target_user)
    await db.flush()
