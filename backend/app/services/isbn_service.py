from __future__ import annotations

import logging

import httpx

from app.core.config import settings
from app.schemas.ai import ISBNLookupResponse
from app.services import gemini_service

logger = logging.getLogger(__name__)

OPEN_LIBRARY_URL = "https://openlibrary.org/api/books"
GOOGLE_BOOKS_URL = "https://www.googleapis.com/books/v1/volumes"
USER_AGENT = "BibliotecaApp/1.0 (https://biblioteca.juliancloud.site; mailto:admin@juliancloud.site)"


async def lookup_isbn(isbn: str) -> ISBNLookupResponse:
    """
    Fetch book metadata:
    1. Open Library (bibkeys + /isbn/ endpoint with User-Agent)
    2. Google Books (q=isbn:... and q=... with 429 rate limit tolerance)
    3. Gemini AI (bibliographic database identification fallback)
    """
    clean_isbn = isbn.replace("-", "").replace(" ", "")

    # ── 1. Try Open Library ──────────────────────────────────────────────────
    try:
        result = await _lookup_open_library(clean_isbn)
        if result.found:
            return result
    except Exception as e:
        logger.warning("Open Library lookup failed for ISBN %s: %s", isbn, e)

    # ── 2. Fallback: Google Books ────────────────────────────────────────────
    try:
        result = await _lookup_google_books(clean_isbn)
        if result.found:
            return result
    except Exception as e:
        logger.warning("Google Books lookup failed for ISBN %s: %s", isbn, e)

    # ── 3. Fallback: Gemini AI ───────────────────────────────────────────────
    if settings.GEMINI_API_KEY:
        try:
            ai_result = await gemini_service.identify_book_by_isbn(clean_isbn)
            if ai_result and ai_result.found:
                logger.info("Book successfully identified via Gemini AI for ISBN %s: %s", clean_isbn, ai_result.title)
                return ai_result
        except Exception as e:
            logger.warning("Gemini ISBN identification failed for %s: %s", clean_isbn, e)

    return ISBNLookupResponse(isbn=clean_isbn, found=False)


async def _lookup_open_library(isbn: str) -> ISBNLookupResponse:
    # 1. Try legacy bibkeys endpoint
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.get(
                OPEN_LIBRARY_URL,
                params={
                    "bibkeys": f"ISBN:{isbn}",
                    "format": "json",
                    "jscmd": "data",
                },
                headers={"User-Agent": USER_AGENT},
            )
            if resp.status_code == 200:
                data = resp.json()
                key = f"ISBN:{isbn}"
                if key in data:
                    book = data[key]
                    authors = book.get("authors", [])
                    author_str = ", ".join(a.get("name", "") for a in authors) if authors else ""
                    publishers = book.get("publishers", [])
                    publisher_str = publishers[0].get("name", "") if publishers else None
                    covers = book.get("cover", {})
                    cover_url = covers.get("large") or covers.get("medium") or covers.get("small")

                    publish_date = book.get("publish_date", "")
                    published_year: int | None = None
                    if publish_date:
                        import re
                        year_match = re.search(r"\b(\d{4})\b", publish_date)
                        if year_match:
                            published_year = int(year_match.group(1))

                    desc = book.get("description", {}).get("value") if isinstance(
                        book.get("description"), dict
                    ) else book.get("description")

                    return ISBNLookupResponse(
                        isbn=isbn if len(isbn) == 10 else None,
                        isbn13=isbn if len(isbn) == 13 else None,
                        title=book.get("title", ""),
                        author=author_str,
                        publisher=publisher_str,
                        cover_url=cover_url,
                        description=desc,
                        published_year=published_year,
                        page_count=book.get("number_of_pages"),
                        source="openlibrary",
                        found=True,
                    )
    except Exception as e:
        logger.warning("Open Library bibkeys endpoint failed for %s: %s", isbn, e)

    # 2. Try direct /isbn/{isbn}.json endpoint
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.get(
                f"https://openlibrary.org/isbn/{isbn}.json",
                headers={"User-Agent": USER_AGENT},
                follow_redirects=True,
            )
            if resp.status_code == 200:
                data = resp.json()
                title = data.get("title")
                if title:
                    publishers = data.get("publishers", [])
                    publisher_str = publishers[0] if publishers else None

                    publish_date = data.get("publish_date", "")
                    published_year: int | None = None
                    if publish_date:
                        import re
                        year_match = re.search(r"\b(\d{4})\b", publish_date)
                        if year_match:
                            published_year = int(year_match.group(1))

                    return ISBNLookupResponse(
                        isbn=isbn if len(isbn) == 10 else None,
                        isbn13=isbn if len(isbn) == 13 else None,
                        title=title,
                        author="",
                        publisher=publisher_str,
                        cover_url=f"https://covers.openlibrary.org/b/isbn/{isbn}-L.jpg",
                        published_year=published_year,
                        page_count=data.get("number_of_pages"),
                        source="openlibrary",
                        found=True,
                    )
    except Exception as e:
        logger.warning("Open Library /isbn/ endpoint failed for %s: %s", isbn, e)

    return ISBNLookupResponse(isbn=isbn, found=False)


