from __future__ import annotations

import uuid

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import func, select

from app.core.dependencies import CurrentUser, DBSession
from app.models.location import Location
from app.models.user_book import UserBook
from app.schemas.location import LocationCreate, LocationResponse, LocationUpdate

router = APIRouter(prefix="/locations", tags=["locations"])


@router.get("", response_model=list[LocationResponse], include_in_schema=False)
@router.get("/", response_model=list[LocationResponse])
async def list_locations(
    current_user: CurrentUser,
    db: DBSession,
) -> list[LocationResponse]:
    """List all locations for the current user, with book counts."""
    # Get locations with book count in one query
    result = await db.execute(
        select(Location, func.count(UserBook.id).label("book_count"))
        .outerjoin(UserBook, UserBook.location_id == Location.id)
        .where(Location.user_id == current_user.id)
        .group_by(Location.id)
        .order_by(Location.name)
    )

    rows = result.all()
    return [
        LocationResponse(
            id=loc.id,
            name=loc.name,
            description=loc.description,
            created_at=loc.created_at,
            book_count=count,
        )
        for loc, count in rows
    ]


@router.post("", response_model=LocationResponse, status_code=status.HTTP_201_CREATED, include_in_schema=False)
@router.post("/", response_model=LocationResponse, status_code=status.HTTP_201_CREATED)
async def create_location(
    body: LocationCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> LocationResponse:
    """Create a new location for the current user."""
    location = Location(
        user_id=current_user.id,
        name=body.name,
        description=body.description,
    )
    db.add(location)
    await db.flush()
    return LocationResponse(
        id=location.id,
        name=location.name,
        description=location.description,
        created_at=location.created_at,
        book_count=0,
    )


@router.put("/{location_id}", response_model=LocationResponse)
async def update_location(
    location_id: uuid.UUID,
    body: LocationUpdate,
    current_user: CurrentUser,
    db: DBSession,
) -> LocationResponse:
    """Update a location. Only the owner can update it (RLS)."""
    result = await db.execute(
        select(Location).where(
            Location.id == location_id,
            Location.user_id == current_user.id,  # RLS
        )
    )
    location: Location | None = result.scalar_one_or_none()

    if not location:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Location not found")

    if body.name is not None:
        location.name = body.name
    if body.description is not None:
        location.description = body.description

    db.add(location)

    # Get book count for response
    count_result = await db.execute(
        select(func.count(UserBook.id)).where(UserBook.location_id == location_id)
    )
    book_count = count_result.scalar_one()

    return LocationResponse(
        id=location.id,
        name=location.name,
        description=location.description,
        created_at=location.created_at,
        book_count=book_count,
    )


@router.delete("/{location_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_location(
    location_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> None:
    """
    Delete a location. Sets location_id=NULL on associated UserBooks.
    Only the owner can delete it (RLS).
    """
    result = await db.execute(
        select(Location).where(
            Location.id == location_id,
            Location.user_id == current_user.id,  # RLS
        )
    )
    location: Location | None = result.scalar_one_or_none()

    if not location:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Location not found")

    await db.delete(location)  # ON DELETE SET NULL handles UserBooks FK
