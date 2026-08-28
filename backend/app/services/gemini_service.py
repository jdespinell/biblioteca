from __future__ import annotations

import base64
import json
import logging

import google.generativeai as genai

from app.core.config import settings
from app.schemas.ai import CoverRecognitionResponse

logger = logging.getLogger(__name__)

# Configure Gemini client once at module level
if settings.GEMINI_API_KEY:
    genai.configure(api_key=settings.GEMINI_API_KEY)


def _get_candidate_models() -> list[str]:
    """Return a list of candidate model names with user-configured model first."""
    primary = settings.GEMINI_MODEL.strip() or "gemini-1.5-flash-latest"
    fallbacks = [
        primary,
        "gemini-1.5-flash-latest",
        "gemini-1.5-flash",
        "gemini-2.0-flash",
        "gemini-1.5-pro-latest",
        "gemini-pro",
    ]
    seen = set()
    return [m for m in fallbacks if not (m in seen or seen.add(m))]


_COVER_RECOGNITION_PROMPT = """You are a book metadata extraction assistant.
Analyze the provided book cover image carefully and extract the following information.

Return ONLY valid JSON matching this exact schema — no markdown, no extra text:
{
  "title": "string (book title as shown on cover)",
  "author": "string (author name as shown on cover)",
  "publisher": "string or null (publisher name if visible)",
  "isbn": "string or null (ISBN number if visible on cover or back)",
  "confidence": number (your confidence in the extraction, between 0.0 and 1.0)
}

If any field is not visible or cannot be determined, use null for that field.
If no book is detected in the image, return all null values with confidence 0.0."""


async def recognize_cover(
    image_base64: str,
    mime_type: str = "image/jpeg",
) -> CoverRecognitionResponse:
    """
    Use Gemini Vision to extract book metadata from a cover image.

    Args:
        image_base64: Base64-encoded image data (without data URI prefix).
        mime_type: MIME type of the image.

    Returns:
        CoverRecognitionResponse with extracted metadata.
    """
    if not settings.GEMINI_API_KEY:
        logger.error("GEMINI_API_KEY is not configured")
        return CoverRecognitionResponse(confidence=0.0)

    try:
        image_bytes = base64.b64decode(image_base64)
    except Exception as e:
        logger.error("Failed to decode base64 image: %s", e)
        return CoverRecognitionResponse(confidence=0.0)

    models_to_try = _get_candidate_models()
    last_error: Exception | None = None

    for model_name in models_to_try:
        try:
            model = genai.GenerativeModel(
                model_name=model_name,
                generation_config=genai.GenerationConfig(
                    response_mime_type="application/json",
                    temperature=0.1,
                ),
            )

            response = await model.generate_content_async(
                [
                    _COVER_RECOGNITION_PROMPT,
                    {
                        "mime_type": mime_type,
                        "data": image_bytes,
                    },
                ]
            )

            raw_text = response.text.strip()
            parsed = json.loads(raw_text)

            return CoverRecognitionResponse(
                title=parsed.get("title"),
                author=parsed.get("author"),
                publisher=parsed.get("publisher"),
                isbn=parsed.get("isbn"),
                confidence=float(parsed.get("confidence", 0.0)),
            )
        except Exception as e:
            last_error = e
            logger.warning(
                "Gemini model '%s' failed for cover recognition: %s. Trying next candidate...",
                model_name,
                e,
            )

    logger.error("All candidate Gemini models failed for cover recognition. Last error: %s", last_error)
    return CoverRecognitionResponse(confidence=0.0)


async def summarize_book(title: str, author: str) -> str:
    """
    Generate a concise synopsis and summary in Spanish for a given book using Gemini.
    """
    if not settings.GEMINI_API_KEY:
        logger.error("GEMINI_API_KEY is not configured")
        return ""

    prompt = f"""Genera una sinopsis y resumen conciso en español del libro "{title}" del autor "{author}".
Estructura la respuesta de forma clara y atractiva para un lector:
- **Sinopsis**: (2-3 oraciones que expliquen la trama o idea central).
- **Temas principales**: (puntos clave o reflexiones importantes).
Sé elocuente y no agregues introducciones innecesarias."""

    models_to_try = _get_candidate_models()
    last_error: Exception | None = None

    for model_name in models_to_try:
        try:
            model = genai.GenerativeModel(model_name=model_name)
            response = await model.generate_content_async(prompt)
            if response.text and response.text.strip():
                return response.text.strip()
        except Exception as e:
            last_error = e
            logger.warning(
                "Gemini model '%s' failed for summarization: %s. Trying next candidate...",
                model_name,
                e,
            )

    logger.error("All candidate Gemini models failed for summarization. Last error: %s", last_error)
    return ""