async def _lookup_google_books(isbn: str) -> ISBNLookupResponse:
    queries = [f"isbn:{isbn}", isbn]

    for q_term in queries:
        params: dict[str, str] = {"q": q_term}
        if settings.GOOGLE_BOOKS_API_KEY:
            params["key"] = settings.GOOGLE_BOOKS_API_KEY

        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                resp = await client.get(
                    GOOGLE_BOOKS_URL,
                    params=params,
                    headers={"User-Agent": USER_AGENT},
                )

                if resp.status_code == 429:
                    logger.warning("Google Books rate limit (429) hit for query '%s'", q_term)
                    break

                if resp.status_code != 200:
                    continue

                data = resp.json()
                items = data.get("items", [])
                if not items:
                    continue

                volume_info = items[0].get("volumeInfo", {})
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
                if cover_url:
                    cover_url = cover_url.replace("http://", "https://")

                pub_date = volume_info.get("publishedDate", "")
                published_year = (
                    int(pub_date[:4])
                    if pub_date and len(pub_date) >= 4 and pub_date[:4].isdigit()
                    else None
                )

                return ISBNLookupResponse(
                    isbn=isbn10 or (isbn if len(isbn) == 10 else None),
                    isbn13=isbn13 or (isbn if len(isbn) == 13 else None),
                    title=volume_info.get("title", ""),
                    author=author_str,
                    publisher=volume_info.get("publisher"),
                    language=volume_info.get("language"),
                    cover_url=cover_url,
                    description=volume_info.get("description"),
                    published_year=published_year,
                    page_count=volume_info.get("pageCount"),
                    source="googlebooks",
                    found=True,
                )
        except Exception as e:
            logger.warning("Google Books query '%s' failed: %s", q_term, e)

    return ISBNLookupResponse(isbn=isbn, found=False)


OPEN_LIBRARY_SEARCH_URL = "https://openlibrary.org/search.json"
USER_AGENT = "BibliotecaApp/1.0 (https://biblioteca.juliancloud.site)"


