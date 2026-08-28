from __future__ import annotations

import uuid

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import or_, select
from sqlalchemy.exc import IntegrityError

from app.core.dependencies import CurrentUser, DBSession
from app.models.global_book import GlobalBook
from app.schemas.book import (
    GlobalBookCreate,
    GlobalBookResponse,
    GlobalBookSearchResult,
    GlobalBookUpdate,
)
from app.schemas.ai import ISBNLookupResponse
from app.services import isbn_service

router = APIRouter(prefix="/books", tags=["books"])


@router.get("", response_model=list[GlobalBookSearchResult], include_in_schema=False)
@router.get("/", response_model=list[GlobalBookSearchResult])
async def search_books(
    db: DBSession,
    q: str | None = Query(default=None, max_length=200),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> list[GlobalBookSearchResult]:
    """
    Search the global book catalog by title, author or ISBN.
    Returns lightweight results for search UX.
    """
    query = select(GlobalBook).order_by(GlobalBook.title)

    if q:
        search_term = f"%{q}%"
        query = query.where(
            or_(
                GlobalBook.title.ilike(search_term),
                GlobalBook.author.ilike(search_term),
                GlobalBook.isbn.ilike(search_term),
                GlobalBook.isbn13.ilike(search_term),
            )
        )

    query = query.limit(limit).offset(offset)
    result = await db.execute(query)
    books = result.scalars().all()

    return [GlobalBookSearchResult.model_validate(b) for b in books]


@router.get("/isbn/{isbn}", response_model=ISBNLookupResponse)
async def lookup_by_isbn(
    isbn: str,
    db: DBSession,
) -> ISBNLookupResponse:
    """
    Look up a book by ISBN.
    1. Check GlobalBooks DB first (no external call if already catalogued).
    2. If not found, query Open Library / Google Books.
    """
    clean_isbn = isbn.replace("-", "").replace(" ", "")

    # Check local DB first
    result = await db.execute(
        select(GlobalBook).where(
            or_(
                GlobalBook.isbn == clean_isbn,
                GlobalBook.isbn13 == clean_isbn,
            )
        )
    )
    book: GlobalBook | None = result.scalar_one_or_none()

    if book:
        return ISBNLookupResponse(
            isbn=book.isbn,
            isbn13=book.isbn13,
            title=book.title,
            author=book.author,
            publisher=book.publisher,
            language=book.language,
            cover_url=book.cover_url,
            description=book.description,
            published_year=book.published_year,
            page_count=book.page_count,
            source=book.source,
            found=True,
        )

    # Fetch from external API
    return await isbn_service.lookup_isbn(clean_isbn)


@router.get("/{book_id}", response_model=GlobalBookResponse)
async def get_book(
    book_id: uuid.UUID,
    db: DBSession,
) -> GlobalBookResponse:
    """Get a GlobalBook by its internal UUID."""
    result = await db.execute(select(GlobalBook).where(GlobalBook.id == book_id))
    book: GlobalBook | None = result.scalar_one_or_none()

    if not book:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Book not found")

    return GlobalBookResponse.model_validate(book)


@router.post(
    "",
    response_model=GlobalBookResponse,
    status_code=status.HTTP_201_CREATED,
    include_in_schema=False,
)
@router.post(
    "/",
    response_model=GlobalBookResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_book(
    body: GlobalBookCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> GlobalBookResponse:
    """
    Create a new GlobalBook entry.
    Returns 409 if ISBN already exists in the catalog.
    """
    # Check for existing book by ISBN in catalog (reuse if already present)
    if body.isbn or body.isbn13:
        conditions = []
        if body.isbn:
            conditions.append(GlobalBook.isbn == body.isbn)
        if body.isbn13:
            conditions.append(GlobalBook.isbn13 == body.isbn13)

        existing = await db.execute(select(GlobalBook).where(or_(*conditions)))
        existing_book = existing.scalar_one_or_none()
        if existing_book:
            return GlobalBookResponse.model_validate(existing_book)

    book = GlobalBook(**body.model_dump())
    db.add(book)
    await db.flush()

    return GlobalBookResponse.model_validate(book)


@router.patch("/{book_id}", response_model=GlobalBookResponse)
async def update_book(
    book_id: uuid.UUID,
    body: GlobalBookUpdate,
    current_user: CurrentUser,
    db: DBSession,
) -> GlobalBookResponse:
    """Update book metadata. Available to all authenticated users."""
    result = await db.execute(select(GlobalBook).where(GlobalBook.id == book_id))
    book: GlobalBook | None = result.scalar_one_or_none()

    if not book:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Book not found")

    for field, value in body.model_dump(exclude_none=True).items():
        setattr(book, field, value)

    db.add(book)
    return GlobalBookResponse.model_validate(book)
