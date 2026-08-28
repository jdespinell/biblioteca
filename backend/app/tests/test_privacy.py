"""Tests for privacy — private notes must never appear in public feed."""
from __future__ import annotations

import pytest
from httpx import AsyncClient


BOOK_PAYLOAD = {
    "title": "El Quijote",
    "author": "Miguel de Cervantes",
    "isbn": "9780142437230",
    "language": "es",
    "source": "manual",
}


@pytest.mark.asyncio
async def test_private_note_not_in_feed(auth_client: AsyncClient):
    """A private note (is_public=False) must NOT appear in the social feed."""
    # Create a GlobalBook
    book_resp = await auth_client.post("/api/v1/books/", json=BOOK_PAYLOAD)
    assert book_resp.status_code == 201
    book_id = book_resp.json()["id"]

    # Write a PRIVATE note
    note_resp = await auth_client.put(
        f"/api/v1/notes/book/{book_id}",
        json={"content": "This is my private thought.", "is_public": False},
    )
    assert note_resp.status_code == 200
    assert note_resp.json()["is_public"] is False

    # Social feed should NOT include it
    feed_resp = await auth_client.get(f"/api/v1/social/notes/{book_id}")
    assert feed_resp.status_code == 200
    notes = feed_resp.json()
    assert all(n["id"] != note_resp.json()["id"] for n in notes)


@pytest.mark.asyncio
async def test_public_note_appears_in_feed(auth_client: AsyncClient):
    """A public note (is_public=True) MUST appear in the social feed."""
    book_resp = await auth_client.post("/api/v1/books/", json={**BOOK_PAYLOAD, "isbn": "9780142437231"})
    assert book_resp.status_code == 201
    book_id = book_resp.json()["id"]

    note_resp = await auth_client.put(
        f"/api/v1/notes/book/{book_id}",
        json={"content": "Great book! Highly recommend.", "is_public": True},
    )
    assert note_resp.status_code == 200

    feed_resp = await auth_client.get(f"/api/v1/social/notes/{book_id}")
    assert feed_resp.status_code == 200
    notes = feed_resp.json()
    assert len(notes) == 1
    assert notes[0]["content"] == "Great book! Highly recommend."
    # user_id must NOT be in the public response
    assert "user_id" not in notes[0]


@pytest.mark.asyncio
async def test_user_cannot_edit_other_users_note(client: AsyncClient):
    """User A cannot modify User B's note."""
    # Register two users
    await client.post(
        "/api/v1/auth/register",
        json={"email": "userA@test.com", "password": "password123"},
    )
    await client.post(
        "/api/v1/auth/register",
        json={"email": "userB@test.com", "password": "password123"},
    )

    # Login as A and create a book + note
    login_a = await client.post(
        "/api/v1/auth/login",
        json={"email": "userA@test.com", "password": "password123"},
    )
    assert login_a.status_code == 200

    book_resp = await client.post(
        "/api/v1/books/",
        json={**BOOK_PAYLOAD, "isbn": "9780142437299"},
    )
    assert book_resp.status_code == 201
    book_id = book_resp.json()["id"]

    note_a = await client.put(
        f"/api/v1/notes/book/{book_id}",
        json={"content": "User A's note", "is_public": False},
    )
    assert note_a.status_code == 200

    # Login as B
    await client.post("/api/v1/auth/logout")
    login_b = await client.post(
        "/api/v1/auth/login",
        json={"email": "userB@test.com", "password": "password123"},
    )
    assert login_b.status_code == 200

    # B tries to GET the private note — should get null (not found, not 403 info leak)
    note_b_resp = await client.get(f"/api/v1/notes/book/{book_id}")
    assert note_b_resp.status_code == 200
    # B has no note for this book, so should be null
    assert note_b_resp.json() is None