async def search_external_books(query: str, limit: int = 10) -> list[dict]:
    """
    Search Open Library (primary) and Google Books (fallback) by title, author, or keyword.
    Returns a normalized list of book dictionaries.
    """
    results: list[dict] = []
    seen_titles: set[str] = set()

    # ── 1. Search Open Library first (reliable, rich catalog, no 429 IP blocks) ──
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.get(
                OPEN_LIBRARY_SEARCH_URL,
                params={"q": query, "limit": min(max(limit, 8), 20)},
                headers={"User-Agent": USER_AGENT},
            )
            if resp.status_code == 200:
                data = resp.json()
                for doc in data.get("docs", []):
                    title = doc.get("title")
                    if not title:
                        continue

                    authors = doc.get("author_name", [])
                    author_str = ", ".join(authors[:2]) if authors else "Autor desconocido"

                    dedup_key = f"{title.lower().strip()}|{author_str.lower().strip()}"
                    if dedup_key in seen_titles:
                        continue
                    seen_titles.add(dedup_key)

                    cover_i = doc.get("cover_i")
                    cover_url = (
                        f"https://covers.openlibrary.org/b/id/{cover_i}-M.jpg"
                        if cover_i
                        else None
                    )

                    isbns = doc.get("isbn", [])
                    isbn = isbns[0] if isbns else None

                    year = doc.get("first_publish_year")
                    languages = doc.get("language", ["es"])
                    lang = languages[0] if languages else "es"

                    first_sent = doc.get("first_sentence")
                    desc = first_sent[0] if isinstance(first_sent, list) and first_sent else (first_sent if isinstance(first_sent, str) else None)

                    results.append({
                        "title": title,
                        "author": author_str,
                        "publisher": (doc.get("publisher") or [None])[0],
                        "isbn": isbn if isbn and len(isbn) == 10 else None,
                        "isbn13": isbn if isbn and len(isbn) == 13 else None,
                        "published_year": year,
                        "page_count": doc.get("number_of_pages_median"),
                        "language": lang,
                        "description": desc,
                        "cover_url": cover_url,
                        "source": "openlibrary",
                    })
    except Exception as e:
        logger.warning("Open Library search failed for %s: %s", query, e)

    # ── 2. Fallback / Supplement with Google Books ──
    if len(results) < limit:
        try:
            params: dict[str, str | int] = {
                "q": query,
                "maxResults": min(max(limit - len(results), 5), 10),
                "printType": "books",
            }
            if settings.GOOGLE_BOOKS_API_KEY:
                params["key"] = settings.GOOGLE_BOOKS_API_KEY

            async with httpx.AsyncClient(timeout=6.0) as client:
                resp = await client.get(
                    GOOGLE_BOOKS_URL,
                    params=params,
                    headers={"User-Agent": USER_AGENT},
                )
                items = []
                if resp.status_code == 200:
                    items = resp.json().get("items", [])

                # If no items found and query has multiple words, try intitle search
                if not items and " " in query:
                    params["q"] = f"intitle:{query}"
                    resp2 = await client.get(
                        GOOGLE_BOOKS_URL,
                        params=params,
                        headers={"User-Agent": USER_AGENT},
                    )
                    if resp2.status_code == 200:
                        items = resp2.json().get("items", [])

                for item in items:
                        vol = item.get("volumeInfo", {})
                        title = vol.get("title")
                        if not title:
                            continue

                        authors = vol.get("authors", [])
                        author_str = ", ".join(authors) if authors else "Autor desconocido"

                        dedup_key = f"{title.lower().strip()}|{author_str.lower().strip()}"
                        if dedup_key in seen_titles:
                            continue
                        seen_titles.add(dedup_key)

                        isbn10 = None
                        isbn13 = None
                        for ident in vol.get("industryIdentifiers", []):
                            if ident.get("type") == "ISBN_10":
                                isbn10 = ident.get("identifier")
                            elif ident.get("type") == "ISBN_13":
                                isbn13 = ident.get("identifier")

                        img = vol.get("imageLinks", {})
                        cover = (
                            img.get("thumbnail")
                            or img.get("smallThumbnail")
                            or img.get("medium")
                        )
                        if cover:
                            cover = cover.replace("http://", "https://")

                        pub_date = vol.get("publishedDate", "")
                        year = int(pub_date[:4]) if pub_date and len(pub_date) >= 4 and pub_date[:4].isdigit() else None

                        results.append({
                            "title": title,
                            "author": author_str,
                            "publisher": vol.get("publisher"),
                            "isbn": isbn10,
                            "isbn13": isbn13,
                            "published_year": year,
                            "page_count": vol.get("pageCount"),
                            "language": vol.get("language", "es"),
                            "description": vol.get("description"),
                            "cover_url": cover,
                            "source": "googlebooks",
                        })
        except Exception as e:
            logger.warning("Google Books fallback search failed for %s: %s", query, e)

    return results[:limit]
