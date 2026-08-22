# Build Progress Tracker

Live status of the phased build in [`03-ai-build-plan-prompts.md`](03-ai-build-plan-prompts.md).
Each phase lists the requirement IDs from [`01-client-requirements.md`](01-client-requirements.md)
it satisfies and a **verification gate** that makes "done" falsifiable. A phase is
`DONE` only when its gate passes and the diff is reviewed/committed.

**Status legend:** ⬜ not started · 🟡 in progress · ✅ done (gate passed) · ⛔ blocked

---

## Snapshot

| Phase | Title | Status | Gate passed |
|---|---|---|---|
| 0 | Monorepo scaffold | 🟡 gate GREEN | pending review/commit |
| 1 | Terraform base infra | 🟡 gate GREEN | pending review/commit |
| 2 | Database schema (Prisma) | 🟡 gate GREEN | pending review/commit |
| 3 | NestJS booking API core | 🟡 gate GREEN (PR open) | on feat/phase-3-booking-api |
| 4 | Auth & access control | ⬜ | — |
| 5 | Public web app | ⬜ | — |
| 6 | Internal staff panel | ⬜ | — |
| 7 | Search & caching layer | ⬜ | — |
| 8 | AI assistant integration | ⬜ | — |
| 9 | Mobile app (Expo) | ⬜ | — |
| 10 | CI/CD pipeline | ⬜ | — |
| 11 | Security hardening pass | ⬜ | — |

---

## Open scope decisions (block Phase 2)

Per Plan/01 line 139 — resolve before schema work; do not guess.

- [x] **Payment provider:** **Stripe** (hosted fields + webhooks, no card data on our servers) — `PB-01`, `PB-02`, `PB-05`. _(confirmed 2026-08-22)_
- [x] **Multi-property day one:** **Yes** — full multi-property management in v1;
      `ST-18` promoted to in-scope; `propertyId` on every scoped entity. _(confirmed 2026-08-22)_
- [ ] **Target markets** → supported languages / currencies — `SD-06`, `PB-06`. _(still open — needed for Phase 2 currency/locale seed data)_
- [ ] **v1 scope cut:** confirm which `S`/`C` requirements are deferred.

**Process:** phase-by-phase with a review gate between phases. Scaffold left
**uncommitted** at the user's request (no initial commit yet).

---

## Phase 0 — Monorepo Scaffold  🟡

**Goal:** base repo structure, tooling, shared types package. No business logic.

**Satisfies (foundational — enables, not user-facing):** `NF-02` (mobile-ready
shared API/types), `NF-03` (strict TS + lint baseline for later security work).

**Gate — all must pass:**

- [x] `pnpm install` succeeds at root. — 6 workspace projects, build scripts approved.
- [x] `pnpm -r typecheck` clean. — shared, api, web, staff all "Done".
- [x] `pnpm -r lint` clean. — 0 errors, 0 warnings across all.
- [x] `pnpm --filter @hotel/shared build` emits CJS + ESM + `.d.ts`. — `index.cjs`, `index.js`, `index.d.ts`/`index.d.cts` in `dist/`.
- [x] A trivial Zod schema in `@hotel/shared` imports cleanly from **api, web, and staff**. — typechecks in all three; api returns a schema-`.parse()`d response at runtime; both Next apps build with it.
- [x] `docker compose up -d` brings up Postgres + Redis; both healthy. — compose config valid; both containers `healthy` (Postgres `pg_isready`, Redis `PONG`).
- [x] Each app's dev server boots. — api boots on `/api/v1` and serves `GET /api/v1/health`; web + staff produce Next standalone `server.js` and build clean.
- [x] Each app has a Dockerfile + `.env.example`; root README explains local run.

