"""Idempotent cashback column DDL for PostgreSQL and SQLite (no IF NOT EXISTS on SQLite < 3.35)."""

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from django.db.backends.base.schema import BaseDatabaseSchemaEditor


def _existing_sqlite_columns(schema_editor: BaseDatabaseSchemaEditor) -> set[str]:
    with schema_editor.connection.cursor() as cursor:
        cursor.execute("PRAGMA table_info(products)")
        return {row[1] for row in cursor.fetchall()}


def ensure_cashback_columns(schema_editor: BaseDatabaseSchemaEditor) -> None:
    connection = schema_editor.connection
    vendor = connection.vendor
    if vendor == "postgresql":
        with connection.cursor() as cursor:
            cursor.execute(
                "ALTER TABLE products ADD COLUMN IF NOT EXISTS "
                "cashback_enabled boolean NOT NULL DEFAULT true"
            )
            cursor.execute(
                "ALTER TABLE products ADD COLUMN IF NOT EXISTS "
                "cashback_rate_percent numeric(5,2) NULL"
            )
    elif vendor == "sqlite":
        cols = _existing_sqlite_columns(schema_editor)
        with connection.cursor() as cursor:
            if "cashback_enabled" not in cols:
                cursor.execute(
                    "ALTER TABLE products ADD COLUMN cashback_enabled integer NOT NULL DEFAULT 1"
                )
            if "cashback_rate_percent" not in cols:
                cursor.execute(
                    "ALTER TABLE products ADD COLUMN cashback_rate_percent decimal(5,2) NULL"
                )
    else:
        raise NotImplementedError(
            "products cashback migrations support postgresql and sqlite only; "
            f"got {vendor!r}"
        )


def drop_cashback_columns_if_exist(schema_editor: BaseDatabaseSchemaEditor) -> None:
    connection = schema_editor.connection
    vendor = connection.vendor
    if vendor == "postgresql":
        with connection.cursor() as cursor:
            cursor.execute(
                "ALTER TABLE products DROP COLUMN IF EXISTS cashback_rate_percent"
            )
            cursor.execute("ALTER TABLE products DROP COLUMN IF EXISTS cashback_enabled")
    elif vendor == "sqlite":
        cols = _existing_sqlite_columns(schema_editor)
        with connection.cursor() as cursor:
            if "cashback_rate_percent" in cols:
                try:
                    cursor.execute(
                        "ALTER TABLE products DROP COLUMN cashback_rate_percent"
                    )
                except Exception:
                    pass
            if "cashback_enabled" in cols:
                try:
                    cursor.execute("ALTER TABLE products DROP COLUMN cashback_enabled")
                except Exception:
                    pass
    else:
        raise NotImplementedError(
            "products cashback migrations support postgresql and sqlite only; "
            f"got {vendor!r}"
        )
