# Hotel Booking Platform

API-first hotel booking platform: guest web, staff panel, an AI booking assistant
(chat/voice/phone), and a future mobile app — all clients of **one versioned
NestJS API** (`/api/v1/*`).

- **Spec & plan:** [`Plan/`](Plan/) — requirements, architecture/security, and the
  phased build plan.
- **Live status:** [`Plan/00-progress.md`](Plan/00-progress.md).
- **Agent guidance & invariants:** [`CLAUDE.md`](CLAUDE.md) — read before writing code.

## Repository structure

```
apps/
  web/     Next.js 15 — guest-facing (search, booking, manage booking)
  staff/   Next.js 15 — internal staff panel
  api/     NestJS — the one versioned API (/api/v1/*)
packages/
  shared/  Zod schemas + TS types (dual CJS+ESM) shared by all apps
  config/  shared eslint / tsconfig / prettier
Plan/      requirements, architecture, build plan, progress tracker
```

`packages/shared` is built to **both CJS and ESM** so NestJS (CommonJS) and
Next.js (ESM) resolve it through one `exports` map.

## Prerequisites

- **Node** ≥ 20
- **pnpm** — `npm install -g pnpm`
- **Docker** (for local Postgres + Redis)

## Run locally

```bash
# 1. Install all workspace dependencies
pnpm install

# 2. Build the shared package (apps import its compiled output)
pnpm --filter @hotel/shared build

# 3. Start local Postgres + Redis
docker compose up -d

# 4. Copy env templates (fill in as phases require)
cp apps/api/.env.example   apps/api/.env
cp apps/web/.env.example   apps/web/.env.local
cp apps/staff/.env.example apps/staff/.env.local

# 5. Run apps (separate terminals, or `pnpm dev` for all in parallel)
pnpm --filter @hotel/api dev     # http://localhost:4000/api/v1
pnpm --filter @hotel/web dev     # http://localhost:3000
pnpm --filter @hotel/staff dev   # http://localhost:3001
```

Health check once the API is up: `GET http://localhost:4000/api/v1/health`.

## Workspace scripts

| Command | Effect |
|---|---|
| `pnpm -r build` | build every package/app |
| `pnpm -r typecheck` | `tsc --noEmit` across all |
| `pnpm -r lint` | ESLint across all |
| `pnpm format` | Prettier write |
| `pnpm docker:up` / `pnpm docker:down` | local Postgres + Redis |

## Production images

Each app has a multi-stage `Dockerfile`, built from the **repo root**:

```bash
docker build -f apps/api/Dockerfile   -t hotel-api   .
docker build -f apps/web/Dockerfile   -t hotel-web   .
docker build -f apps/staff/Dockerfile -t hotel-staff .
```

## Build phases

Work proceeds through phases 0–11 (see `Plan/03` and `Plan/00-progress.md`), with a
review-and-commit gate between phases — **do not chain phases blind**. Phase 0
(this scaffold) intentionally contains no business logic.