**Verification evidence (2026-08-22):**
- `pnpm -r typecheck` → all 4 projects Done.
- `pnpm -r lint` → all Done, 0 problems.
- `curl localhost:4000/api/v1/health` → `{"status":"ok","service":"api","timestamp":"2026-08-22T09:48:29.390Z"}` (passed shared Zod `.parse()` at runtime).
- `next build` (web + staff) → compiled, static pages generated, standalone output.
- Docker: Postgres 16 + Redis 7 containers healthy.

**Known scaffold gaps (deferred, non-blocking):** Next's ESLint plugin isn't wired
into the shared flat config (lint runs via `pnpm -r lint`; `next build` prints a
cosmetic "plugin not detected" notice). `pnpm-lock.yaml` should be committed with
this phase.

---

## Phase 1 — Terraform Base Infrastructure  🟡 gate GREEN

**Satisfies (infra enabling):** `NF-01` (spike resilience — ECS/ALB/autoscale),
`NF-03`/`NF-06`, security §5.7 (`tfsec`/`checkov` clean, no public buckets).

**Gate:**

- [x] 7 reusable modules under `modules/` (network, security, compute, database, cache, storage, cdn).
- [x] `staging/` wires them (single-AZ, single NAT, small instances); `terraform validate` → **valid**.
- [x] `prod/` scaffolded with SAME modules (Multi-AZ RDS, HA Redis, per-AZ NAT, larger instances); validates; **not applied** (stub).
- [x] `bootstrap/` remote-state (S3 + DynamoDB lock) validates.
- [x] `tfsec terraform` → **0 critical/high/medium/low** (173 passed, 32 justified inline ignores).
- [x] Only `0.0.0.0/0` ingress is 443/80 on the ALB SG; all S3 buckets private (public access blocked) + encrypted; RDS/Redis encrypted at rest + Redis in transit.
- [x] `terraform fmt -recursive` clean.
- [ ] `terraform plan` against real AWS — **deferred**: needs account creds + `bootstrap` applied. Not runnable in this environment.

**Verification evidence (2026-08-22):**
- `terraform validate` → "Success! The configuration is valid." for staging, prod, bootstrap.
- `tfsec terraform` → "No problems detected!" (173 passed, 32 ignored, 0 findings).
- 34 `.tf` files; WAF (managed SQLi/common + rate-based) in us-east-1; CloudFront OAC to private S3; VPC flow logs on.

**Note:** `checkov` not installed on this machine; `tfsec` used as the scanner
(Phase 10 CI wires both). Real `terraform plan`/`apply` pending AWS credentials.

---

## Phase 2 — Database Schema (Prisma)  🟡 gate GREEN

**Provides the data model that later phases build on** (schema only — behavior is
Phases 3+). Data model present for: `SD-01..04` (search/filter/detail — property,
roomType, amenity, rateplan, review), `BK-01..08` (booking, multi-room, occupants,
add-ons, promo, payment types), `MG-01..04` (confirmation-code lookup, status,
cancel), `ST-01..05`/`ST-08..13`/`ST-16..17` (staff bookings, room block/assign,
housekeeping status, rate plans, RBAC, **append-only audit**), `PB-01..05`
(Stripe payment refs, refunds, no card data), `NT-01..04` (notifications + opt-in),
`AD-01..03` (CMS content, users/roles, rate calendar).

**Explicitly NOT covered by this schema (deferred — see MIGRATION-PLAN.md):**
`AI-03`/auth tokens & OTP (Phase 4), `ST-06`/`MG-07` check-in record + ID-doc,
`ST-14` waitlist/overbooking, `AI-07` call transcripts (Phase 8), `ST-19` OTA sync,
`AD-04`/`SD-06` full i18n. The tracker no longer claims these.

**Gate — all pass:**

