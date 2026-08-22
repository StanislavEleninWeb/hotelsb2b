# CLAUDE.md

Guidance for AI agents working in this repository. Read this before writing code.

## What this is

A **hotel booking platform** — guest-facing web, internal staff panel, an AI
booking assistant (chat/voice/phone), and a future React Native app. All clients
talk to **one versioned NestJS API** (`/api/v1/*`). API-first is the core design
principle: no client gets a private backend path.

The full spec lives in `Plan/`:

- [`Plan/01-client-requirements.md`](Plan/01-client-requirements.md) — numbered requirements (IDs like `SD-01`, `BK-07`) with M/S/C priority.
- [`Plan/02-architecture-mobile-security.md`](Plan/02-architecture-mobile-security.md) — architecture, mobile-readiness, and the full security design (OWASP-driven).
- [`Plan/03-ai-build-plan-prompts.md`](Plan/03-ai-build-plan-prompts.md) — the phased build plan (Phase 0–11) and the prompt for each phase.
- [`Plan/00-progress.md`](Plan/00-progress.md) — **the live tracker**: which phase we're on, which requirement IDs each phase satisfies, and the verification gate for each. Update it as work lands.

## How work proceeds — phase gates

Build in the order in `Plan/03`. **Do not chain phases blind.** Each phase must
pass its verification gate in `Plan/00-progress.md` and be reviewed/committed
before the next begins (Plan/03 lines 3 and 261). Phases 0–4 are strictly
sequential. Phases 5, 6, 9 (web, staff, mobile) may parallelize once Phase 4
(auth) is solid.

When you finish a phase: check off its requirement IDs in `Plan/00-progress.md`,
record the verification evidence (command + result), and stop for review.

## Non-negotiable invariants

These are cross-cutting rules from the requirements/architecture that are easy to
violate silently. Hold to them everywhere:

1. **Money is integer minor units, never floats.** Use `amountMinor` (integer) +
   `currency` (ISO code) together — not a bare `priceCents`, because the minor
   exponent varies by currency (JPY=0, KWD=3). See Plan/02 §5.1, PB-06.
2. **No raw string-concatenated SQL, ever.** Prisma / parameterized queries only.
   If a raw query is unavoidable, use typed `$queryRaw` parameters — never
   interpolate user input. (Plan/02 §5.3)
3. **Global validation rejects unknown fields.** NestJS `ValidationPipe` with
   `whitelist: true, forbidNonWhitelisted: true`. Validate server-side always;
   client validation is UX, not security. (Plan/02 §5.1)
4. **Every write goes through the audit log**, tagged with `channel`
   (`web` | `staff` | `ai_chat` | `ai_voice` | `ai_phone`), recording
   actor/action/before/after. Append-only. (Plan/02 §5.10, ST-17, AI-07)
5. **Authorization is object-level, checked server-side on every fetch** — not
   just "is the user logged in," and not just on create. A user must be
   authorized for *that specific* booking/property (BOLA), and role-gated
   endpoints check the role server-side (BFLA). Staff roles are property-scoped.
   (Plan/02 §5.6, ST-16)
6. **The AI assistant calls the same service layer as web/staff** — never a
   parallel code path. It literally cannot break a rule the human-facing app
   enforces because it runs the same validation/availability/audit code.
   (Plan/02 §4, AI-08)
7. **`/api/v1/` versioning and `Idempotency-Key` on write endpoints from day
   one.** Mobile networks retry; without idempotency keys you get duplicate
   bookings. (Plan/02 §2)
8. **No card data touches our servers.** Hosted payment fields / tokenization
   only. Booking is confirmed only after a signature-verified server-to-server
   webhook from the payment processor — never a client-reported "payment
   succeeded." (Plan/02 §5.4, §5.10, PB-05)
9. **Verify HMAC signatures + timestamp/replay window on every inbound webhook**
   (AI provider, payment processor). Reject unsigned/invalid/stale. (Plan/02 §5.4)
10. **`propertyId` on every property-scoped entity from the first migration**,
    even though multi-property (ST-18) is a "Could-have" — property-scoped staff
    access is a Must (§5.6), and retrofitting a scope column later is a migration
    nightmare.
11. **Availability/booking is concurrency-safe.** Two simultaneous bookings for
    the last room: exactly one succeeds (row-level lock or availability ledger).
    (BK-07)
12. **Errors never leak internals.** Central exception filter returns a generic
    message + correlation ID; stack traces and DB errors go only to structured
    logs. (Plan/02 §5.9)

## Repository layout (target)

```
apps/
  web/     Next.js 15 App Router — guest-facing (search, booking, manage)
  staff/   Next.js 15 — internal staff panel (reservations, calendar, check-in)
  api/     NestJS — the one versioned API (/api/v1/*)
  mobile/  Expo / React Native (added in Phase 9)
packages/
  shared/  Zod schemas + TS types — one schema, consumed by web, staff, api, mobile
  config/  shared eslint / tsconfig / prettier
terraform/ IaC (Phase 1) — modules/ + staging/ + prod/
```

`packages/shared` is consumed by both NestJS (CommonJS) and Next.js (ESM). It is
built to **dual CJS+ESM** with an `exports` map so all consumers resolve it
cleanly — do not import its raw `src/` `.ts` files across package boundaries.

## Toolchain

- **pnpm** workspaces (installed globally; Node ships no corepack here).
- **Node** ≥ 20 (dev machine runs 26).
- **Docker** for local Postgres + Redis (`docker compose up`).
- TypeScript **strict** everywhere.

## Common commands

```bash
pnpm install            # install all workspaces
pnpm -r build           # build every package/app
pnpm -r typecheck       # tsc --noEmit across all
pnpm -r lint            # eslint across all
pnpm --filter @hotel/shared build   # build just shared
docker compose up -d    # local Postgres + Redis
pnpm --filter @hotel/api dev        # run the API
pnpm --filter @hotel/web dev        # run the guest web app
pnpm --filter @hotel/staff dev      # run the staff panel
```

## Open scope decisions (block Phase 2 — resolve before schema work)

Tracked in `Plan/00-progress.md`. Do not guess these:

- **Payment provider** (Stripe vs. regional) and required regional method(s) — PB-01.
- **Multi-property from day one?** ST-18 is "Could-have" but §5.6 makes
  property-scoping a Must. Column goes in regardless (invariant #10).
- **Target markets** → languages, currencies, payment methods (SD-06, PB-06).

Once resolved, record them as a `project` memory (they're not derivable from code).
