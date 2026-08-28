from __future__ import annotations

from fastapi import APIRouter, HTTPException, status
from app.core.dependencies import CurrentUser, DBSession
from app.schemas.ai import (
    CoverRecognitionRequest,
    CoverRecognitionResponse,
    ISBNLookupResponse,
    BookSummarizeRequest,
    BookSummarizeResponse,
)
from app.services import gemini_service, isbn_service

router = APIRouter(prefix="/ai", tags=["ai"])


@router.post("/recognize-cover", response_model=CoverRecognitionResponse)
async def recognize_cover(
    body: CoverRecognitionRequest,
    current_user: CurrentUser,
) -> CoverRecognitionResponse:
    """
    Analyze a book cover image with Gemini Vision.
    
    The client sends the image as Base64. The backend forwards it to Gemini
    and returns structured metadata (title, author, publisher, ISBN).
    
    Rate limited: 10 req/min (configured in Nginx).
    """
    # Validate base64 isn't empty
    if not body.image_base64.strip():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="image_base64 cannot be empty",
        )

    # Validate MIME type
    allowed_types = {"image/jpeg", "image/jpg", "image/png", "image/webp"}
    if body.mime_type.lower() not in allowed_types:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"mime_type must be one of: {', '.join(allowed_types)}",
        )

    result = await gemini_service.recognize_cover(
        image_base64=body.image_base64,
        mime_type=body.mime_type,
    )

    return result


@router.post("/isbn-scan", response_model=ISBNLookupResponse)
async def scan_isbn(
    isbn: str,
    current_user: CurrentUser,
    db: DBSession,
) -> ISBNLookupResponse:
    """
    Look up book metadata by ISBN.
    Checks local DB first, then queries Open Library / Google Books.
    """
    if not isbn or not isbn.strip():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="ISBN cannot be empty",
        )

    # Delegate to the books endpoint logic (reuse isbn lookup)
    from app.services.isbn_service import lookup_isbn
    return await lookup_isbn(isbn.strip())


@router.post("/summarize", response_model=BookSummarizeResponse)
async def summarize_book(
    body: BookSummarizeRequest,
    current_user: CurrentUser,
) -> BookSummarizeResponse:
    """
    Generate an AI synopsis and key themes summary for a book using Gemini.
    """
    summary = await gemini_service.summarize_book(body.title, body.author)
    return BookSummarizeResponse(summary=summary)