- [x] `prisma validate` → schema valid; `prisma format` clean.
- [x] 27 tables, 46 FKs; **every** relation two-sided (fixed 4 dangling UUID columns).
- [x] Money = integer minor units (`amountMinor`/`*Minor`) + ISO `currency`; **no floats**; `VarChar(3)` (not blank-padded `Char`).
- [x] Status enums for room/booking/payment/refund/notification/review.
- [x] Indexes: `Booking(confirmationCode)` unique; `Booking(propertyId, checkIn, checkOut)` (staff calendar + availability); `BookingRoom(roomId, checkIn, checkOut)` (concurrency); `RoomType`/`RatePlan` by property.
- [x] `propertyId` on every scoped entity — **with FK** (Payment/Notification/BookingRoom scope columns wired, not raw UUIDs).
- [x] CHECK constraints in the migration: `rating ∈ [1,5]`, non-negative money, `checkOut > checkIn` — **verified** (DB rejected rating=9).
- [x] Migration created, **applied to Postgres** end-to-end; Prisma Client generated and **resolves from the NestJS (CJS) app**.
- [x] `MIGRATION-PLAN.md` lists v1 vs deferred + the 6 app-layer invariants the schema can't enforce (guest identity, single-currency, denorm sync, promo concurrency).

**Verification evidence (2026-08-22):**
- `prisma validate` → "The schema at prisma/schema.prisma is valid".
- `prisma migrate dev` → migration `*_init` applied; "database is now in sync".
- Postgres: 27 base tables, 11 custom CHECK constraints; `INSERT rating=9` → rejected by `Review_rating_range`.
- `require('@prisma/client')` from `apps/api` → PrismaClient + `Prisma.ModelName.Booking/AuditLog` resolve.
- `pnpm -r typecheck` / `pnpm -r lint` → clean.

**Reviewed by advisor:** fixed 4 blocking model defects (non-unique guest email,
dangling `bookingRoomId`, unrelated `Payment`/`Notification.propertyId`), plus
Char→VarChar, day-of-week bitmask moved to `@hotel/shared`, and rating/money CHECKs.

---

## Phase 3 — NestJS Booking API Core  🟡 gate GREEN  _(branch: feat/phase-3-booking-api)_

**Satisfies:** `SD-01`/`SD-04` (availability search + pricing), `BK-01` (multi-room),
`BK-07` (concurrency-safe), `MG-01`/`MG-02`/`MG-04` (lookup, view, cancel),
`ST-01..05`/`ST-08..09` (staff CRUD for properties/rooms/rate plans),
`AI-08` (AI channel uses the same service path), `NF-03`.

**Gate — all pass:**

- [x] Global `ValidationPipe {whitelist, forbidNonWhitelisted, transform}` — verified: bad UUID → 400.
- [x] `Idempotency-Key` on booking create — verified end-to-end: same key → same booking id, 1 row in DB.
- [x] Booking state machine with guarded transitions — unit-tested (legal + illegal moves).
- [x] `AuditLogInterceptor` on every write — verified: create logs `action=create`, `channel=AI_CHAT`, after-state + correlationId.
- [x] Redis-backed throttler, **tighter for unauth** — verified: `/availability` `x-ratelimit-limit: 20` vs default `100`; `/bookings/lookup` = 5.
- [x] **Concurrency (BK-07)** — 2 simultaneous bookings for the last room → exactly one succeeds, other gets `ConflictException`; DB holds 1 booking. `FOR UPDATE ... SKIP LOCKED`. Jest test passes.
- [x] Global exception filter — generic message + correlationId to client; stack traces only to pino logs.
- [x] Properties/Rooms/RatePlans CRUD with role guards — public reads open; staff writes **fail closed** (403 without auth, verified). Function-level authz via `@Roles` + `RolesGuard` (Phase 4 supplies the JWT that populates `req.user`).

**Verification evidence (2026-08-22):**
- `pnpm --filter @hotel/api test` → 2 suites, 5 tests pass (concurrency ×2, state machine ×3).
- API boots with Prisma + Redis + throttler + pino; `curl` smoke tests: health 200, validation 400, auth 403, rate-limit headers per-endpoint.
- Idempotency + audit verified against live Postgres/Redis via throwaway scripts.
- `pnpm -r typecheck` / `pnpm -r lint` clean.

