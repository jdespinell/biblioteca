from __future__ import annotations

import logging
import uuid
from typing import Literal

import boto3
from botocore.exceptions import ClientError

from app.core.config import settings

logger = logging.getLogger(__name__)


def _get_s3_client():
    """Create a boto3 S3 client pointing to MinIO."""
    return boto3.client(
        "s3",
        endpoint_url=settings.MINIO_ENDPOINT,
        aws_access_key_id=settings.MINIO_ACCESS_KEY,
        aws_secret_access_key=settings.MINIO_SECRET_KEY,
        region_name="us-east-1",  # MinIO ignores region but boto3 requires it
    )


def build_file_key(
    user_id: uuid.UUID,
    user_book_id: uuid.UUID,
    file_type: Literal["pdf", "image"],
    original_filename: str,
) -> str:
    """
    Build a structured S3/MinIO object key.
    Example: 'users/abc-123/books/def-456/image/cover.jpg'
    """
    safe_filename = original_filename.replace("/", "_").replace("..", "")
    return f"users/{user_id}/books/{user_book_id}/{file_type}/{safe_filename}"


def get_presigned_upload_url(
    file_key: str,
    content_type: str,
    expires: int = 3600,
) -> str:
    """
    Generate a presigned URL for the client to upload a file directly to MinIO.
    The URL expires after `expires` seconds.
    """
    client = _get_s3_client()
    url: str = client.generate_presigned_url(
        "put_object",
        Params={
            "Bucket": settings.MINIO_BUCKET_NAME,
            "Key": file_key,
            "ContentType": content_type,
        },
        ExpiresIn=expires,
    )
    return url


def get_presigned_download_url(
    file_key: str,
    expires: int = 3600,
) -> str:
    """
    Generate a presigned URL for the client to download a file from MinIO.
    """
    client = _get_s3_client()
    url: str = client.generate_presigned_url(
        "get_object",
        Params={
            "Bucket": settings.MINIO_BUCKET_NAME,
            "Key": file_key,
        },
        ExpiresIn=expires,
    )
    return url


def delete_file(file_key: str) -> None:
    """Delete a file from MinIO/S3."""
    try:
        client = _get_s3_client()
        client.delete_object(
            Bucket=settings.MINIO_BUCKET_NAME,
            Key=file_key,
        )
    except ClientError as e:
        logger.error("Failed to delete file %s from MinIO: %s", file_key, e)
        raise
