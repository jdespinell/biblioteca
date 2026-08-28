from __future__ import annotations

import base64
import json
import logging

import google.generativeai as genai

from app.core.config import settings
from app.schemas.ai import CoverRecognitionResponse

logger = logging.getLogger(__name__)

# Configure Gemini client once at module level
genai.configure(api_key=settings.GEMINI_API_KEY)

_GEMINI_MODEL = "gemini-1.5-flash"

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
        # Decode base64 to bytes
        image_bytes = base64.b64decode(image_base64)

        model = genai.GenerativeModel(
            model_name=_GEMINI_MODEL,
            generation_config=genai.GenerationConfig(
                response_mime_type="application/json",
                temperature=0.1,  # Low temperature for factual extraction
            ),
        )

        # Build multimodal content: text prompt + image
        response = await model.generate_content_async(
            [
                _COVER_RECOGNITION_PROMPT,
                {
                    "mime_type": mime_type,
                    "data": image_bytes,
                },
            ]
        )

        # Parse JSON response
        raw_text = response.text.strip()
        parsed = json.loads(raw_text)

        return CoverRecognitionResponse(
            title=parsed.get("title"),
            author=parsed.get("author"),
            publisher=parsed.get("publisher"),
            isbn=parsed.get("isbn"),
            confidence=float(parsed.get("confidence", 0.0)),
        )

    except json.JSONDecodeError as e:
        logger.error("Gemini returned invalid JSON: %s", e)
        return CoverRecognitionResponse(confidence=0.0)
    except Exception as e:
        logger.error("Gemini API error during cover recognition: %s", e)
        return CoverRecognitionResponse(confidence=0.0)
