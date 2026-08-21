"""Regression test for the Alembic migration chain.

`alembic upgrade head` failed on a clean database: migration 0003 created the
`vehicletype`/`fueltype` enums explicitly and then passed the same ENUM objects
to `create_table`, which re-emitted CREATE TYPE (postgresql.ENUM defaults to
create_type=True) -> DuplicateObjectError. Migration 0001 already used the
correct `create_type=False` pattern on its column; 0003 now matches it.

This exercises the real deployment path, so it runs the actual alembic CLI
against a scratch database rather than asserting on migration source.
"""

import os
import subprocess
import uuid
from pathlib import Path

import asyncpg
import pytest
import pytest_asyncio
from sqlalchemy.engine import make_url

from app.core.config import settings

BACKEND_DIR = Path(__file__).resolve().parents[1]
EXPECTED_TABLES = {
    "users", "refresh_tokens", "customer_profiles", "mechanic_profiles", "vehicles",
}


def _dsn(database: str) -> str:
    """Build a plain asyncpg DSN for `database` from the configured test URL."""
    url = make_url(settings.DATABASE_URL).set(
        drivername="postgresql", database=database
    )
    return url.render_as_string(hide_password=False)


@pytest_asyncio.fixture
async def scratch_db():
    """A throwaway database, dropped afterwards regardless of outcome."""
    name = f"wrench_mig_{uuid.uuid4().hex[:12]}"
    admin = await asyncpg.connect(_dsn("postgres"))
    try:
        await admin.execute(f'CREATE DATABASE "{name}"')
    finally:
        await admin.close()
    try:
        yield name
    finally:
        admin = await asyncpg.connect(_dsn("postgres"))
        try:
            await admin.execute(f'DROP DATABASE IF EXISTS "{name}" WITH (FORCE)')
        finally:
            await admin.close()


def _alembic(command: str, database: str) -> subprocess.CompletedProcess:
    env = {
        **os.environ,
        "DATABASE_URL": make_url(settings.DATABASE_URL)
        .set(database=database)
        .render_as_string(hide_password=False),
    }
    return subprocess.run(
        [os.sys.executable, "-m", "alembic", command.split()[0], command.split()[1]],
        cwd=BACKEND_DIR, env=env, capture_output=True, text=True,
    )


@pytest.mark.asyncio
async def test_migrations_apply_to_a_clean_database(scratch_db):
    result = _alembic("upgrade head", scratch_db)
    assert result.returncode == 0, result.stderr

    conn = await asyncpg.connect(_dsn(scratch_db))
    try:
        rows = await conn.fetch(
            "SELECT tablename FROM pg_tables WHERE schemaname = 'public'"
        )
    finally:
        await conn.close()
    assert EXPECTED_TABLES <= {r["tablename"] for r in rows}


@pytest.mark.asyncio
async def test_migrations_downgrade_cleanly(scratch_db):
    assert _alembic("upgrade head", scratch_db).returncode == 0
    result = _alembic("downgrade base", scratch_db)
    assert result.returncode == 0, result.stderr
