# Wrench — Project Brain

Persistent architectural context for AI sessions. Derived by direct inspection of the
repository (not from the README's aspirations). Source code is authoritative; this file
is a map.

Repo root: `/Users/krutarthparikh/Documents/GitHub/Wrench`
Branch inspected: `main` (3 commits: `0344924c` initial, `26d5b617`, `37b98f0d` landing redesign)

---

## 1. What Wrench Actually Is

README describes it as an "AI-powered roadside assistance platform."

**What exists today** is a small, conventional account-management backend plus a
marketing/landing frontend:

- Backend: user registration/login with JWT + refresh-token rotation, customer profiles,
  mechanic profiles, and customer vehicle CRUD.
- Frontend: an animation-heavy landing page and a dashboard shell. **All frontend data is
  hardcoded/mocked — the frontend makes zero HTTP calls to the backend.**

**NOT IMPLEMENTED anywhere in the repository** (do not assume these exist):
booking/job requests, mechanic dispatch or assignment, ratings/reviews writes, geospatial
search or distance matching, maps provider, AI/LLM integration (no Gemini, no OpenAI),
payments (no Razorpay, no Stripe), notifications (no email/SMS/push), WebSockets/realtime,
background jobs (no Celery/Redis), admin endpoints, file/image upload.

The mechanic model carries `average_rating`, `total_reviews`, `completed_jobs`,
`is_verified` — these are **write-never defaults**; nothing in the codebase updates them.

---

## 2. Technology Stack (actual, from manifests)

### Backend — `backend/requirements.txt`
| Package | Version | Role |
|---|---|---|
| fastapi | 0.111.0 | HTTP framework |
| uvicorn[standard] | 0.30.1 | ASGI server |
| sqlalchemy[asyncio] | 2.0.30 | ORM, async engine |
| asyncpg | 0.29.0 | Postgres async driver |
| alembic | 1.13.1 | Migrations |
| pydantic | 2.7.4 | Schemas/validation |
| pydantic-settings | 2.3.4 | Env config |
| PyJWT | 2.8.0 | JWT encode/decode |
| passlib[argon2] | 1.7.4 | Password hashing |
| email-validator | 2.1.1 | `EmailStr` support |

Python 3.11 (Dockerfile). **No test dependencies are declared** — `pytest`,
`pytest-asyncio`, `aiosqlite`, `httpx` are all absent despite tests existing. See §12.

### Frontend — `frontend/package.json`
React 18, Vite 5, TypeScript 5, Tailwind 3 (+ `tailwindcss-animate`), react-router-dom 6,
zustand 4 (with `persist`), @tanstack/react-query 5 (provider mounted, **never used for a
query**), framer-motion 10, gsap 3 + ScrollTrigger, @studio-freight/lenis (smooth scroll),
ogl (WebGL), @phosphor-icons/react + lucide-react, sonner, react-error-boundary,
class-variance-authority + clsx + tailwind-merge (shadcn-style `cn`), vitest + jsdom +
@testing-library.

There is also a near-empty root `package.json` (lenis, gsap, lucide-react only) — stray,
not the real frontend manifest.

### Infrastructure
- `docker-compose.yml`: `postgres:15` (`wrench` db) + backend image on `:8000`.
- `backend/Dockerfile`: python:3.11-slim, `uvicorn --reload` (dev CMD, not production).

---

## 3. Project Structure

```
Wrench/
├── backend/
│   ├── app/
│   │   ├── main.py              FastAPI app construction
│   │   ├── api/
│   │   │   ├── main.py          router aggregation
│   │   │   ├── deps.py          auth + role dependencies
│   │   │   └── routes/          health, auth, customer_profile, mechanic_profile, vehicles
│   │   ├── core/                config.py, security.py, logging.py
│   │   ├── db/
│   │   │   ├── session.py       engine, sessionmaker, Base, get_db
│   │   │   └── repositories/    user, token, profile, vehicle  (no __init__.py)
│   │   ├── models/              SQLAlchemy models
│   │   ├── schemas/             Pydantic v2 schemas
│   │   └── services/            auth, profile, vehicle (business logic)
│   ├── alembic/versions/        0001 → 0002 → 0003
│   ├── tests/                   conftest.py, api/test_profiles.py
│   ├── qa_tests_fastapi.py      ad-hoc QA scripts (see §12)
│   ├── qa_test_sprint3.py
│   ├── run_qa.py / run_qa_vehicles.py
│   ├── directives/  execution/  .tmp/     ← ALL EMPTY (see §14)
│   └── Dockerfile, requirements.txt, alembic.ini, .env.example
├── frontend/
│   └── src/
│       ├── main.tsx App.tsx
│       ├── pages/          Landing, Login, Register, Dashboard
│       ├── components/     ui/ layout/ sections/ chapters/ dashboard/ features/
│       ├── lib/            auth.ts (zustand store), utils.ts (cn)
│       ├── providers/      ErrorBoundary.tsx
│       ├── hooks/  store/  ← EMPTY DIRECTORIES
│       └── test/setup.ts
│   ├── docs/               6 design/standards markdown docs
│   └── public/frames/      144 PNGs driving the scroll video scrubber
├── docker-compose.yml, README.md
├── CLAUDE.md / AGENTS.md / GEMINI.md / backend/agents.md / .agents/AGENTS.md
│                           ← identical generic agent SOP, NOT about Wrench (see §14)
├── qa_tests.py             root-level auth QA script
├── docs/                   EMPTY
└── "Recreating UI from Screenshot (1).html"   stray design artifact
```

---

## 4. Architecture Authorities

| Subsystem | Source of truth | Notes |
|---|---|---|
| App construction | `backend/app/main.py` | creates `FastAPI`, calls `setup_logging()`, mounts `api_router` |
| Route aggregation | `backend/app/api/main.py` | the ONE place routers are registered |
| Config / env | `backend/app/core/config.py` | pydantic-settings `Settings`; module-level `settings` singleton |
| Password hashing | `backend/app/core/security.py` | argon2 via passlib `CryptContext` |
| JWT mint/verify | `backend/app/core/security.py` | HS256; `create_access_token`, `create_refresh_token`, `decode_token` |
| Request authentication | `backend/app/api/deps.py` | `get_current_user` — the only place a bearer token becomes a `User` |
| Authorization (RBAC) | `backend/app/api/deps.py` | `_verify_role` + `get_current_customer/mechanic/admin` |
| Auth business logic | `backend/app/services/auth.py` | register, authenticate, token issue/rotate/revoke |
| Refresh-token state | `backend/app/models/token.py` + `db/repositories/token.py` | SHA-256 hash of token stored; `is_revoked` flag |
| DB engine + session | `backend/app/db/session.py` | `engine`, `AsyncSessionLocal`, `Base`, `get_db` — single owner |
| Declarative `Base` | `backend/app/db/session.py` | all models import it from here |
| Model registration | `backend/app/models/__init__.py` | imported by `alembic/env.py` so autogenerate sees metadata |
| Migrations | `backend/alembic/versions/` | linear 0001→0002→0003; `env.py` overrides URL with `settings.DATABASE_URL` |
| DB access | `backend/app/db/repositories/*.py` | repositories own all `select/update/delete`; **each commits its own transaction** |
| Profile rules | `backend/app/services/profile.py` | upsert semantics, 404 on missing |
| Vehicle rules | `backend/app/services/vehicle.py` | ownership check, duplicate-registration check, single-default enforcement |
| Frontend auth state | `frontend/src/lib/auth.ts` | zustand + `persist` to localStorage key `auth-storage`; **`fetchUser` returns a hardcoded mock user** |
| Frontend routing | `frontend/src/App.tsx` | 4 routes; `/dashboard/*` nests its own `Routes` in `pages/Dashboard.tsx` |
| Styling | `frontend/tailwind.config.js` + `frontend/src/index.css` | HSL CSS-variable theme (shadcn convention), `darkMode: ["class"]` |

**No duplicate/conflicting authorities were found** in the backend — the layering is clean
and consistent. The one structural deviation is that repositories, not services, own
transaction boundaries (see §13).

---

## 5. Dependency / Layer Map

```
React pages/components
  ↓ (BROKEN LINK — no API client exists; components hold mock state)
  ✗
FastAPI routers        app/api/routes/*.py
  ↓ per-request factory functions (get_auth_service, get_vehicle_service, ...)
Services               app/services/*.py          ← HTTPException raised here
  ↓
Repositories           app/db/repositories/*.py   ← commits here
  ↓
SQLAlchemy async ORM   app/db/session.py
  ↓ asyncpg
PostgreSQL 15
```

Cross-cutting: `app/api/deps.py` (auth) injects into routers; `app/core/config.py`
(settings) is imported by security, session, alembic env.

### External integrations
```
Wrench
 └── PostgreSQL 15        (the ONLY external service)
```
Nothing else. No third-party API client, SDK, or key exists in the repository.
`.env.example` declares only `PROJECT_NAME`, `VERSION`, `API_V1_STR`, `DATABASE_URL`,
`SECRET_KEY`.

---

## 6. Important Files

| Area | File | Responsibility |
|---|---|---|
| Backend entrypoint | `backend/app/main.py` | FastAPI instance + router mount |
| Router registry | `backend/app/api/main.py` | where new routers get added |
| Auth dependencies | `backend/app/api/deps.py` | `get_current_user`, role guards |
| Auth endpoints | `backend/app/api/routes/auth.py` | register/login/refresh/logout/me/swagger-login |
| Auth logic | `backend/app/services/auth.py` | credential + token lifecycle |
| Crypto | `backend/app/core/security.py` | argon2 hashing, JWT |
| Config | `backend/app/core/config.py` | `Settings`, `settings` |
| Logging | `backend/app/core/logging.py` | stdout basicConfig |
| DB session | `backend/app/db/session.py` | engine/Base/`get_db` |
| Models | `backend/app/models/{user,token,profile,vehicle}.py` | tables + enums |
| Repositories | `backend/app/db/repositories/` | queries + commits |
| Customer profile | routes `customer_profile.py`, service `profile.py::CustomerProfileService`, repo `profile.py::CustomerProfileRepository` | |
| Mechanic profile | routes `mechanic_profile.py`, service `profile.py::MechanicProfileService`, repo `profile.py::MechanicProfileRepository` | |
| Vehicles | routes `vehicles.py`, `services/vehicle.py`, `db/repositories/vehicle.py` | |
| Envelope schema | `backend/app/schemas/response.py` | generic `ResponseModel[T]` used by nearly every endpoint |
| Migrations | `backend/alembic/env.py`, `backend/alembic/versions/000*.py` | async migration runner |
| Backend tests | `backend/tests/conftest.py`, `backend/tests/api/test_profiles.py` | currently broken (§12) |
| Frontend entrypoint | `frontend/src/main.tsx` | Router + QueryClient + ErrorBoundary providers |
| Frontend routes | `frontend/src/App.tsx` | `/`, `/login`, `/register`, `/dashboard/*` |
| Frontend auth store | `frontend/src/lib/auth.ts` | mocked zustand store |
| Dashboard shell | `frontend/src/pages/Dashboard.tsx` | sidebar + nested routes |
| Dashboard features | `frontend/src/components/dashboard/{ProfileSettings,VehicleManager,VehicleModal}.tsx` | all mock data |
| Landing | `frontend/src/pages/Landing.tsx` | Lenis + GSAP ScrollTrigger scroll story |
| Scroll frames | `frontend/src/components/VideoScrubber.tsx` + `public/frames/*.png` | 144-frame scrub |
| Design docs | `frontend/docs/*.md` | design system, animation, a11y, perf, coding standards |

---

## 7. Database Architecture

**Engine/session:** `app/db/session.py` builds a single module-level `create_async_engine`
from `settings.DATABASE_URL`, an `async_sessionmaker` named `AsyncSessionLocal`
(`expire_on_commit=False`), a `declarative_base()` `Base`, and the FastAPI dependency
`get_db()`. There is **no** `async_session` symbol here despite four files importing it (§12).

**Tables (4)**

- `users` — UUID pk, unique+indexed `email` and `phone_number`, `hashed_password`,
  `role` (generic `sqlalchemy.Enum(UserRole)` — portable, NOT the Postgres-only dialect type), `is_active`, timestamps.
- `refresh_tokens` — UUID pk, `user_id` FK → `users.id` `ON DELETE CASCADE`,
  unique indexed `hashed_token` (SHA-256 of the JWT), `expires_at`, `is_revoked`.
- `customer_profiles` — UUID pk, **unique** `user_id` FK CASCADE (1:1 with user), identity
  fields, emergency contact (required), address block, `latitude`/`longitude`
  `Numeric(9,6)` required, `profile_image` nullable.
- `mechanic_profiles` — UUID pk, **unique** `user_id` FK CASCADE (1:1), garage identity,
  `experience_years`, `specialization`, `supported_vehicle_types` `ARRAY(String)`
  (Postgres-only type), address block, lat/lng `Numeric(9,6)`, `service_radius_km`,
  `working_start_time`/`working_end_time` as `String` "HH:MM", plus the unused reputation
  counters (`is_available`, `is_verified`, `average_rating`, `total_reviews`,
  `completed_jobs`).
- `vehicles` — UUID pk, `user_id` FK CASCADE (1:N, **not unique**), `vehicle_type` enum,
  `brand`, `model`, `fuel_type` enum, nullable `registration_number` (≤20) and `nickname`
  (≤50), `is_default` bool.

**Enums**
- `UserRole` = CUSTOMER | MECHANIC | ADMIN (`app/models/user.py`)
- `VehicleType` = BIKE | CAR (`app/models/vehicle.py`)
- `FuelType` = PETROL | DIESEL | CNG | ELECTRIC | HYBRID

**Relationships:** declared only as FK columns. `relationship()` is imported in
`models/profile.py` but **never used** — there are no ORM relationship attributes anywhere,
so all joins/lookups are manual `select()` calls in repositories.

**Migrations:** `0001` users+refresh_tokens → `0002` customer+mechanic profiles →
`0003` vehicles. `alembic/env.py` imports `app.models` for autogenerate metadata and
overrides `sqlalchemy.url` with `settings.DATABASE_URL` at runtime (the hardcoded
`localhost` URL in `alembic.ini` is therefore inert online, but is what offline mode/config
parsing sees).

---

## 8. API Architecture

`app/api/main.py` registers 5 routers on a bare `APIRouter()`:

| Prefix | Module | Auth dependency |
|---|---|---|
| *(none)* | `routes/health.py` | none — `GET /`, `GET /health` |
| `/auth` | `routes/auth.py` | mixed; `/logout`, `/me` require `get_current_user` |
| `/profile/customer` | `routes/customer_profile.py` | `get_current_customer` (403 unless role CUSTOMER) |
| `/profile/mechanic` | `routes/mechanic_profile.py` | `get_current_mechanic` |
| `/vehicles` | `routes/vehicles.py` | `get_current_user` (any authenticated role) |

**⚠ CRITICAL — the `/api/v1` prefix is never applied.** `app/main.py` calls
`app.include_router(api_router)` with no `prefix=settings.API_V1_STR`. Real served paths
are `/auth/login`, `/vehicles/`, `/profile/customer/`. Meanwhile `deps.py` sets
`tokenUrl="/api/v1/auth/swagger-login"`, `openapi_url` is `/api/v1/openapi.json`, and every
test and QA script targets `/api/v1/...`. This single line is why the whole test/QA suite
would 404. See §13.

**Endpoint groups (shape, not a catalog)**
- Auth: `POST /auth/register`, `POST /auth/login`, `POST /auth/refresh`,
  `POST /auth/logout`, `GET /auth/me`, `POST /auth/swagger-login` (hidden, OAuth2 form for
  the Swagger "Authorize" button).
- Profiles (both roles): `GET /` (own profile, 404 if absent), `PUT /` (upsert),
  `PATCH /location`. Customer also has `PATCH /image`.
- Vehicles: `POST /`, `GET /`, `GET /{id}`, `PUT /{id}`, `DELETE /{id}` (204),
  `PATCH /{id}/default`.

**Response convention:** everything except health and 204-delete returns
`ResponseModel[T]` = `{status, message, data}` (`app/schemas/response.py`).
`ErrorResponseModel` is defined but never used — errors come out as FastAPI's default
`{"detail": ...}`, so the API has **two inconsistent error shapes** by omission.

**Dependency-injection pattern:** each router module defines a local
`get_<x>_service(db=Depends(get_db))` factory that constructs repository + service
per request. Follow this pattern when adding routers.

**Key schemas:** `schemas/user.py` (E.164-ish phone regex), `schemas/token.py`,
`schemas/profile.py` (lat/lng bounds, HH:MM regex, `supported_vehicle_types` whitelist),
`schemas/vehicle.py`, `schemas/response.py`.

---

## 9. Frontend Architecture

**Routing:** `react-router-dom` v6. `main.tsx` wraps `<AppErrorBoundary><QueryClientProvider>
<BrowserRouter><App/>`. `App.tsx` declares `/`, `/login`, `/register`, `/dashboard/*`;
`Dashboard.tsx` nests `/` → `ProfileSettings` and `/vehicles` → `VehicleManager`.

**There are no protected routes.** `/dashboard` renders for anonymous visitors.

**State:** zustand only (`lib/auth.ts`, persisted to localStorage). The `src/store/` and
`src/hooks/` directories exist but are empty.

**Data fetching: NONE.** A repo-wide grep for `fetch(`, `axios`, `VITE_`, `/api/` across
`frontend/src` returns zero matches. TanStack Query is installed and its provider mounted,
but no `useQuery`/`useMutation` is ever called. Concretely:
- `Login.tsx` / `Register.tsx` — `// MOCK LOGIN`: `setTimeout(800)`, then
  `setToken('mock-jwt-token')` and navigate to `/`.
- `lib/auth.ts::fetchUser` — `// Mocking the backend user fetch`, sets a hardcoded
  `admin@wrench.ai` user with `role: 'admin'` (lowercase — backend uses uppercase `ADMIN`).
- `ProfileSettings.tsx` — `// MOCK SAVE API`, fields seeded with literals ("John Doe").
- `VehicleManager.tsx` — two hardcoded vehicles in `useState`.

**Frontend/backend model drift:** `VehicleManager`'s `Vehicle` interface is
`{make, model, year, color, license_plate}`; the backend's is
`{vehicle_type, brand, model, fuel_type, registration_number, nickname}`. Zero overlap
beyond `model` and `is_default`. `ProfileSettings` collects `hourlyRate` and `specialties`,
neither of which exists on `MechanicProfile`.

**Presentation:** heavy GSAP + ScrollTrigger + Lenis smooth scroll on the landing page;
`VideoScrubber.tsx` scrubs 144 PNGs in `public/frames/`. `components/chapters/Chapter1-8`
and `components/sections/*` are landing-page story blocks. `components/ui/` holds the
design-system primitives (`SpecularButton` with its own CSS, `AIGradientBorder`,
`GlassMetricCard`, `PillButton`, `FloatingNavbar`, `Button`). `lib/utils.ts` provides the
standard shadcn `cn()`. Conventions are documented in `frontend/docs/`.

**Realtime:** NOT IMPLEMENTED (no WebSocket, SSE, or polling anywhere).

---

## 10. Authentication & Authorization Flows

**Registration**
```
POST /auth/register (UserCreate: email, phone_number, password≥8)
  → routes/auth.py → AuthService.register
  → UserRepository.get_by_email / get_by_phone_number  (400 on either duplicate)
  → argon2 hash (core/security)
  → UserRepository.create → commit
  → ResponseModel[UserResponse], 201
```
**⚠ `role` is never accepted or set at registration** — every user is created with the
column default `CUSTOMER`. There is no code path anywhere that produces a MECHANIC or ADMIN
user; the mechanic profile endpoints are consequently unreachable through the public API,
and `get_current_admin` is defined but referenced by no route.

**Login**
```
POST /auth/login → AuthService.authenticate  (401 bad creds, 403 inactive)
  → create_tokens: access JWT (15 min, {sub, exp, type:"access"})
                 + refresh JWT (7 days, type:"refresh")
  → SHA-256(refresh) persisted to refresh_tokens with expires_at
  → {access_token, refresh_token, token_type:"bearer"}
```

**Authenticated request**
```
Bearer token → OAuth2PasswordBearer → deps.get_current_user
  → decode_token (HS256, signature+exp enforced by PyJWT)
  → assert payload.type == "access"
  → UserRepository.get_by_id(sub)   (404 missing, 403 inactive)
  → [role guard: _verify_role → 403]
  → route handler
```

**Refresh (rotating)**
```
POST /auth/refresh → decode+assert type=="refresh" → SHA-256 lookup
  → reject if missing / revoked / expired
  → revoke the presented token → issue a NEW access+refresh pair
```
Rotation is real, but there is **no reuse-detection** (replaying a revoked token is simply
rejected; it does not invalidate the family).

**Logout** — revokes the presented refresh token row. Access tokens remain valid until
their 15-minute expiry (no denylist).

---

## 11. Security Posture

**Implemented**
- argon2 password hashing (`CryptContext`), never plaintext.
- HS256 JWTs with `exp`; separate `type` claim prevents refresh↔access confusion.
- Refresh tokens stored only as SHA-256 digests; revocable; rotated on use.
- Role-based route guards via FastAPI dependencies.
- Pydantic validation at every boundary: email format, phone regex, password `min_length=8`,
  lat/lng bounds, HH:MM time regex, `supported_vehicle_types` whitelist, string length caps.
- Object-level ownership checks on vehicles (`VehicleService.get_vehicle` compares
  `vehicle.user_id` to the caller — no IDOR on the vehicle routes).
- Profile routes are inherently scoped to `current_user.id` (no id in the path).

**Missing / weak — present as findings, NOT to fix in this task**
- **No CORS middleware.** `app/main.py` adds no `CORSMiddleware`, so a browser frontend on
  `:5173` could not call `:8000` at all. (Latent today only because the frontend never calls.)
- **Default `SECRET_KEY` committed** in both `app/core/config.py` and `.env.example`, and
  the config default means a missing env var silently yields a known signing key.
- **DB password committed** in `docker-compose.yml` / `.env.example`.
- No rate limiting or lockout on `/auth/login` or `/auth/register`.
- No password complexity rule beyond length; no email/phone verification.
- No refresh-token reuse detection; no cleanup job calls the existing
  `TokenRepository.delete_expired`.
- No security headers, no HTTPS enforcement, no request-id/audit logging.
- `PATCH /profile/customer/image` accepts an arbitrary `HttpUrl` with no host allowlist.
- Uvicorn runs with `--reload` in the Dockerfile; no production server config.
- WebSocket auth: N/A (no WebSockets).
- Payment verification: N/A (no payments).

---

## 12. Testing Architecture

**Backend** — `pytest` style, `backend/tests/` (`conftest.py`, `api/test_profiles.py`,
6 tests over profile create/RBAC/location). Fixtures force
`DATABASE_URL=sqlite+aiosqlite:///:memory:`, create all tables via
`Base.metadata.create_all`, and mint tokens directly with `create_access_token`.

**These tests cannot currently run.** Four independent blockers, all verified by reading
the files:
1. `conftest.py:40,60` imports `async_session` from `app.db.session`; the module exports
   `AsyncSessionLocal`. → `ImportError`. Same bug in `run_qa.py:7` and `run_qa_vehicles.py:7`.
2. `pytest`, `pytest-asyncio`, and `aiosqlite` are not in `requirements.txt`, and
   `backend/venv/` is not populated (importing `fastapi` from it fails).
3. Tests request `/api/v1/profile/...` but the app serves `/profile/...` (§8) → 404.
4. SQLite cannot support `postgresql.UUID` (every table's pk) or
   `postgresql.ARRAY` (`mechanic_profiles.supported_vehicle_types`), so `create_all`
   against SQLite fails even once 1–3 are fixed. Note: the `Enum` columns are generic
   `sqlalchemy.Enum` and ARE portable — only `UUID` and `ARRAY` block SQLite.
5. `sqlite+aiosqlite:///:memory:` without `StaticPool` gives every connection its own
   empty database, and the sync `TestClient` drives requests on a different event loop
   than the session-scoped `init_db` fixture — so tables created by `init_db` would not
   be visible to request handlers regardless.
6. No `asyncio_mode`/`pytest-asyncio` configuration exists, so the `async def` fixtures
   (`init_db`, `customer_user`, `mechanic_user`) would be injected as un-awaited
   coroutine objects.

Also note `test_404_profile_not_found` is a self-acknowledged no-op (`pass` with a comment
saying the DB isn't wiped between tests) — the session-scoped DB fixture means tests share
state and are order-dependent.

**Ad-hoc QA scripts** (not pytest, stdlib `urllib` only): root `qa_tests.py` (auth against a
live `localhost:8000`), `backend/qa_tests_fastapi.py` (TestClient, auth), `qa_test_sprint3.py`
(live server, vehicles), `run_qa.py` / `run_qa_vehicles.py` (seed users directly then hit the
API). These are sprint artifacts, not a maintained suite, and share blockers 1 and 3.

**Frontend** — vitest + jsdom configured (`vitest.config.ts`, `src/test/setup.ts` importing
`@testing-library/jest-dom`), include glob `src/**/*.{test,spec}.{ts,tsx}`. **Zero test
files exist.** ESLint + Prettier + husky/lint-staged are configured.

There is no CI configuration anywhere in the repo.

---

## 13. Known Issues / Technical Debt

| # | Issue | Module | Severity | Why it matters |
|---|---|---|---|---|
| 1 | `/api/v1` prefix never applied — `include_router(api_router)` lacks `prefix=settings.API_V1_STR` | `app/main.py:14` | **Critical** | Every documented path, every test, every QA script, and `tokenUrl` are wrong by one prefix. Fixing this is a 1-line change that unblocks the whole test suite. |
| 2 | `async_session` imported but does not exist (it's `AsyncSessionLocal`) | `tests/conftest.py`, `run_qa.py`, `run_qa_vehicles.py` | **Critical** | ImportError; tests and QA cannot start. |
| 3 | No CORS middleware | `app/main.py` | **High** | Any real browser client is blocked. |
| 4 | Frontend is 100% mocked — no API client, no `VITE_API_URL`, no auth wiring | `frontend/src/**` | **High** | The product does not function end-to-end; the backend has never been exercised by the UI. |
| 5 | Registration cannot create MECHANIC/ADMIN users | `services/auth.py::register` | **High** | Mechanic profile endpoints and `get_current_admin` are unreachable in production. |
| 6 | Committed default `SECRET_KEY` and DB password | `core/config.py`, `.env.example`, `docker-compose.yml` | **High** | Forgeable tokens if the env var is ever missing. |
| 7 | Test deps (`pytest`, `pytest-asyncio`, `aiosqlite`) undeclared | `requirements.txt` | High | Suite is not reproducibly runnable. |
| 8 | SQLite test target vs Postgres-only column types (`ARRAY`, `UUID`) | `tests/conftest.py` + `models/` | High | The chosen test DB cannot host the schema. |
| 9 | Repositories own `commit()`; services orchestrate multiple repo calls | all of `db/repositories/` | Medium | No transactional boundary. `set_default_vehicle` does `unset_default_for_user()` **commit**, then `set_default()` commit — a crash between them leaves the user with zero default vehicles. Same class of risk in `refresh_tokens` (revoke commits, then issue commits). |
| 10 | `UserResponse.id: str` / `VehicleResponse.id: str` validated from UUID model attributes | `schemas/user.py`, `schemas/vehicle.py` | Medium — **UNVERIFIED** | Pydantic v2 does not coerce `UUID`→`str` in lax mode; these responses may raise at serialization. Could not execute (no installed deps). Verify before trusting `/auth/me`. |
| 11 | `MechanicProfileUpdate.is_available` is never settable | `services/profile.py::upsert_profile` | Medium | Upsert builds the update model from `MechanicProfileCreate`, which has no `is_available`; no endpoint toggles availability. Mechanics can never go offline. |
| 12 | Profile `PUT` upsert uses `model_dump(exclude_unset=True)` on a model built from a full Create payload | `services/profile.py` | Medium | All fields are always "set", so `PUT` is a full replace — the `*Update` partial-update schemas are effectively dead code. |
| 13 | Two error response shapes | `schemas/response.py` vs raised `HTTPException` | Medium | `ErrorResponseModel` is defined but unused; clients see `{"detail": ...}`. |
| 14 | No global exception handler / no `response_model` on error paths | `app/main.py` | Medium | Unhandled exceptions leak default 500s. |
| 15 | Reputation fields never written | `models/profile.py` | Medium | `average_rating`, `total_reviews`, `completed_jobs`, `is_verified` are permanent defaults — do not read them as real data. |
| 16 | `relationship` imported but unused; no ORM relationships defined | `models/profile.py` | Low | Every association requires a manual query. |
| 17 | Vehicle `is_default` has no invariant | `services/vehicle.py` | Low | First vehicle is not auto-defaulted (comment in code says so); deleting the default leaves none; nothing prevents zero defaults. |
| 18 | `registration_number` uniqueness is per-user and app-level only | `services/vehicle.py` | Low | No DB constraint; concurrent requests can duplicate. |
| 19 | `alembic.ini` hardcodes a localhost URL with the password | `alembic.ini` | Low | Overridden at runtime by `env.py`, but misleading and a secret in VCS. |
| 20 | docker-compose never runs `alembic upgrade head` | `docker-compose.yml` | Low | The container starts against an empty schema; migrations are a manual step. |
| 21 | `db/repositories/` has no `__init__.py` | `app/db/repositories/` | Low | Works via implicit namespace packages; inconsistent with the rest of `app/`. |
| 22 | Dockerfile CMD uses `--reload` | `backend/Dockerfile` | Low | Dev server semantics in the image. |
| 23a | **No `.gitignore` anywhere in the repo**; `frontend/node_modules/` (23,080 files) and root `node_modules/` (4,278 files) are COMMITTED — 27,358 of 27,625 tracked files are dependencies | repo root | **High** | Bloats every clone, makes diffs/reviews unusable, and means a future `backend/.env` would be committed with real secrets. `backend/venv/` escapes only because venv auto-writes its own ignore file. |
| 23 | Dead/stray artifacts | `docs/` (empty), `backend/{directives,execution,.tmp}/` (empty), root `package.json`, `Recreating UI from Screenshot (1).html`, `frontend/src/{hooks,store}/` (empty) | Low | Noise; suggests scaffolding that was never used. |
| 24 | `MechanicProfile.supported_vehicle_types` whitelist (`Bike/Car/EV/Truck/Scooter`) does not match the `VehicleType` enum (`BIKE/CAR`) | `schemas/profile.py` vs `models/vehicle.py` | Low | Two incompatible vehicle taxonomies; any future matching logic must reconcile them. |
| 25 | Working hours stored as `String` "HH:MM"; DOB as `String` | `models/profile.py` | Low | No temporal querying possible without casting. |

---

## 14. Architectural Decisions (inferred from code)

**Established**
- PostgreSQL 15 is the persistence layer; it is the only external service.
- FastAPI owns HTTP. Async end-to-end (asyncpg + SQLAlchemy 2.0 async).
- Alembic owns schema evolution; models are the metadata source via `app/models/__init__.py`.
- Layering is route → service → repository → ORM, with FastAPI `Depends` as the DI mechanism
  and per-request service factories defined locally in each router module.
- Errors are signalled by raising `HTTPException` **from the service layer**, not the router.
- Successful responses use the generic `ResponseModel[T]` envelope.
- Auth is stateless JWT for access, stateful (DB-backed, hashed) for refresh, with rotation.
- Argon2, not bcrypt, for password hashing.
- Profiles are 1:1 with users and split by role into two independent tables rather than a
  single polymorphic table.
- Frontend styling is Tailwind with shadcn conventions (CSS-variable HSL tokens, `cn()`,
  `class-variance-authority`), but component primitives are hand-written rather than
  generated by the shadcn CLI.
- Frontend was built presentation-first: animation and design system before data integration.

**UNKNOWN — verify before changing**
- Whether the missing `/api/v1` prefix is an oversight or an intentional un-versioned
  deployment. All other signals (tokenUrl, openapi_url, tests, QA) say oversight.
- Whether the empty `backend/directives/` and `backend/execution/` dirs (and the generic
  3-layer agent SOP mirrored across `CLAUDE.md` / `AGENTS.md` / `GEMINI.md` /
  `backend/agents.md` / `.agents/AGENTS.md`) are meant to govern Wrench's own runtime
  architecture, or are just an AI-workflow harness copied into the repo. **Nothing in
  Wrench's application code implements or references that 3-layer pattern** — treat those
  files as tooling instructions, not as a description of this system.
- Intended production deployment target (no CI, no prod Dockerfile stage, no infra config).
- Whether `admin` role is intended to be provisioned manually via SQL.

---

## 15. Current Implementation Status (engineering capabilities)

Product-requirement status lives in **Product Requirements vs Implementation** (FR-01…FR-12)
— not duplicated here. This table covers only engineering capabilities that no FR names.

| Capability | Status |
|---|---|
| Auth backend: register / login / JWT / refresh rotation / logout | IMPLEMENTED (backend only) |
| Role-based access control | IMPLEMENTED (no path creates non-CUSTOMER users) |
| Customer profile CRUD + location + image URL | IMPLEMENTED (backend only) |
| Vehicle CRUD + default selection | IMPLEMENTED (backend only) |
| Health endpoints | IMPLEMENTED |
| Database migrations (0001–0003) | IMPLEMENTED, not auto-applied |
| Landing page / design system / dashboard shell | IMPLEMENTED (frontend, mock data) |
| Frontend ↔ backend integration | **NOT IMPLEMENTED** (all mocked, zero HTTP calls) |
| Protected frontend routes | NOT IMPLEMENTED |
| Background jobs / scheduler | NOT IMPLEMENTED |
| File/image upload (server-side) | NOT IMPLEMENTED (URL string only) |
| Admin surface | NOT IMPLEMENTED (`get_current_admin` defined, unused) |
| CORS | NOT IMPLEMENTED |
| CI | NOT IMPLEMENTED |
| Backend test suite | PARTIALLY IMPLEMENTED — written, non-runnable (§12) |
| Frontend test suite | PARTIALLY IMPLEMENTED — harness configured, zero tests |

---

## 16. Where To Look For Common Tasks

| Task | Start here |
|---|---|
| Add an endpoint | new file in `app/api/routes/`, register in `app/api/main.py`, add service + repository, mirror the local `get_<x>_service` factory pattern |
| Change auth/token behavior | `app/core/security.py` (crypto) then `app/services/auth.py` (flow) |
| Change who may call what | `app/api/deps.py` |
| Add/modify a table | `app/models/*.py` → export in `app/models/__init__.py` → `alembic revision --autogenerate` → `alembic upgrade head` |
| Change request/response shape | `app/schemas/*.py` (envelope lives in `schemas/response.py`) |
| Add a config value / env var | `app/core/config.py` + `.env.example` |
| Fix the URL prefix | `app/main.py:14` |
| Add CORS | `app/main.py` |
| Wire the frontend to the API | create an API client under `frontend/src/lib/`, replace the mocks in `lib/auth.ts`, `pages/Login.tsx`, `pages/Register.tsx`, `components/dashboard/*` |
| Add frontend state | `frontend/src/lib/auth.ts` (zustand) or the empty `src/store/` |
| Add a frontend route | `frontend/src/App.tsx` (or `pages/Dashboard.tsx` for nested) |
| Touch styling / design tokens | `frontend/tailwind.config.js`, `frontend/src/index.css`, `frontend/docs/DESIGN_SYSTEM.md` |
| Run backend | `docker-compose up --build -d`, then `alembic upgrade head` manually |
| Run frontend | `cd frontend && npm install && npm run dev` (:5173) |

---

---

## Product Requirements vs Implementation

**Provenance.** Product requirements are derived from *"Wrench – Requirement Analysis
Document"*, **Document Version 1.0, August 2026** (Indus University IITE, Ahmedabad; SGP).
Requirement text and priorities below are the document's own. **Implementation status is
derived independently from repository inspection** and is never inferred from the RAD.

**Three sources of truth — do not mix:** RAD = required product behaviour (authoritative for
requirements). Source code = current behaviour (authoritative for status). brain.md = derived
map of the relationship.

**Status is never granted for:** frontend display, a component name, a placeholder, a
documentation mention, or a database column. Only executable implementation counts.

**RAD system overview (§4)** names the intended stack: React/Vite/Tailwind/Framer Motion
frontend; FastAPI REST **+ WebSocket**; PostgreSQL; **Mapbox or OpenStreetMap**; **Razorpay**;
**Gemini or OpenAI**. The frontend stack matches the repo. Of the four external services the
RAD requires, **zero are integrated** — PostgreSQL is the only external dependency present.

Evidence baseline: **21 routes**, **5 tables** (`users`, `refresh_tokens`,
`customer_profiles`, `mechanic_profiles`, `vehicles`), **6 tests** (profile-scoped, all
non-runnable — §12), **0 WebSocket endpoints**, **0 third-party integrations**.

### Functional Requirements

Requirement + Priority columns are verbatim RAD §5. Evidence + Gap columns are repository-derived.

| ID | Requirement (RAD §5) | Priority | Status | Evidence (repo) | Gap |
|---|---|---|---|---|---|
| **FR-01** | Allow vehicle users and mechanics to register and authenticate using mobile number/email-based **OTP** or credential-based login | High | **PARTIALLY IMPLEMENTED** | `routes/auth.py` (6 routes), `services/auth.py`, `core/security.py`, `api/deps.py`, `models/{user,token}.py`. argon2 + HS256 access (15 m) / refresh (7 d) with rotation, SHA-256 storage, revocation | **No OTP path at all** (credential-only). **Mechanics cannot register** — `services/auth.py:24-28` never passes `role`; `UserCreate` has no `role` field, so every user is CUSTOMER. Frontend auth is mocked (`lib/auth.ts:32`). No `/api/v1` prefix; no verification, reset, or rate limiting |
| **FR-02** | Detect the user's live location and display nearby available mechanics using **Mapbox/OpenStreetMap** | High | **NOT IMPLEMENTED** | None. No discovery route among the 21. Storage only: `mechanic_profiles.latitude/longitude`, `service_radius_km`, `is_available` | Entire requirement. Grep `nearby\|search\|distance\|haversine\|postgis\|mapbox` in `app/` → 0 hits. `service_radius_km` is **never read by any query** (its only uses are the column def + schema). No map provider integration; `SectionPhoneSequence.tsx:169` is a div labelled "Fake Mapbox Background" |
| **FR-03** | Allow a user to select a mechanic from search results and raise a service request/booking | High | **NOT IMPLEMENTED** | None. No booking model, route, service, or repository. Migrations 0001–0003 create 5 tables; none is a booking table | Entire requirement. **Keystone** — FR-04, 05, 07, 08, 10, 11 all depend on it. Grep `booking\|service_request\|job\|dispatch` → only `completed_jobs`, an unwritten counter |
| **FR-04** | Provide live location tracking of the assigned mechanic **via WebSocket** until arrival | High | **NOT IMPLEMENTED** | None. 0 WebSocket endpoints; grep `websocket\|socket.io\|sse` in `app/` + `frontend/src/` → 0 hits | Entire requirement. Location is a REST-updated scalar with no history and no subscribers. Needs transport, connection manager, socket auth, and a pub/sub backplane for scaling |
| **FR-05** | Allow status updates of a booking (**Pending, Accepted, En Route, In Progress, Completed, Cancelled**) visible to both parties | High | **NOT IMPLEMENTED** | None. No status enum or transition service. Only enums in repo: `UserRole`, `VehicleType`, `FuelType` | Entire requirement — all six states, transition guards, and dual-party visibility. Blocked by FR-03 |
| **FR-06** | Provide an AI chat assistant guiding the user through basic diagnostic questions when no mechanic is immediately available | High | **NOT IMPLEMENTED** | None. Grep `gemini\|openai\|llm\|chat\|conversation\|troubleshoot` in `app/` → 0 hits. No AI SDK in `requirements.txt`; no API key in `.env.example` | Entire requirement. **Already marketed in the shipped UI** — `Chapter4.tsx:57` promises "our advanced AI runs a full diagnostic"; `Landing.tsx:104,115` advertise "Intelligent Diagnostic System". Copy, not code |
| **FR-07** | Attach and forward the AI conversation summary and diagnostic data to the assigned mechanic upon escalation | High | **NOT IMPLEMENTED** | None. No escalation trigger, summary, handoff payload, or booking linkage | Entire requirement — 0 of 8 components (see below). **The RAD's stated differentiator** (§1, §10) |
| **FR-08** | Enable users to make secure service payments through the **Razorpay** gateway | High | **NOT IMPLEMENTED** | None. Grep `razorpay\|payment\|invoice\|refund` in `app/` → 0 hits. No payment table | Entire requirement. **No monetary field exists anywhere in the schema** — no rate, fee, or price column. (`ProfileSettings.tsx` collects an `hourlyRate` with no backend counterpart) |
| **FR-09** | Allow mechanics to manage their profile, **service categories**, and **real-time availability status** | Medium | **PARTIALLY IMPLEMENTED** | `routes/mechanic_profile.py` (3 routes), `services/profile.py::MechanicProfileService`, `repositories/profile.py`, `models/profile.py::MechanicProfile`. Profile CRUD + `PATCH /location` work; validation is thorough (HH:MM, lat/lng bounds, type whitelist) | **Availability cannot be changed** — `MechanicProfileUpdate` declares `is_available` (`schemas/profile.py:114`) but `upsert_profile` builds the update from `MechanicProfileCreate`, which lacks it, and no route toggles it. A mechanic can never go offline (§13 #11). **No mechanic user can exist** (FR-01). Service categories only partially modelled (`specialization` String + `supported_vehicle_types` ARRAY) |
| **FR-10** | Allow users to rate and review a mechanic after service completion | Medium | **NOT IMPLEMENTED** | None. No `Review` model or route. Columns only: `average_rating` (0.0), `total_reviews` (0) — `models/profile.py:58-62` is their **complete write surface** | Entire requirement. Both counters are permanently zero; treat as no data. Blocked by FR-03/FR-05 |
| **FR-11** | Maintain a record of past **bookings, invoices, and AI diagnostic sessions** for each user account | Medium | **NOT IMPLEMENTED** | None of the three record types exists. Adjacent working code: vehicle CRUD (`routes/vehicles.py`, 6 routes, ownership-checked, default selection) | Entire requirement. Needs FR-03 (bookings), FR-08 (invoices), FR-06 (AI sessions) — the **broadest dependency set of any FR** |
| **FR-12** | Send real-time notifications for **booking confirmation, mechanic arrival, and payment status** updates | Medium | **NOT IMPLEMENTED** | None. Grep `notification\|fcm\|push\|sms\|twilio\|celery\|redis` in `app/` → 0 hits. `sonner` is a frontend dep, never imported | Entire requirement. All three triggers depend on FR-03/04/08. No channel, queue, templates, or preferences. `email-validator` exists only for Pydantic `EmailStr` — there is no mail sender |

### Core End-to-End Flows

RAD-required vs actual. Only flow 1 has working code, and it stops at the API boundary.

| Flow (UC) | RAD: should happen | CURRENT: actually happens | Gap |
|---|---|---|---|
| Auth (UC-01) | User **and mechanic** register via OTP or credentials | Backend credential flow complete and sound; frontend fakes it; CUSTOMER-only | OTP; mechanic registration; frontend wiring; prefix; CORS |
| Discovery (UC-02) | GPS → nearby available mechanics via Mapbox/OSM | Nothing. `Landing.tsx:161` shows "Generating 12 mechanics nearby…" as static copy | Query, map provider, distance ranking, availability filter |
| Booking (UC-03/07) | Select mechanic → raise request → mechanic accepts/updates | Nothing | Entire domain — gates 6 FRs |
| Tracking (UC-04) | WebSocket live position until arrival, ≤5 s refresh | Nothing | Transport, connection manager, socket auth, map UI |
| Status lifecycle | 6 states visible to both parties | Nothing | Enum, guarded transitions, dual-party reads |
| AI troubleshooting (UC-05) | Chat assistant when no mechanic available | Nothing in code; advertised in `Chapter4.tsx` | Provider, conversation model, prompts, persistence |
| Escalation (UC-06) | Unresolved session → mechanic **with context** | Nothing | See below — 0 of 8 components |
| Payment (UC-08) | Razorpay order → verify → confirm | Nothing; no price field in schema | Full integration incl. webhook + idempotency |
| Availability (UC-10) | Mechanic toggles online/offline | Column defaults `True`; **no route can change it**; no mechanic can exist | Toggle endpoint; fix `upsert_profile` field loss; role provisioning |
| Rating (UC-09) | Post-service rating updates reputation | Columns at 0; nothing writes them | Review entity, aggregation, eligibility |
| History | Bookings + invoices + AI sessions | Nothing (vehicle CRUD only) | Depends on FR-03/06/08 |
| Notifications | Confirmation / arrival / payment events | Nothing | Channel, queue, worker |

### AI Diagnostic Fallback — the RAD's Central Differentiator

**REQUIRED BY RAD** (§1, §3, §10 — the document calls this out as what distinguishes Wrench
from "static directories of service providers"):

```
Vehicle problem → Nearby mechanic discovery → Mechanic cannot be reached immediately
  → AI preliminary troubleshooting → Problem remains unresolved → Escalate to live mechanic
  → Forward AI conversation summary + diagnostic data → Mechanic continues assistance
```

**CURRENTLY IMPLEMENTED: none of it.**

| Component | Present? | Evidence |
|---|---|---|
| AI conversation / session model | **NO** | No model, table, or migration |
| AI service | **NO** | No `services/ai*.py`; no Gemini/OpenAI SDK; no API key in `.env.example` |
| Diagnostic storage | **NO** | No diagnostic table or column in the 5-table schema |
| Diagnostic summary | **NO** | No summarisation code or stored summary field |
| Escalation mechanism | **NO** | No trigger, no unresolved-state detection, no route |
| Mechanic context handoff | **NO** | No payload, delivery path, or mechanic-side read endpoint |
| Booking linkage | **NO** | No booking entity to link to (FR-03) |
| "Mechanic unavailable" detection | **NO** | Needs FR-02 discovery + working FR-09 availability; neither exists |

**0 of 8 present.** Two aggravating factors: (1) it is the most dependency-laden requirement
in the product — it needs FR-02, FR-03, FR-06, FR-09 and FR-12 before it can exist, so it
cannot be built early despite being the differentiator; (2) it is **already described to
users** in shipped frontend copy (`Chapter4.tsx:57`).

RAD §7 constrains it: AI troubleshooting is **preliminary diagnostics only** and cannot
substitute for a certified mechanic's physical inspection. Any future implementation must
carry that limitation in its UX.

### Non-Functional Requirements

RAD §6 wording; status from repository evidence. **Architectural capability is not satisfaction.**

| NFR | RAD Requirement (§6) | Status | Evidence | Gap |
|---|---|---|---|---|
| **6.1 Performance** | Mechanic search responds **within 3 s** under normal network conditions | **NOT IMPLEMENTED** | No search exists to measure. Lat/lng are `Numeric(9,6)`; no spatial index, no PostGIS | Requires FR-02 first; then a benchmark. No load test in repo |
| **6.1 Performance** | WebSocket location updates refresh at intervals **not exceeding 5 s** | **NOT IMPLEMENTED** | No WebSocket layer exists | Requires FR-04 |
| **6.2 Security** | All data (incl. location, payment) over encrypted **HTTPS/WSS** | **NOT IMPLEMENTED** | No TLS termination, proxy, or HSTS. `docker-compose.yml` exposes plain `:8000`; Dockerfile runs `uvicorn --reload` | TLS termination + deployment target |
| **6.2 Security** | Authentication shall be token-based (**JWT**) | **PARTIALLY IMPLEMENTED** | Correctly built: `core/security.py`, `api/deps.py` — HS256, exp, access/refresh separation, rotation, revocation | Undermined by a **committed default `SECRET_KEY`** (`config.py:13`) that silently applies when the env var is absent (§13 #6) |
| **6.2 Security** | Razorpay integration complies with **PCI-DSS** handling | **NOT IMPLEMENTED** | No payment integration | Requires FR-08 |
| **6.2 Security** | **Raw card details never stored** on Wrench servers | **NOT IMPLEMENTED** | Vacuously true — no payment code and no card field exist | Recorded as not-implemented, **not** satisfied: this is absence, not a control |
| **6.3 Reliability** | Gracefully handle network interruptions, **preserving booking state** for resume without data loss | **NOT IMPLEMENTED** | No booking state exists. Compounding: repositories each commit independently, so multi-step writes are already non-atomic (§13 #9 — `set_default_vehicle` can leave zero defaults) | Requires FR-03 + the transaction refactor |
| **6.3 Reliability** | Preserve **AI conversation state** across reconnection | **NOT IMPLEMENTED** | No AI conversation state exists | Requires FR-06 |
| **6.4 Availability** | Core booking/tracking/payment target **99.5 % uptime** | **NOT IMPLEMENTED** | Single non-replicated Postgres container, single backend container, no healthcheck in compose, no restart policy, no monitoring, no CI | No SLO instrumentation of any kind |
| **6.5 Usability** | Intuitive under stress; **minimal steps** to search, book, track | **NOT IMPLEMENTED** | No search/book/track flow exists. Frontend has a polished landing page and a mocked dashboard | Requires FR-02/03/04 |
| **6.5 Usability** | **Clear visual feedback** at each stage | **NOT IMPLEMENTED** | No status model (FR-05) to give feedback about | Requires FR-05 |
| **6.6 Maintainability** | Modular FastAPI structure **separating authentication, booking, payments, AI integration** | **PARTIALLY IMPLEMENTED** | The modular structure is real and good: route → service → repository → ORM, DI via `Depends`, single router registry (`api/main.py`), single session authority (`db/session.py`), consistent `ResponseModel[T]`. **Authentication is cleanly separated as the RAD requires** | Only 1 of the 4 named concerns exists. Booking, payments, and AI modules are absent, so the separation is **demonstrated but not yet proven** at the required scope |
| **6.7 Scalability** | Horizontal scaling of backend services | **PARTIALLY IMPLEMENTED** | Favourable: app is stateless — JWT auth, no server-side sessions, no in-process caches | No shared pub/sub backplane (no Redis), which FR-04's WebSocket layer will require; no orchestration or load balancer |
| **6.7 Scalability** | **Database read** scaling | **NOT IMPLEMENTED** | Single engine on one `DATABASE_URL` (`db/session.py:5-9`); no replica routing, no pool tuning, no cache | Read-replica routing + pool configuration |

**NFR totals: 0 IMPLEMENTED · 3 PARTIALLY IMPLEMENTED · 11 NOT IMPLEMENTED.**
Maintainability (6.6) is the closest to satisfied and the repo's strongest asset — but it is
now *partial*, not complete, because the RAD names four concerns to separate and only
authentication exists.

### Scope and Constraints

**RAD §3 scope:** web and mobile-accessible platform; user + mechanic registration; GPS
discovery; real-time booking and tracking via WebSockets; AI troubleshooting chatbot;
escalation with context; Razorpay payments. **Excluded:** heavy commercial vehicles, vehicle
insurance claim processing, spare-parts e-commerce. Administrative functions (mechanic
verification, platform analytics) are a **supporting back-office module**, high-level only.

**RAD §7 system constraints:** active internet required (no offline mode); location accuracy
bounded by Mapbox/OSM + device GPS; payments limited to Razorpay's regional methods; AI is
**preliminary diagnostics only**, never a substitute for physical inspection; initial version
is **two- and four-wheeler only**.

**RAD §8 assumptions:** mechanics have capable smartphones; users grant location permission;
third-party API stability (Razorpay, Mapbox/OSM, Gemini/OpenAI); mechanics keep availability
current themselves; ≥3G/4G connectivity.

| Constraint | Repository alignment |
|---|---|
| Two- and four-wheelers only | **CONFLICT.** `VehicleType` = `BIKE\|CAR` ✓, but `MechanicProfileBase.supported_vehicle_types` (`schemas/profile.py:88`) whitelists `{Bike, Car, EV, Truck, Scooter}` — **`Truck` violates the 2W/4W scope**, and the two taxonomies disagree in membership and casing (§13 #24) |
| No heavy commercial vehicles | Same conflict — `Truck` is accepted today |
| No insurance claim processing | Respected — no such code, model, or field |
| No spare-parts e-commerce | Respected — no catalogue, cart, inventory, or order model |
| Admin = back-office support | Consistent but unbuilt: `UserRole.ADMIN` and `get_current_admin` exist, **no route uses them**, no admin user can be created |
| Mechanics self-manage availability (§8) | **CONFLICT.** The RAD *assumes* mechanics keep availability current; the code makes that **impossible** (FR-09) |

### Current Product Gap Summary

| Status | Count | Requirements |
|---|---|---|
| IMPLEMENTED | **0** | — |
| PARTIALLY IMPLEMENTED | **2** | FR-01 (High), FR-09 (Medium) |
| NOT IMPLEMENTED | **10** | FR-02, 03, 04, 05, 06, 07, 08 (High); FR-10, 11, 12 (Medium) |
| BLOCKED | **0** | No external obstacle; every gap is unbuilt work with an internal dependency chain |
| UNKNOWN | **0** | All 12 resolved from repository evidence |

**By RAD priority: 7 of 8 High-priority requirements are entirely unimplemented; the eighth
(FR-01) is partial and cannot serve mechanics.**

**Direct RAD-vs-code contradictions** (requirement violated, not merely unbuilt):

1. **FR-01 requires mechanics to register. The code makes it impossible.** Not just missing —
   it structurally blocks FR-09, and via FR-09 blocks FR-02, FR-03 and FR-07.
2. **RAD §8 assumes mechanics self-manage availability. No route can set `is_available`.**
3. **RAD scope permits only 2W/4W. `supported_vehicle_types` accepts `Truck`.**
4. **RAD §4 requires WebSocket endpoints in FastAPI. Zero exist.**
5. **The frontend markets three unbuilt capabilities** — AI diagnostics (`Chapter4.tsx:57`),
   nearby-mechanic search (`Landing.tsx:161`), live tracking (`SectionPhoneSequence.tsx:272`).
   Copy is not implementation; all three remain NOT IMPLEMENTED.

**Four structural gaps, by consequence:** (1) no booking domain — FR-03 gates six FRs;
(2) no AI subsystem — the differentiator is 0/8; (3) no discovery layer — coordinates are
write-only; (4) no frontend↔backend integration — zero HTTP calls in `frontend/src/`.

**Genuinely solid and worth preserving:** layered FastAPI architecture, auth/token
implementation, vehicle CRUD, Pydantic validation discipline. The deficit is product
breadth, not code quality.

## Recommended Development Roadmap

Ordered by dependency, not convenience or RAD priority. (RAD priority breaks ties; it cannot
override a dependency — FR-07 is High but necessarily late.)

**Phase 0 — Make the repository verifiable.** Hygiene (done) → `async_session` rename →
**runnable test suite on real PostgreSQL** → `/api/v1` prefix → `SECRET_KEY` removal/rotation.
*No requirement can be verified while zero tests run.* Cheapest phase; everything depends on it.

**Phase 1 — Make existing product reachable.** Role provisioning (CUSTOMER/MECHANIC at
registration, ADMIN excluded) → CORS → FR-09 availability toggle fix → narrow transaction fix
→ **wire frontend to the real API** (client, real auth, align `Vehicle` shape, normalise role
casing, protected routes). *Completes FR-01/FR-09 — the only FRs with code — and resolves
contradictions 1 and 2. First genuine end-to-end path.*

**Phase 2 — Discovery (FR-02).** Map provider decision (Mapbox vs OSM per RAD §4), discovery
endpoint filtered by availability + `service_radius_km`, distance ranking. **Decide
`Numeric`+Haversine vs PostGIS `geography` now** — retrofitting a spatial index later means a
data migration, and NFR 6.1's 3 s budget depends on it. Reconcile the vehicle taxonomy
(drop `Truck`, contradiction 3).

**Phase 3 — Booking + status lifecycle (FR-03 + FR-05). Highest-leverage phase.** Booking
model, the six RAD states, guarded transitions, dual-party routes. Build together — a booking
without a lifecycle is unusable and retrofitting a state machine onto a live table is
expensive. *Unblocks six requirements.* Do the broad transaction refactor (§13 #9) immediately
before this: booking is the first genuinely multi-write domain and NFR 6.3 demands atomicity.

**Phase 4 — History (FR-11 partial) + notifications (FR-12).** History over Phase 3 data is
nearly free. Notifications need a background worker (first new infra dependency) and must
precede FR-07, which needs a channel to reach the mechanic.

**Phase 5 — AI troubleshooting (FR-06).** Provider (Gemini/OpenAI per RAD §4), conversation
model, diagnostic storage, prompts, key management, cost/rate limits. NFR 6.3 requires
conversation state to survive reconnection — design persistence in from the start, not later.

**Phase 6 — Escalation (FR-07) — the differentiator.** Unavailability detection → AI session →
summary → escalation trigger → booking linkage → mechanic handoff. Last requirement whose
dependencies all resolve (needs Phases 2–5). **Tension worth naming:** the RAD's headline
feature is, by dependency, one of the last buildable. The honest lever is narrowing Phases 3–5,
not reordering — and `Chapter4.tsx` copy should be softened until it ships.

**Phase 7 — Payments (FR-08).** Razorpay orders, signature verification, webhook with
idempotency, payment state coupled to booking state, refunds. Requires pricing fields the
schema entirely lacks. Needs a trustworthy lifecycle first — payment bugs on an unstable state
machine cost real money.

**Phase 8 — Rating/review (FR-10).** Review entity, eligibility tied to completed bookings,
aggregation into the columns that finally stop being zero. Pure consumer; nothing depends on it.

**Phase 9 — Real-time tracking (FR-04).** WebSocket transport, connection manager, socket auth,
position streaming, map UI, pub/sub backplane. Highest infra cost. **Deliverable as REST
polling far earlier if NFR 6.1's 5 s interval can be met that way — worth raising with the
product owner, as it could move tracking to Phase 4 at a fraction of the cost.**

**Cross-cutting, deliberately unphased:** HTTPS/WSS (NFR 6.2), monitoring + the 99.5 % SLO
(6.4), read-replica routing (6.7), CI. Not FR-blocking, so they appear in no phase — but **no
phase above yields a production-ready system without them.**


---

## Phase 0 — Foundation (COMPLETE)

Delivered: runnable test suite, versioned API contract, no default secret, CORS, and a
live frontend→backend round trip. **27 tests pass (16 backend, 11 frontend); 0 fail.**

### Local development

| Step | Command | Notes |
|---|---|---|
| 1. PostgreSQL | `brew services start postgresql@18` | Local Homebrew PG 18.4 on :5432. `docker-compose up db` also works (needs Docker running). |
| 2. Databases | `createdb -U postgres wrench && createdb -U postgres wrench_test` | One-time. |
| 3. Backend env | `cp backend/.env.example backend/.env` then set `SECRET_KEY` | `python -c "import secrets; print(secrets.token_hex(32))"` |
| 4. Migrations | `cd backend && ./venv/bin/python -m alembic upgrade head` | Not automatic; compose does not run it either. |
| 5. Backend | `cd backend && ./venv/bin/python -m uvicorn app.main:app --reload` | http://localhost:8000 · docs at `/docs` |
| 6. Frontend | `cd frontend && npm install && npm run dev` | http://localhost:5173 |

**Verify:** open http://localhost:5173 — a badge reads **"Backend connected"** (bottom-left,
dev builds only). Confirmed live: `GET http://localhost:8000/api/v1/health → 200`.

**Python 3.11 is required.** `requirements.txt` pins (pydantic 2.7.4, asyncpg 0.29.0) need
source builds that fail on 3.13+. Matches `Dockerfile` (`python:3.11-slim`).
Venv: `/opt/homebrew/opt/python@3.11/bin/python3.11 -m venv venv`.

### Test commands

| Suite | Command | Result |
|---|---|---|
| Backend | `cd backend && ./venv/bin/python -m pytest` | **16 passed** |
| Frontend | `cd frontend && npx vitest run` | **11 passed** |
| Frontend build | `cd frontend && npm run build` | passes (`tsc` + `vite build`) |

### API contract

**All 21 routes are served under `/api/v1`**, applied once at `app/main.py` via
`include_router(api_router, prefix=settings.API_V1_STR)`. No router self-prefixes, so it is
never doubled. `deps.py` derives `tokenUrl` from `settings.API_V1_STR` rather than hardcoding.
Health for the smoke flow: `GET /api/v1/health` → `{"status":"ok"}`.

### New/changed authorities

| Concern | Authority | Note |
|---|---|---|
| Router mount + CORS | `backend/app/main.py` | single mount point; `CORSMiddleware` with explicit origins |
| Configuration | `backend/app/core/config.py` | `SECRET_KEY` has **no default**; `cors_origins` property parses `BACKEND_CORS_ORIGINS` |
| Test fixtures | `backend/tests/conftest.py` | sets `DATABASE_URL` before app import so `app.db.session` stays the only engine |
| Pytest config | `backend/pytest.ini` | `asyncio_mode=auto`, session-scoped loops |
| Test deps | `backend/requirements-dev.txt` | `-r requirements.txt` + pytest/pytest-asyncio/httpx. Production `requirements.txt` **unchanged** |
| **Frontend HTTP** | **`frontend/src/lib/api.ts`** | **the single HTTP boundary — never call `fetch` in components** |
| Health indicator | `frontend/src/components/dev/BackendStatus.tsx` | dev-only, mounted in `App.tsx` |

### Environment variables

| Variable | Where | Required | Default |
|---|---|---|---|
| `DATABASE_URL` | backend | yes | none |
| `SECRET_KEY` | backend | **yes — startup fails without it** | none (by design) |
| `BACKEND_CORS_ORIGINS` | backend | no | `http://localhost:5173` (comma-separated or JSON) |
| `TEST_DATABASE_URL` | backend tests | no | `postgresql+asyncpg://postgres@localhost:5432/wrench_test` |
| `VITE_API_BASE_URL` | frontend | no | `http://localhost:8000/api/v1` |

### Fixed in Phase 0

1. **Hygiene** (§13 #23a) — root `.gitignore`; 27,358 dependency files untracked; 266 source
   files remain.
2. **`async_session` → `AsyncSessionLocal`** (§13 #2) — `conftest.py`, `run_qa.py`,
   `run_qa_vehicles.py`. No second session implementation.
3. **Test suite runs on real PostgreSQL** (§12, §13 #7/#8) — SQLite dropped (cannot host
   `postgresql.UUID`/`ARRAY`). Schema created once per session; **TRUNCATE before each test**
   for isolation (repositories commit their own transactions, so rollback would not isolate).
   `httpx.AsyncClient` + `ASGITransport` replaces `TestClient`, removing the event-loop
   mismatch. `test_404_profile_not_found` — previously a `pass` — now genuinely asserts 404.
4. **`/api/v1` prefix applied** (§13 #1) — protected by `test_api_contract.py`, which also
   asserts unversioned paths are *not* served.
5. **`SECRET_KEY` default removed** (§13 #6) — old committed key deleted from `config.py` and
   `.env.example`; `docker-compose.yml` uses `${SECRET_KEY:?...}` and fails fast.
6. **CORS added** (§13 #3) — explicit origins, `allow_origins=["*"]` deliberately avoided.
7. **UUID serialization bug fixed** (§13 #10, was UNVERIFIED — now confirmed real): schemas
   declared `id: str` while SQLAlchemy returns `uuid.UUID`; pydantic v2 does not coerce, so
   **every** profile/vehicle/user response raised `ValidationError` → HTTP 500. Now typed
   `UUID` in `schemas/{user,vehicle,profile}.py`; JSON wire format is unchanged (still a
   string), pinned by a regression test.
8. **`alembic upgrade head` fixed — it failed on a clean database.** Migration `0003` created
   the `vehicletype`/`fueltype` enums then passed the same `ENUM` objects to `create_table`,
   re-emitting `CREATE TYPE` → `DuplicateObjectError`. Now uses `create_type=False`, matching
   the pattern `0001` already used. Regression test verified to fail before the fix.
9. **Frontend build fixed** — `npm run build` had never passed. 13 pre-existing type errors
   repaired mechanically; 2 dead files (`Section2Problem.tsx`, `SectionPhoneSequence.tsx`)
   deleted — unreferenced, importing components that never existed, absent from the bundle.

### Remaining limitations

- **Frontend is still mocked** — `lib/auth.ts`, `Login`, `Register`, `ProfileSettings`,
  `VehicleManager` all use fake data. `api.ts` exists but only `getHealth()` is wired.
  Phase 1 work.
- `setAuthToken()` exists in `api.ts` but no store calls it yet (Phase 1).
- **No HTTPS/WSS**; CORS is dev-oriented. Revisit at Phase 9 with a real deployment model.
- **Repositories still own transactions** (§13 #9) — `set_default_vehicle` and
  `refresh_tokens` remain non-atomic. Deliberately deferred; do the narrow fix in Phase 1 and
  the broad refactor immediately before Phase 4 (booking).
- ESLint fails to run: `.eslintrc.cjs` is eslintrc-format but ESLint 9 requires flat config.
  Pre-existing; not Phase 0 scope.
- `frontend/index.html` still has the template `<title>Tasker - Task Management</title>`.
- `docker-compose.yml` still does not run migrations; step 4 above stays manual.
- Backend `venv/` is local-only and gitignored; CI does not exist.

### Next phase

**Phase 1 — Authentication + roles + frontend auth.** Role provisioning at registration
(`CUSTOMER`/`MECHANIC`, `ADMIN` excluded — see FR-01), wire `lib/auth.ts` to real
`/api/v1/auth` endpoints through `api.ts`, register the token with `setAuthToken`, add
protected routes, and normalise role casing (backend emits uppercase; the UI compares
lowercase).

---

### Landing page animation (scroll-scrubbed hero)

Ported from the standalone `cinematic-landing-page` prototype (`~/new/`).

| Concern | Authority |
|---|---|
| Hero animation | `frontend/src/components/features/HeroVideoScrub.tsx` |
| Scroll driver + section snap | `frontend/src/pages/Landing.tsx` (`useEffect`) |
| Frame assets | `frontend/public/frames/frame_0001.jpg` … `frame_0144.jpg` (4K, 1-indexed) |

**How it works.** A `<canvas>` (3840×2160) is pinned by GSAP ScrollTrigger over a 4000px
scroll range and scrubbed through 144 preloaded 4K JPEGs, with a 1→1.08 zoom and four
timed overlays (hero text, diagnostic-match card, ETA card, CTA). `snapTo: [0, 1]` makes
the hero settle at either end rather than mid-sequence.

**Critical: Lenis must drive ScrollTrigger.** The prototype ran its own
`requestAnimationFrame` loop, which leaves ScrollTrigger's scroll listener starved — the
hero scrolls past instead of pinning and the scrub never advances. `Landing.tsx` uses the
documented integration instead:

```
lenis.on('scroll', ScrollTrigger.update);
gsap.ticker.add((t) => lenis.raf(t * 1000));
gsap.ticker.lagSmoothing(0);
```

Verified live: at scroll 3200 the trigger reports `progress 0.796`, section
`position: fixed`, canvas `scale(1.064)`, and canvas mean luminance 123.7/255 (the
sequence transitions night→day, so a bright frame proves the scrub advanced).

**Adaptations from the prototype:** `theme-accent` → `emerald-500/400` (Wrench has no
`theme` token; the prototype's accent was the same `#10b981`); Wrench's richer
`PillButton`/`SpecularButton`/`FloatingNavbar` kept — the prototype's simpler versions were
NOT copied; cleanup kills only this component's trigger, not all of them.

**Smoothness work (do not regress these).** Four fixes, in order of impact:

1. **Backing store is sized to the element x DPR (capped 2), not 3840x2160.** Painting
   8.29 MP every tick to display ~1.0 MP was the dominant cost. Now 3.88 MP at DPR 2 —
   **2.1x less fill per paint** (8.5x on a 1x display). Requires manual cover math in
   `drawCover`, since `object-fit` no longer applies.
2. **Redundant draws skipped.** GSAP `onUpdate` fires every tick but 144 frames over
   4000 px means many ticks map to one frame; `drawnFrame` guards the repaint.
3. **Batched `img.decode()` warm-up (8 at a time)** removes the first-pass hitch where
   each frame decoded lazily on its first paint. Frame 1 also has an `onload` fast path
   so the hero never sits black.
4. **Snapping removed.** `snapTo: [0, 1]` over 1.5-3 s hijacked the scroll whenever the
   user paused — the single biggest source of *perceived* roughness. Lenis alone carries
   the motion now. `scrub` 1.5 -> 0.6 so the canvas tracks the cursor instead of lagging.

Lenis uses `lerp: 0.09` (frame-rate independent) rather than `duration` + easing, which
re-eases on every wheel event and makes the sequence surge and settle.
`prefers-reduced-motion` falls back to `scrub: true`. Resize re-sizes and repaints.

**Known limitations.** ~55 MB of frames still preload eagerly with no progress indicator;
mobile behaviour is unverified. Note: this environment's browser pane suspends
`requestAnimationFrame` when hidden, which stops `gsap.ticker` -> Lenis -> ScrollTrigger;
a blank canvas or unpinned section in an automated screenshot is usually that, not a bug.

**Now unreferenced by the hero swap:** `components/VideoScrubber.tsx`,
`components/ui/GlassMetricCard.tsx`, and the 144 legacy `frame_XXXX.png` files (0-indexed,
720p, 117 MB tracked). Safe to delete — nothing imports or serves them.

---

## Phase 1 — Authentication + Roles (COMPLETE)

FR-01 is now **IMPLEMENTED** except OTP (see limitations). **67 tests pass** (46 backend,
21 frontend). Verified end to end in a browser.

### Endpoint contract

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/api/v1/auth/register` | public | `role` accepts `CUSTOMER` \| `MECHANIC` only; defaults `CUSTOMER` |
| POST | `/api/v1/auth/login` | public | returns access + refresh |
| POST | `/api/v1/auth/refresh` | public | **rotates**; old token revoked |
| POST | `/api/v1/auth/logout` | bearer | revokes the supplied refresh token |
| GET | `/api/v1/auth/me` | bearer | current user |
| GET | `/api/v1/admin/users` | bearer + ADMIN | back-office (RAD s3) |

### Role provisioning decision

- **CUSTOMER / MECHANIC self-register** — RAD FR-01 says "vehicle users and mechanics ...
  register". The frontend exposes a role toggle.
- **ADMIN is never creatable through the API.** `UserCreate.role` is
  `Literal["CUSTOMER","MECHANIC"]`, so `role: "ADMIN"` fails validation with **422** — the
  type is the guard, not a runtime check. Provision with:
  `ADMIN_PASSWORD=... ./venv/bin/python -m scripts.create_admin --email a@b.com --phone +1...`
  (password read from env or prompt, never argv).

### Authorities (reused, not duplicated)

`core/security.py` (argon2 + HS256) · `api/deps.py` (**the single RBAC authority** —
`_verify_role` + `get_current_customer/mechanic/admin`) · `services/auth.py` (flows) ·
`db/repositories/{user,token}.py` · frontend `lib/api.ts` (single HTTP boundary) ·
`lib/auth.ts` (single auth store).

### Token persistence decision

**Access token in memory only; refresh token in `localStorage`** (zustand `persist` +
`partialize`). On boot `loadSession()` exchanges the refresh token for a fresh access
token. This keeps the access token out of storage entirely.

**Accepted risk:** the refresh token is still XSS-readable. Eliminating that needs an
httpOnly cookie + CSRF protection, which requires the backend to issue cookies — deferred
to Phase 9. Documented rather than silently accepted.

### Bugs found and fixed in Phase 1

1. **Refresh returned HTTP 500 within a second of login.** Refresh JWTs were
   `{sub, exp, type}` with 1-second `exp` resolution, so two tokens for the same user in
   the same second were byte-identical and the hash collided with the unique index on
   `refresh_tokens.hashed_token`. Fixed with a random `jti` claim in `core/security.py`.
2. **Session was lost on every page reload.** React StrictMode invokes the boot effect
   twice; both calls read the same refresh token, the first rotated it, the second
   replayed a revoked token and signed the user out. Fixed with an in-flight guard in
   `loadSession`. Regression test asserts three concurrent calls make exactly two requests.
3. **Role casing mismatch** — UI compared `'mechanic'`, backend emits `'MECHANIC'`. Every
   role check silently fell through to the customer branch. Caught by the new types.
4. Over-escaped HTML `pattern` on the phone field blocked all valid submissions.

### Manual test

Start: `brew services start postgresql@18` · `cd backend && ./venv/bin/python -m uvicorn
app.main:app --reload` · `cd frontend && npm run dev`

1. http://localhost:5173 → hero (signed out) 2. Register → choose Vehicle owner or
Mechanic 3. Lands on `/dashboard` 4. Reload → still signed in 5. Sign Out →
`/dashboard` redirects to `/login` 6. `/` shows the hero again.

ADMIN: provision via the script, then `POST /api/v1/auth/login` and
`GET /api/v1/admin/users`. There is no admin UI (back-office scope, not built).

### Remaining limitations

- **No OTP.** RAD FR-01 offers "OTP **or** credential-based login"; credentials are
  implemented, OTP is not. FR-01 is therefore not 100% covered.
- No password reset, email/phone verification, or rate limiting on login/register.
- No refresh-token **reuse detection** (a replayed token is rejected but does not
  invalidate the family).
- Registration collects email/phone/password only — display name lives on the profile
  (Phase 2).
- Repositories still own transactions (§13 #9); unchanged this phase.
- Mechanic `is_available` still cannot be toggled (FR-09, Phase 2).

### Next phase

**Phase 2 — Mechanic Profile + Availability (FR-09):** availability toggle, profile CRUD
wired to the real API, and the `Truck` scope conflict in `supported_vehicle_types`.

---

## Phase 2 — Mechanic Profile + Availability (COMPLETE)

FR-09 is now **IMPLEMENTED**. **113 tests pass** (81 backend, 32 frontend). Verified in a
browser end to end.

### Authorities

| Concern | Authority |
|---|---|
| Mechanic profile model | `backend/app/models/profile.py::MechanicProfile` |
| Schemas | `backend/app/schemas/profile.py` (`MechanicProfile*`, `AvailabilityUpdate/Response`) |
| **Availability** | `services/profile.py::MechanicProfileService.{get,set}_availability` → `db/repositories/profile.py::MechanicProfileRepository.update_availability` |
| Routes | `backend/app/api/routes/mechanic_profile.py` (5 routes) |
| RBAC | unchanged — `api/deps.py::get_current_mechanic` |
| Frontend endpoints | `frontend/src/lib/mechanic.ts` (typed wrappers over `api.ts`) |
| Frontend UI | `frontend/src/components/dashboard/MechanicProfilePanel.tsx`, routed from `pages/Dashboard.tsx` when `role === 'MECHANIC'` |

### Endpoints (all require MECHANIC)

| Method | Path | Notes |
|---|---|---|
| GET | `/api/v1/profile/mechanic/` | 404 until created |
| PUT | `/api/v1/profile/mechanic/` | upsert; **does not touch availability** |
| PATCH | `/api/v1/profile/mechanic/location` | existing |
| GET | `/api/v1/profile/mechanic/availability` | `{is_available}` |
| PATCH | `/api/v1/profile/mechanic/availability` | `{is_available: bool}` |

The mechanic is always identified by the bearer token, never by a body field, so there is
no cross-mechanic write path.

### Canonical vehicle types (scope conflict resolved)

`VehicleType` (`models/vehicle.py`) = **BIKE | CAR** is now the single representation
everywhere. The old ad-hoc whitelist `{Bike, Car, EV, Truck, Scooter}` on
`MechanicProfileBase` is gone — it admitted **Truck**, violating RAD §3 (two/four-wheelers
only, no heavy commercial vehicles). `Truck`, `EV`, `Scooter` and lowercase values now
fail with 422.

The database column changed from `ARRAY(String)` to `vehicletype[]` in **migration 0004**,
which also folds legacy values (Scooter→BIKE, EV→CAR, Truck dropped, empty→CAR) before the
type change. There were zero rows at the time, so nothing was actually rewritten.

### Availability design

A boolean `mechanic_profiles.is_available` — **no separate table**. Phase 3 discovery can
filter on it alongside `service_radius_km`, `latitude`/`longitude` without redesign.
`PUT /profile/mechanic/` deliberately omits `is_available`, so saving the profile never
resets a mechanic offline (regression-tested).

### Service radius

`service_radius_km` is validated `> 0` (422 otherwise), persisted, and editable from the
UI. **Nothing reads it yet** — that is Phase 3.

### Tests

- `backend/tests/api/test_mechanic_profile.py` — 35 tests: CRUD, vehicle-type scope,
  radius validation, availability read/write/persistence, RBAC (customer 403, admin 403,
  anonymous 401), cross-mechanic isolation.
- `frontend/src/components/dashboard/MechanicProfilePanel.test.tsx` — 11 tests: loading,
  load-from-backend, toggle, backend-trusted state, save, validation error, 404 handling,
  network failure, "cannot clear all vehicle types".

### Known limitations

- **Customer profile is still mocked** (`ProfileSettings.tsx`) — FR-09 is mechanic-only;
  the customer side is not in this phase.
- Latitude/longitude are typed manually; no map or geolocation picker (Phase 3).
- `is_verified`, `average_rating`, `total_reviews`, `completed_jobs` remain write-never
  defaults — no admin verification UI (back-office scope) and no reviews (Phase 8).
- No working-hours consistency check (start may be after end).
- Repositories still own transactions (§13 #9), unchanged.

### Next phase

**Phase 3 — GPS-Based Mechanic Discovery (FR-02):** query available mechanics within
`service_radius_km`; decide Haversine vs PostGIS before writing the query.

---

## Phase 3 — GPS Mechanic Discovery (COMPLETE)

FR-02 **IMPLEMENTED** (selection only; no booking). **142 tests pass** (102 backend,
40 frontend). Verified in-browser.

### Authorities

| Concern | File |
|---|---|
| Discovery query | `backend/app/db/repositories/profile.py::MechanicProfileRepository.find_nearby` |
| Service | `backend/app/services/profile.py::MechanicProfileService.find_nearby` |
| Route | `backend/app/api/routes/mechanics.py` |
| Response schema | `backend/app/schemas/profile.py::NearbyMechanic` |
| Frontend endpoints + geolocation | `frontend/src/lib/discovery.ts` |
| Frontend UI | `frontend/src/components/dashboard/FindMechanics.tsx` (route `/dashboard/find`) |

No new model, migration, or API client — `mechanic_profiles` already carried
`latitude`/`longitude` (`Numeric(9,6)`, NOT NULL), `service_radius_km` and `is_available`.

### API contract

`GET /api/v1/mechanics/nearby?latitude=&longitude=&vehicle_type=` — **CUSTOMER only**
(mechanic and admin get 403; anonymous 401).

Returns `{mechanics: [...]}` ordered nearest first, each with `id`, `garage_name`,
`specialization`, `city`, `latitude`, `longitude`, `distance_km`,
`supported_vehicle_types`, `is_available`, `service_radius_km`, `experience_years`,
`average_rating`, `total_reviews`. **Withholds** `owner_name`, `address`,
`working_*`, `user_id`, phone — asserted by test.

### Distance approach

**Haversine computed in SQL**, not Euclidean degrees and not in Python — filtering stays
in the database. PostGIS was checked and is **not available** on this Postgres
(`pg_available_extensions` → 0 rows), so the formula uses standard trig with
`least(1.0, …)` clamping the `acos` domain. `EARTH_RADIUS_KM = 6371.0`.

Eligibility, all in one query: `is_available` · `supported_vehicle_types @> [type]` ·
coordinates present · `haversine <= mechanic.service_radius_km` (radius is **per
mechanic**, not a caller parameter).

### Tests

`backend/tests/api/test_discovery.py` (21): inside/outside radius, wide-radius distant
match, unavailable, unsupported type, both-types, boundary (6 km in / 5 km out at 5.56 km),
great-circle vs Euclidean (~111 km per degree), zero distance, ordering, payload shape,
private-field withholding, query validation, empty result, authorization.
`frontend/.../FindMechanics.test.tsx` (8): location success/denied, loading, results with
distance, no-results, API error, selection-without-booking, result clearing.

**"Missing location" is structural, not query-level** — `latitude`/`longitude` are NOT NULL,
so a coordinate-less mechanic cannot be persisted. The test asserts that `IntegrityError`
instead of forcing an impossible row; the `isnot(None)` guard in the query is defensive.

### E2E result — PASS

Seeded 4 mechanics around Ahmedabad (23.0225, 72.5714). Customer logged in, geolocation
stubbed, searched: **CAR → only "E2E Nearby Car+Bike" at 5.56 km**; offline, out-of-range
(111 km / 10 km radius) and bike-only correctly excluded. **BIKE → 2 results**, nearest
first (2.22 km, 5.56 km). Ocean coordinates → empty state. Denied permission → explanatory
error, button re-enabled. Selecting a mechanic issued **no booking call** (network log:
only `/mechanics/nearby`).

### Limitations

- **No map.** The project has no map dependency (`SectionPhoneSequence` had a "Fake Mapbox
  Background" div); results are a distance-sorted list. RAD §4 names Mapbox/OSM — deferred.
- **No spatial index.** Haversine is computed per row, so this is a sequential scan over
  `mechanic_profiles`. Fine at current scale; NFR 6.1's 3 s budget is unmeasured at volume.
  A `cube`/`earthdistance` bounding-box prefilter or PostGIS is the upgrade path.
- Customer location is taken from the browser only — the stored `customer_profiles`
  coordinates are not used as a fallback.
- No pagination beyond `limit=50`; no filtering by rating, specialization or working hours.
- Selection is client-side state only and is lost on reload (booking is Phase 4).

### Next phase

**Phase 4 — Booking + booking state machine (FR-03/FR-05).**

---

## Phase 4 — Booking + Service Request (COMPLETE)

FR-03 and FR-05 **IMPLEMENTED**. **184 tests pass** (127 backend, 57 frontend). Full
customer → mechanic → customer E2E verified in-browser.

### Model — `backend/app/models/booking.py`

`bookings`: `id` · `customer_id` → users · `mechanic_id` → users · `vehicle_id` → vehicles
(RESTRICT) · `problem_description` · `service_latitude/longitude` `Numeric(9,6)` ·
`service_address` (nullable) · `status` · `created_at` / `updated_at`. Migration **0005**.

Both parties are referenced by **user id** (matching how RBAC identifies callers); create
accepts the mechanic's *profile* id because that is what discovery returns, and resolves it
server-side. No User/Vehicle/Profile data is copied into the booking.

### State machine — `backend/app/services/booking_state.py` (single authority)

```
PENDING ──accept──▶ ACCEPTED ──start──▶ IN_PROGRESS ──complete──▶ COMPLETED
   │                    │
   │ reject             │
   ▼                    ▼
REJECTED            CANCELLED  ◀── cancel (customer, PENDING or ACCEPTED only)
```

| Role | Allowed |
|---|---|
| MECHANIC | PENDING→ACCEPTED, PENDING→REJECTED, ACCEPTED→IN_PROGRESS, IN_PROGRESS→COMPLETED |
| CUSTOMER | PENDING→CANCELLED, ACCEPTED→CANCELLED |

Terminal: COMPLETED, CANCELLED, REJECTED. **Clients never send a status** — each transition
is an intent endpoint; the role comes from the token and `assert_transition` raises 409 on
anything else. Nothing outside this module writes `Booking.status`.

### Endpoints — `backend/app/api/routes/bookings.py`

| Method | Path | Who |
|---|---|---|
| POST | `/api/v1/bookings/` | CUSTOMER |
| GET | `/api/v1/bookings/` (`?status=`) | either party, scoped to caller |
| GET | `/api/v1/bookings/{id}` | either party |
| POST | `/api/v1/bookings/{id}/cancel` | CUSTOMER |
| POST | `/api/v1/bookings/{id}/accept\|reject\|start\|complete` | MECHANIC |

### Ownership rules

Create re-validates server-side: mechanic profile exists · mechanic `is_available` ·
vehicle belongs to the caller · vehicle type is in `supported_vehicle_types`. A booking is
visible only to its two parties; **anyone else gets 404, not 403**, so ids are not
confirmed to exist. Vehicle-not-yours is likewise 404. `customer_id` is always taken from
the token.

### Frontend

`lib/booking.ts`, `lib/vehicles.ts` (typed wrappers over `api.ts`) ·
`BookService.tsx` (customer request form; filters the vehicle list to types the mechanic
services) · `MyBookings.tsx` (customer status + cancel) · `MechanicBookings.tsx` (incoming
/ active / history with accept·reject·start·complete) · `BookingStatusBadge.tsx` renders
**only** the backend status. Discovery selection now opens the booking form.
Refresh is manual (button) — REST polling, no WebSockets.

### Tests

`backend/tests/api/test_bookings.py` (25): creation, vehicle/mechanic ownership,
availability, unsupported type, status-injection attempt, visibility, full lifecycle,
reject, cancel before/after accept, every invalid transition, terminal immutability,
cross-mechanic isolation, status filter.
`frontend/src/components/dashboard/Bookings.test.tsx` (17) covers both UIs.

### E2E result — PASS

Seeded a real mechanic + customer + vehicle. Customer: login → find → select → book
(**PENDING**). Mechanic: login → incoming request showing customer, vehicle, problem and
location → **accept → start → complete**. Customer re-login → **COMPLETED**. Also verified
live: customer cancel → CANCELLED, mechanic reject → REJECTED, cancel while IN_PROGRESS →
409, accept a CANCELLED booking → 409, customer calling accept → 403.

### Limitations

- **Manual refresh, no push.** Both sides poll via a Refresh button; the counterpart's
  change is not seen until then. Phase 5.
- No reject/cancel reason field, no scheduled time, no price — booking carries no money
  (Phase 7) and no rating (Phase 8).
- A mechanic can hold unlimited concurrent bookings; no capacity or double-booking rule.
- Availability is checked only at creation; a mechanic going offline afterwards does not
  affect existing bookings.
- Repositories still own transactions (§13 #9) — a booking write is a single commit, so
  this is not yet harmful, but Phase 5+ multi-write flows will need the refactor.

### Next phase

**Phase 5 — Realtime tracking + notifications (FR-04 / FR-12).**

---

## Phase 5 — Realtime Booking Status + Notifications (COMPLETE)

FR-04 (status realtime) and FR-12 (in-app notifications) **IMPLEMENTED**.
**215 tests pass** (143 backend, 72 frontend). Realtime E2E verified in-browser.
Live mechanic *location* tracking is NOT built — see limitations.

### Architecture

```
REST (authoritative writes)          WebSocket (delivery only)
  POST /bookings/{id}/accept  ──▶ commit ──▶ emit_booking_event ──▶ manager
                                                                      │
                                            customer socket ◀─────────┤
                                            mechanic socket ◀─────────┘
                                                     │
                                            client refetches over REST
```

**Database is the source of truth. REST is state recovery. WebSocket is
acceleration only.** No booking state is held solely in frontend memory, and every
event handler triggers a REST refetch rather than mutating from the payload.

### Authorities

| Concern | File |
|---|---|
| Connection manager (single, in-memory) | `backend/app/services/realtime.py` |
| Event contract + emission | `backend/app/services/booking_events.py` |
| WebSocket endpoint | `backend/app/api/routes/ws.py` |
| Frontend socket client | `frontend/src/lib/realtime.ts` |
| React integration + notifications | `frontend/src/hooks/useBookingRealtime.ts` |

### Endpoint and authentication

`WS /api/v1/ws/bookings?token=<access_token>`

Browsers cannot set headers on a WS handshake, so the **access token** goes in the query
string and is validated by the same `decode_token` the REST dependencies use. A refresh
token, an expired/garbage token, or a token for an unknown/inactive user is closed with
**1008** before `accept()`. The user id comes from the `sub` claim; **inbound frames are
ignored entirely**, so a client can never inject an event or claim an identity.

### Events

`BOOKING_CREATED · BOOKING_ACCEPTED · BOOKING_REJECTED · BOOKING_STARTED ·
BOOKING_COMPLETED · BOOKING_CANCELLED`

Payload is deliberately minimal — `{type, booking_id, status}`. No problem text, address,
phone or email crosses the socket; clients refetch for detail. Emission happens **after**
the transaction commits, and a rejected transition (409) raises before emission, so no
success event is ever sent for a failed change. Delivery is best effort: a dead socket is
evicted, never raised, so booking state cannot be corrupted by a delivery failure.

### Authorization

Events go only to `booking.customer_id` and `booking.mechanic_id`. Verified by test that an
uninvolved customer and a rival mechanic receive nothing but their own `CONNECTED` frame,
plus a recipient-capture test asserting the target set is exactly those two ids.

### Reconnect strategy

Exponential backoff, 1 s doubling to a 15 s ceiling, cancelled on unmount/sign-out.
**Every successful connection — first or reconnect — fires `onResync`**, which refetches
bookings over REST. That is what makes a missed event harmless. A `Live`/`Offline`
indicator sits next to the Refresh button, which remains as a manual fallback.
Malformed frames and non-JSON are ignored rather than crashing the UI.

### Notifications

`sonner` (already a dependency, previously unused) renders in-app toasts only:
customer sees accepted/started/completed/cancelled/declined, mechanic sees new request and
customer cancellation. **No email, SMS or push** — deferred.

### Tests

`backend/tests/api/test_realtime.py` (16): token validation (invalid, refresh, unknown
user), connect/disconnect bookkeeping, event per transition, terminal events, no event on a
409, isolation from uninvolved customer/mechanic, recipient targeting, manager eviction of
broken sockets, payload privacy.
The WS handler is driven directly with a fake socket **on the same loop as the httpx
client** — a second event loop (TestClient) cannot share the module-level asyncpg pool.
`frontend/src/lib/realtime.test.ts` (10) + `hooks/useBookingRealtime.test.tsx` (5).

### E2E result — PASS

Customer tab live, counterpart driven through the real API. Booking appeared **PENDING
without refresh**, then ACCEPTED → IN_PROGRESS → COMPLETED, each with its toast, no reload.
**Recovery:** backend killed → UI showed `Offline`; backend restarted and the booking
accepted while the socket was down (that event was lost); on reconnect the UI showed
**ACCEPTED via the REST resync**. Mechanic side: a new request appeared live with the
"New service request" toast.

Note: one browser profile shares `localStorage`, so two roles cannot be signed in
simultaneously in the same browser; the counterpart was driven over the API.

### Known limitations

- **Single-process only.** The manager is in-memory, so with more than one worker a client
  on worker A misses events emitted on worker B. Needs a Redis (or similar) pub/sub
  backplane before horizontal scaling — this is the NFR 6.7 blocker.
- **No message replay.** Events missed while offline are recovered only by the REST
  resync, not redelivered. Acceptable because REST is authoritative.
- No delivery acknowledgements, no heartbeat/ping — a silently half-open socket is
  detected only when a send fails.
- Access token in the query string can appear in proxy/server logs; a short-lived
  ticket-exchange would be better. Mitigated by the 15-minute token lifetime.
- **No live mechanic GPS movement or map** — this phase is booking *status* realtime only.
- Notifications are in-app and ephemeral; nothing is persisted, so a toast missed while on
  another page is gone.

### Next phase

**Phase 6 — AI troubleshooting + diagnostic escalation (FR-06 / FR-07).**

---

## Booking UX correction — vehicle type replaces saved vehicles

Applied after Phase 5, before Phase 6. **221 tests pass** (147 backend, 74 frontend).

### What changed and why

Booking required the customer to own a `Vehicle` row whose type the mechanic serviced,
which dead-ended them with *"None of your vehicles match what this mechanic services…
Add a matching vehicle under My Vehicles first."* Roadside assistance cannot require
pre-registering a vehicle. **Eligibility is now the mechanic's capability, never the
customer's inventory.**

### Authority

**`bookings.vehicle_type`** (canonical `VehicleType`: `BIKE` | `CAR`) is the authority for
what a booking is for. `bookings.vehicle_id` is now **nullable** — an optional link to a
saved vehicle, never a prerequisite. No second vehicle-type enum was introduced.

`POST /api/v1/bookings/` now takes `vehicle_type` instead of `vehicle_id`.
`BookingResponse` always carries `vehicle_type`; `vehicle` is `null` unless the booking
happens to be linked to a saved record.

### Matching rule

availability · `supported_vehicle_types` contains the requested type · service radius.
Enforced server-side in `services/booking.py::create` (409 *"This mechanic does not service
X vehicles"*) and in discovery. The frontend only avoids offering a doomed option; the
backend re-checks every request.

### Vehicle model retained

`Vehicle` is **kept**: it backs the `/api/v1/vehicles` API, `VehicleType` is the shared enum
used by mechanic profiles and discovery, and it is the natural home for future service
history. Only booking's *dependency* on it was removed.

**Migration 0006** adds `vehicle_type` nullable, backfills it from each booking's linked
vehicle, sets NOT NULL, then makes `vehicle_id` nullable with `ON DELETE SET NULL`. Existing
rows were preserved (verified: prior bookings kept their status with `vehicle_type='CAR'`).

### Frontend

- **"My Vehicles" removed from dashboard navigation and routing** for both roles. The
  `VehicleManager`/`VehicleModal` components and the backend API remain, simply unlinked.
- `BookService.tsx` no longer fetches vehicles; it shows a two-wheeler/four-wheeler toggle
  limited to what the mechanic services, pre-selected from the discovery search.
- Customer and mechanic cards show the **vehicle type label**; the mechanic card headline is
  e.g. "Two-wheeler" with no Vehicle record needed.

### Tests

Backend `test_bookings.py` gained: customer with **zero** saved vehicles can book, both
types book, unsupported type still 409, and an explicit test that the old
"your vehicles" wording cannot appear. Frontend gained: type choice not a saved-vehicle
list, `listVehicles` never called, no blocker element, type switching when a mechanic
services both.

### E2E result — PASS

Customer with **0 saved vehicles**: nav has no "My Vehicles"; two-wheeler search offered the
bike garage and **excluded the car-only garage**; booked successfully; four-wheeler search
offered the car garage and **excluded the bike-only garage**; booked successfully. Both
bookings persisted with `vehicle_type` and `vehicle_record=None`. Mechanic dashboard showed
"Two-wheeler" as the request headline.

### Known limitations

- Discovery still asks for the vehicle type before showing mechanics; the booking form
  inherits it. A customer wanting a different type must search again.
- `vehicle_id` is never populated by the new flow — nothing links a booking to a saved
  vehicle any more. Wire it back when service history (Phase 8) needs it.
- `VehicleManager` UI is unreachable from the product; decide later whether to delete it or
  resurface it as an optional convenience.

---

## Instructions for Future Claude Sessions

Before working on a task:

1. Read brain.md.
2. Identify the relevant subsystem.
3. Use the Important Files map (§6).
4. Inspect only the relevant files and direct dependencies.
5. Do not scan the entire repository unless required.
6. Treat actual source code as authoritative over brain.md.
7. Update brain.md after meaningful architectural changes.
8. Do not duplicate existing services/components.
9. Do not guess when the repository can answer the question.

Additional standing cautions for this repo:
- Do not assume booking, AI, payments, maps, notifications, or realtime exist. They do not.
- Do not trust the frontend as evidence of backend behavior — it is entirely mocked and its
  data models disagree with the backend's.
- Product requirements come from *"Wrench – Requirement Analysis Document"* v1.0,
  August 2026 (`~/Downloads/Wrench Requirement Analysis Document.docx`). It is the product
  authority and is **not tracked in this repository** — read it before changing any
  requirement text here. Never edit the RAD to match the code.
- **FR-01 (except OTP), FR-09, FR-02, FR-03, FR-05, FR-12 and FR-04 (status only, no
  GPS tracking) are implemented (Phases 1-5).** The rest remain unbuilt. Do not infer a feature exists from
  frontend marketing copy — `Chapter4.tsx` and `Landing.tsx` describe AI diagnostics,
  nearby-mechanic search, and live tracking, **none of which exist in code**.
- All API paths ARE served under `/api/v1` as of Phase 0. Health: `GET /api/v1/health`.
- Frontend HTTP goes through `frontend/src/lib/api.ts` only. Never add a bare `fetch` to a component.
