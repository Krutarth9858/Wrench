# Running Wrench on a new machine

Everything below is the **locally verified path**: Homebrew PostgreSQL + a Python 3.11
virtualenv + Vite. A Docker path exists and is documented at the end, but it has **not**
been run end to end — see [Docker](#docker-alternative-unverified).

Two terminals plus a database. Total setup ≈ 10 minutes.

---

## 1. Prerequisites

| Tool | Version | Why this version |
|---|---|---|
| **Python** | **3.11** (required) | `requirements.txt` pins `pydantic==2.7.4` and `asyncpg==0.29.0`, which need source builds that **fail on 3.13+** (PyO3 caps at 3.12). Matches `backend/Dockerfile` (`python:3.11-slim`). |
| **PostgreSQL** | 15+ (18 verified) | Models use PostgreSQL-only types (`UUID`, `ARRAY`, enum arrays). SQLite cannot host this schema. |
| **Node.js** | 18+ (26 verified) | Vite 5. |
| Git | any | |

**PostGIS is not required.** Mechanic discovery uses a Haversine formula in plain SQL.

### macOS

```bash
brew install python@3.11 postgresql@18 node
brew services start postgresql@18
```

### Ubuntu / Debian

```bash
sudo apt update
sudo apt install -y python3.11 python3.11-venv postgresql nodejs npm
sudo systemctl start postgresql
```

Verify:

```bash
python3.11 --version && psql --version && node --version
```

---

## 2. Databases

Two databases: one for development, one that the test suite truncates between tests.

```bash
createdb wrench
createdb wrench_test
```

If your PostgreSQL has no role matching your OS user, create the `postgres` role first
(`createuser -s postgres`) and use `createdb -U postgres wrench`.

Confirm you can connect:

```bash
psql -d wrench -c "select version();"
```

---

## 3. Backend

```bash
cd backend
python3.11 -m venv venv
./venv/bin/pip install --upgrade pip
./venv/bin/pip install -r requirements-dev.txt
```

`requirements-dev.txt` includes `requirements.txt` plus pytest/httpx. For a
production-only install use `requirements.txt`.

> On macOS the interpreter may not be on PATH as `python3.11`. Use the full path:
> `/opt/homebrew/opt/python@3.11/bin/python3.11 -m venv venv`

### Configure

```bash
cp .env.example .env
```

Then edit `backend/.env`:

```bash
DATABASE_URL="postgresql+asyncpg://postgres@localhost:5432/wrench"
TEST_DATABASE_URL="postgresql+asyncpg://postgres@localhost:5432/wrench_test"
SECRET_KEY="<paste the generated value>"
BACKEND_CORS_ORIGINS="http://localhost:5173"
```

Generate the secret:

```bash
./venv/bin/python -c "import secrets; print(secrets.token_hex(32))"
```

**`SECRET_KEY` has no default and the app will refuse to start without it.** That is
deliberate — a missing value must fail loudly rather than silently sign tokens with a
value that is public in version control. `.env` is gitignored; never commit it.

Adjust `DATABASE_URL` to match your role/password, e.g.
`postgresql+asyncpg://postgres:yourpassword@localhost:5432/wrench`.

### Migrations

Not automatic. Run them yourself, from `backend/`:

```bash
./venv/bin/python -m alembic upgrade head
```

Applies migrations `0001` → `0006`. Verify:

```bash
psql -d wrench -c "\dt"
```

Expect `users`, `refresh_tokens`, `customer_profiles`, `mechanic_profiles`, `vehicles`,
`bookings`, `alembic_version`.

### Start

```bash
./venv/bin/python -m uvicorn app.main:app --reload
```

- API: <http://localhost:8000>
- Interactive docs: <http://localhost:8000/docs>
- Health: <http://localhost:8000/api/v1/health> → `{"status":"ok"}`

**Every route is under `/api/v1`.**

---

## 4. Frontend

New terminal:

```bash
cd frontend
npm install
cp .env.example .env      # optional; the default already points at localhost:8000
npm run dev
```

Open <http://localhost:5173>. A badge in the bottom-left reads **"Backend connected"** in
dev builds — that is the end-to-end smoke test. If it says "Backend unreachable", the
backend is not running or `VITE_API_BASE_URL` is wrong.

---

## 5. Try it

Register two accounts through the UI at <http://localhost:5173/register> — the form has a
role toggle.

**As a mechanic** (choose *Mechanic* when registering)
1. My Profile → fill in garage details, coverage and **service radius**
2. Pick supported vehicle types (two-wheeler / four-wheeler)
3. Save, then switch **availability on** — you will not appear in searches while offline
4. Latitude/longitude are typed manually; use a point near where you will search from

**As a customer** (choose *Vehicle owner*)
1. Find Mechanics → pick a vehicle type → allow location → search
2. Select a mechanic → describe the problem → confirm
3. My Bookings shows the live status

You do **not** need to register a vehicle to book. Vehicle type is chosen during booking.

**Back as the mechanic:** Bookings → Accept → Start service → Mark complete. The
customer's page updates live over WebSocket; a "Live" indicator sits by the Refresh button.

### Creating an admin

Admins cannot be created through the API — `role: "ADMIN"` is rejected with 422 by design.
Provision one out of band, from `backend/`:

```bash
ADMIN_PASSWORD='choose-a-strong-password' ./venv/bin/python -m scripts.create_admin --email admin@example.com --phone +11234567890
```

Omit `ADMIN_PASSWORD` to be prompted instead. The password is never read from argv, so it
cannot leak into shell history. There is no admin UI; the only admin route is
`GET /api/v1/admin/users`.

---

## 6. Tests

```bash
# Backend — needs PostgreSQL running and wrench_test to exist
cd backend && ./venv/bin/python -m pytest

# Frontend
cd frontend && npx vitest run

# Frontend typecheck + production build
cd frontend && npm run build
```

Expected: **147 backend**, **74 frontend**, 0 failures.

The backend suite truncates every table in `wrench_test` between tests — point
`TEST_DATABASE_URL` at a throwaway database, never at `wrench`.

---

## 7. Troubleshooting

| Symptom | Cause and fix |
|---|---|
| `pydantic-core` / `asyncpg` fail to build during `pip install` | Python is newer than 3.12. Rebuild the venv with 3.11. |
| `ValidationError: SECRET_KEY Field required` on startup | `backend/.env` is missing or has no `SECRET_KEY`. Not a bug — see step 3. |
| `connection refused` on port 5432 | PostgreSQL is not running: `brew services start postgresql@18` / `sudo systemctl start postgresql`. |
| `role "postgres" does not exist` | `createuser -s postgres`, or point `DATABASE_URL` at your own role. |
| Frontend shows "Backend unreachable" | Backend down, or `VITE_API_BASE_URL` missing the `/api/v1` suffix. |
| Browser console shows a CORS error | Add the frontend origin to `BACKEND_CORS_ORIGINS` and restart the backend. |
| `404` on `/auth/login` | Missing the version prefix. Every route is `/api/v1/...`. |
| Tests fail with `relation "users" does not exist` | `wrench_test` was never created, or `TEST_DATABASE_URL` points somewhere unmigrated. The suite creates its own schema, so check the database exists. |
| No mechanics found in search | The mechanic is offline, does not service that vehicle type, or your search point is outside their `service_radius_km`. |
| "Live" indicator stuck on Offline | Backend restarted. It reconnects with backoff (up to ~15 s) and refetches over REST. |

---

## Docker alternative (unverified)

`docker-compose.yml` defines PostgreSQL 15 and the backend. **This path was not executed
during development** — treat the commands as a starting point, not a tested recipe.

```bash
export SECRET_KEY="$(python3 -c 'import secrets; print(secrets.token_hex(32))')"
docker-compose up --build -d
docker-compose exec backend python -m alembic upgrade head   # migrations are NOT automatic
```

Notes and caveats:
- Compose **fails fast** if `SECRET_KEY` is unset — that is intended.
- Nothing runs migrations for you; the container starts against an empty schema until you
  run the command above.
- The Dockerfile's `CMD` uses `uvicorn --reload`, which is a development server. Do not
  ship it as-is.
- The frontend is **not** in compose; run it locally per step 4.

---

## Notes for deployment

Not production-ready as it stands. Before any real deployment:

- **No HTTPS/WSS.** Everything is plain HTTP; terminate TLS at a reverse proxy.
- **Refresh tokens live in `localStorage`** and are readable by XSS. Access tokens are held
  in memory only. Moving refresh tokens to httpOnly cookies needs backend cookie issuance
  plus CSRF protection.
- **Realtime is single-process.** The WebSocket connection manager is in-memory, so with
  more than one worker a client on worker A misses events emitted on worker B. Horizontal
  scaling needs a Redis (or similar) pub/sub backplane first.
- No rate limiting on login or registration; no password reset; no email/phone verification.
- Mechanic discovery has no spatial index — Haversine is evaluated per row. Fine at current
  scale, unmeasured at volume.
- No CI pipeline exists.

Architecture, subsystem ownership and per-phase status live in [`brain.md`](brain.md).
