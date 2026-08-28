"""Initial schema — all tables

Revision ID: 001
Revises: 
Create Date: 2026-08-27
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── users ─────────────────────────────────────────────────────────────────
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("hashed_password", sa.String(255), nullable=False),
        sa.Column("full_name", sa.String(255), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("is_superuser", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("preferred_language", sa.String(10), nullable=False, server_default="es"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("email", name="uq_users_email"),
        sa.PrimaryKeyConstraint("id", name="pk_users"),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)

    # ── global_books ──────────────────────────────────────────────────────────
    op.create_table(
        "global_books",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("isbn", sa.String(20), nullable=True),
        sa.Column("isbn13", sa.String(20), nullable=True),
        sa.Column("title", sa.String(500), nullable=False),
        sa.Column("author", sa.String(500), nullable=False),
        sa.Column("publisher", sa.String(255), nullable=True),
        sa.Column("language", sa.String(10), nullable=False, server_default="es"),
        sa.Column("cover_url", sa.Text(), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("published_year", sa.Integer(), nullable=True),
        sa.Column("page_count", sa.Integer(), nullable=True),
        sa.Column("source", sa.String(50), nullable=False, server_default="manual"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("isbn", name="uq_global_books_isbn"),
        sa.UniqueConstraint("isbn13", name="uq_global_books_isbn13"),
        sa.PrimaryKeyConstraint("id", name="pk_global_books"),
    )
    op.create_index("ix_global_books_isbn", "global_books", ["isbn"])
    op.create_index("ix_global_books_isbn13", "global_books", ["isbn13"])
    op.create_index("ix_global_books_title", "global_books", ["title"])
    op.create_index("ix_global_books_author", "global_books", ["author"])

    # ── locations ─────────────────────────────────────────────────────────────
    op.create_table(
        "locations",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name="fk_locations_user_id_users", ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id", name="pk_locations"),
    )
    op.create_index("ix_locations_user_id", "locations", ["user_id"])

    # ── user_books ────────────────────────────────────────────────────────────
    op.create_table(
        "user_books",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("global_book_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("location_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("status", sa.String(50), nullable=False, server_default="unread"),
        sa.Column("rating", sa.Integer(), nullable=True),
        sa.Column("added_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name="fk_user_books_user_id_users", ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["global_book_id"], ["global_books.id"], name="fk_user_books_global_book_id_global_books", ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["location_id"], ["locations.id"], name="fk_user_books_location_id_locations", ondelete="SET NULL"),
        sa.UniqueConstraint("user_id", "global_book_id", name="uq_user_books_user_book"),
        sa.PrimaryKeyConstraint("id", name="pk_user_books"),
    )
    op.create_index("ix_user_books_user_id", "user_books", ["user_id"])
    op.create_index("ix_user_books_global_book_id", "user_books", ["global_book_id"])
    op.create_index("ix_user_books_status", "user_books", ["status"])

    # ── book_notes ────────────────────────────────────────────────────────────
    op.create_table(
        "book_notes",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("global_book_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("content", sa.Text(), nullable=False, server_default=""),
        sa.Column("is_public", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name="fk_book_notes_user_id_users", ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["global_book_id"], ["global_books.id"], name="fk_book_notes_global_book_id_global_books", ondelete="CASCADE"),
        sa.UniqueConstraint("user_id", "global_book_id", name="uq_book_notes_user_book"),
        sa.PrimaryKeyConstraint("id", name="pk_book_notes"),
    )
    op.create_index("ix_book_notes_user_id", "book_notes", ["user_id"])
    op.create_index("ix_book_notes_global_book_id", "book_notes", ["global_book_id"])

    # ── attachments ───────────────────────────────────────────────────────────
    op.create_table(
        "attachments",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_book_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("file_key", sa.String(1000), nullable=False),
        sa.Column("file_type", sa.String(50), nullable=False),
        sa.Column("original_filename", sa.String(255), nullable=False),
        sa.Column("uploaded_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["user_book_id"], ["user_books.id"], name="fk_attachments_user_book_id_user_books", ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id", name="pk_attachments"),
    )
    op.create_index("ix_attachments_user_book_id", "attachments", ["user_book_id"])

    # ── book_tags ─────────────────────────────────────────────────────────────
    op.create_table(
        "book_tags",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_book_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("tag", sa.String(100), nullable=False),
        sa.ForeignKeyConstraint(["user_book_id"], ["user_books.id"], name="fk_book_tags_user_book_id_user_books", ondelete="CASCADE"),
        sa.UniqueConstraint("user_book_id", "tag", name="uq_book_tags_user_book_tag"),
        sa.PrimaryKeyConstraint("id", name="pk_book_tags"),
    )
    op.create_index("ix_book_tags_user_book_id", "book_tags", ["user_book_id"])
    op.create_index("ix_book_tags_tag", "book_tags", ["tag"])


def downgrade() -> None:
    op.drop_table("book_tags")
    op.drop_table("attachments")
    op.drop_table("book_notes")
    op.drop_table("user_books")
    op.drop_table("locations")
    op.drop_table("global_books")
    op.drop_table("users")