**Deferred to later phases (by design):** payment capture / booking confirmation
webhook (Stripe — Phase 5/8), booking modify/reschedule `MG-03` (S), and the JWT
auth that populates `req.user` for the role guards (**Phase 4**). Guards fail
closed until then.

---

## Phase 4 — Auth & Access Control  ⬜

**Satisfies:** `BK-02`, `MG-01`, `AI-03`, `ST-16`, `AD-02`, `NF-03`, §5.6.

**Gate:** JWT access+refresh (rotated, hashed) for cookie web + bearer mobile;
guest passwordless + password; staff RBAC roles; `RolesGuard` (BFLA) +
`PropertyScopeGuard` (BOLA) on every scoped endpoint; identity-OTP flow for
booking changes; CSRF on cookie routes; **integration test: Property-A front-desk
user gets 403 on a Property-B booking with a valid token.**

---

## Phase 5 — Public Web App  ⬜

**Satisfies:** `SD-01..08`, `BK-01..08`, `MG-01..06`, `NF-02`, `NF-05`, §5.2.

**Gate:** SSR search + property pages (SEO/ISR); booking flow with hosted payment
fields (provider stubbed behind interface); account + cancel-with-policy; CSP +
security headers in middleware; TanStack Query against API using shared Zod;
all guest text sanitized before render (no raw `dangerouslySetInnerHTML`).

---

## Phase 6 — Internal Staff Panel  ⬜

**Satisfies:** `ST-01..17`, `RP-*` entry points, §5.6.

**Gate:** calendar/grid; booking create/modify on behalf; check-in/out + ID;
room block/assign + housekeeping board; rate-plan UI; guest profile (role-scoped);
RBAC/scope mirrors API (hide + server-enforced); audit entry surfaced per mutation.

---

## Phase 7 — Search & Caching Layer  ⬜

**Satisfies:** `SD-01..02`, `NF-01`, `NF-06`, `NT-01..03` (async fan-out), §5.5.

**Gate:** Redis availability/search cache keyed by request hash, invalidated on
inventory-affecting writes; tighter rate bucket for AI tool endpoints; Postgres
FTS behind a swappable `SearchService`; BullMQ queue for emails/notifications/
invoices; k6/artillery spike test with documented p95 + autoscale behavior.

---

## Phase 8 — AI Assistant Integration  ⬜

**Satisfies:** `BK-09..12`, `MG-08`, `AI-01..08`, §4, §5.4.

**Gate:** `/api/v1/ai/*` narrow op set; HMAC signature + replay-window verified;
tool JSON Schemas match web/staff DTOs; identity-OTP issuance; audit tagged
`ai_*`; tests: bad-signature rejected, no-OTP modification rejected, valid signed
OTP request succeeds + audits.

---

## Phase 9 — Mobile App (Expo)  ⬜

**Satisfies:** `NF-02`, guest flows `SD/BK/MG` on mobile, push `NT-01..03`.

**Gate:** Expo app reuses `packages/shared`; search/detail/booking/account;
bearer JWT in SecureStore with refresh rotation; SNS push for
`booking.confirmed|cancelled|checkin.reminder`; **no backend changes required
beyond SNS platform apps.**

---

## Phase 10 — CI/CD Pipeline  ⬜

**Satisfies:** `NF-03` (scan gates), supply-chain §5.8, `NF-06`.

**Gate:** PR workflow: lint + typecheck + unit tests + tfsec/checkov + dep scan,
failing on high/critical; merge→main builds+pushes images to ECR (sha tag) +
deploys staging ECS + waits for stable; manual promote-to-prod retags tested
artifact (no rebuild); terraform plan on PR, apply gated on approval.

---

## Phase 11 — Security Hardening Pass  ⬜

**Satisfies:** all of §5; `NF-03`, `NF-04`.

**Gate:** the 10-point findings checklist in Plan/03 Phase 11 produced as a
pass/fail markdown report with remediation applied. Re-run before every major
release, not just once.
