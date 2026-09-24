#!/bin/sh
set -e

echo "=== [Wrench Backend] Initiating Startup Sequence ==="

# Wait for PostgreSQL database
python - << 'EOF'
import asyncio
import os
import sys
import asyncpg
from app.core.config import settings

async def wait_db():
    raw_url = settings.DATABASE_URL
    url = raw_url.replace("postgresql+asyncpg://", "postgresql://")
    for attempt in range(1, 31):
        try:
            conn = await asyncpg.connect(url)
            await conn.close()
            print(f"[OK] Database connection verified on attempt {attempt}.")
            return True
        except Exception as e:
            print(f"[...] Waiting for database (attempt {attempt}/30): {e}")
            await asyncio.sleep(2)
    return False

if not asyncio.run(wait_db()):
    print("[ERROR] Could not connect to database after 30 attempts. Exiting.", file=sys.stderr)
    sys.exit(1)
EOF

# Run database migrations
echo "=== [Wrench Backend] Applying Alembic Migrations ==="
python -m alembic upgrade head
echo "=== [Wrench Backend] Database is up to date ==="

# Seed initial admin and demo data (if enabled)
if [ "${AUTO_SEED:-true}" = "true" ] || [ -n "$ADMIN_EMAIL" ]; then
    echo "=== [Wrench Backend] Checking Seed Data & Admin Provisioning ==="
    python -m scripts.seed_initial || echo "[WARN] Seed step completed with warning, continuing startup..."
fi

echo "=== [Wrench Backend] Starting Production ASGI Server (Uvicorn) ==="
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 1
