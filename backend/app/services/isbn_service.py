from __future__ import annotations

import logging

import httpx

from app.schemas.ai import ISBNLookupResponse

logger = logging.getLogger(__name__)

OPEN_LIBRARY_URL = "https://openlibrary.org/api/books"
GOOGLE_BOOKS_URL = "https://www.googleapis.com/books/v1/volumes"


async def lookup_isbn(isbn: str) -> ISBNLookupResponse:
    """
    Fetch book metadata from Open Library (primary) or Google Books (fallback).
    Returns an ISBNLookupResponse with found=True if data was retrieved.
    """
    # Strip hyphens from ISBN
    clean_isbn = isbn.replace("-", "").replace(" ", "")

    # ── Try Open Library first ────────────────────────────────────────────────
    try:
        result = await _lookup_open_library(clean_isbn)
        if result.found:
            return result
    except Exception as e:
        logger.warning("Open Library lookup failed for ISBN %s: %s", isbn, e)

    # ── Fallback: Google Books ────────────────────────────────────────────────
    try:
        result = await _lookup_google_books(clean_isbn)
        if result.found:
            return result
    except Exception as e:
        logger.warning("Google Books lookup failed for ISBN %s: %s", isbn, e)

    return ISBNLookupResponse(isbn=clean_isbn, found=False)


async def _lookup_open_library(isbn: str) -> ISBNLookupResponse:
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(
            OPEN_LIBRARY_URL,
            params={
                "bibkeys": f"ISBN:{isbn}",
                "format": "json",
                "jscmd": "data",
            },
        )
        resp.raise_for_status()
        data = resp.json()

    key = f"ISBN:{isbn}"
    if key not in data:
        return ISBNLookupResponse(isbn=isbn, found=False)

    book = data[key]

    # Parse author(s)
    authors = book.get("authors", [])
    author_str = ", ".join(a.get("name", "") for a in authors) if authors else ""

    # Parse publisher
    publishers = book.get("publishers", [])
    publisher_str = publishers[0].get("name", "") if publishers else None

    # Parse cover
    covers = book.get("cover", {})
    cover_url = covers.get("large") or covers.get("medium") or covers.get("small")

    # Parse year
    publish_date = book.get("publish_date", "")
    published_year: int | None = None
    if publish_date:
        import re
        year_match = re.search(r"\b(\d{4})\b", publish_date)
        if year_match:
            published_year = int(year_match.group(1))

    return ISBNLookupResponse(
        isbn=isbn if len(isbn) == 10 else None,
        isbn13=isbn if len(isbn) == 13 else None,
        title=book.get("title", ""),
        author=author_str,
        publisher=publisher_str,
        cover_url=cover_url,
        description=book.get("description", {}).get("value") if isinstance(
            book.get("description"), dict
        ) else book.get("description"),
        published_year=published_year,
        page_count=book.get("number_of_pages"),
        source="openlibrary",
        found=True,
    )


async def _lookup_google_books(isbn: str) -> ISBNLookupResponse:
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(
            GOOGLE_BOOKS_URL,
            params={"q": f"isbn:{isbn}"},
        )
        resp.raise_for_status()
        data = resp.json()

    items = data.get("items", [])
    if not items:
        return ISBNLookupResponse(isbn=isbn, found=False)

    volume_info = items[0].get("volumeInfo", {})

    # Parse ISBN identifiers
    isbn10: str | None = None
    isbn13: str | None = None
    for identifier in volume_info.get("industryIdentifiers", []):
        if identifier.get("type") == "ISBN_10":
            isbn10 = identifier.get("identifier")
        elif identifier.get("type") == "ISBN_13":
            isbn13 = identifier.get("identifier")

    authors = volume_info.get("authors", [])
    author_str = ", ".join(authors) if authors else ""

    image_links = volume_info.get("imageLinks", {})
    cover_url = (
        image_links.get("large")
        or image_links.get("medium")
        or image_links.get("thumbnail")
    )
    # Google Books returns http, upgrade to https
    if cover_url:
        cover_url = cover_url.replace("http://", "https://")

    return ISBNLookupResponse(
        isbn=isbn10,
        isbn13=isbn13,
        title=volume_info.get("title", ""),
        author=author_str,
        publisher=volume_info.get("publisher"),
        language=volume_info.get("language"),
        cover_url=cover_url,
        description=volume_info.get("description"),
        published_year=int(volume_info["publishedDate"][:4])
        if volume_info.get("publishedDate")
        else None,
        page_count=volume_info.get("pageCount"),
        source="googlebooks",
        found=True,
    )
