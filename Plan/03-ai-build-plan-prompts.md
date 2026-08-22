# Hotel Booking Platform — AI Build Plan & Prompts

How to use this document: work through the phases in order. Paste each phase's prompt into your AI coding agent (Claude Code or equivalent) in a fresh or continued session as noted. Review and commit the output before moving to the next phase — don't chain them blind. Each prompt assumes the agent has read `01-client-requirements.md` and `02-architecture-mobile-security.md` — attach or reference both at the start of the session.

---

## Phase 0 — Monorepo Scaffold

**Goal:** Base repo structure, tooling, shared types package.

**Prompt:**
```
Set up a pnpm monorepo for a hotel booking platform with this structure:

apps/
  web/        - Next.js 15 (App Router, TypeScript)
  staff/      - Next.js 15 internal staff panel (TypeScript)
  api/        - NestJS (TypeScript)
packages/
  shared/     - shared Zod schemas + TypeScript types used by web, staff, and api
  config/     - shared eslint/tsconfig/prettier config

Requirements:
- pnpm workspaces, root package.json with workspace scripts (dev, build, lint, typecheck run across all apps)
- TypeScript strict mode everywhere
- ESLint + Prettier shared config in packages/config
- Each app has its own Dockerfile (multi-stage build, production image minimal)
- .env.example files per app listing required env vars (no real secrets)
- A root README explaining the structure and how to run everything locally with docker-compose (Postgres + Redis containers for local dev)

Do not add business logic yet — this is scaffolding only.
```

---

## Phase 1 — Terraform Base Infrastructure

**Goal:** VPC, networking, ECS cluster skeleton, RDS, Redis — staging environment first.

**Prompt:**
```
Write Terraform modules for the staging environment of a hotel booking platform on AWS, following this architecture:
- VPC with public + private subnets across 2 AZs
- ECS Fargate cluster
- ALB in public subnets, targets in private subnets
- RDS PostgreSQL (single-AZ for staging, parameterize for Multi-AZ toggle for prod)
- ElastiCache Redis (single node for staging)
- S3 bucket for uploads/assets with encryption enabled and public access blocked
- Secrets Manager entries for DB credentials, Redis auth, and placeholders for third-party API keys (ElevenLabs, Telnyx/Twilio, payment processor)
- CloudFront distribution in front of the ALB and the S3 asset bucket
- Route 53 records (parameterized domain)
- AWS WAF web ACL attached to CloudFront with AWS managed rule sets for SQLi and common attacks, plus a rate-based rule
- Remote state in S3 with a DynamoDB lock table

Structure as reusable modules (network, database, cache, compute, cdn, security) under a modules/ directory, with a staging/ environment directory that wires them together via variables. Include a prod/ environment directory stubbed with the same modules but Multi-AZ RDS and higher instance sizes as variables (do not apply, just scaffold).

Output variable definitions and a terraform.tfvars.example per environment. Add tfsec-friendly defaults (encryption on by default, no 0.0.0.0/0 ingress except 443/80 on the ALB security group).
```

---

## Phase 2 — Database Schema

**Goal:** Prisma schema covering the full domain from the requirements doc.

**Prompt:**
```
Using the requirements in 01-client-requirements.md, design a Prisma schema (packages/shared or apps/api/prisma) for a hotel booking platform covering:
- Property, RoomType, Room (individual physical rooms, status: clean/dirty/inspected/out_of_service)
- RatePlan (per room type, refundable/non-refundable, price rules, min stay)
- Booking, BookingRoom (supports multi-room bookings), Guest (primary + additional occupants)
- User (staff), Role, Permission (or a role enum with a permission-check helper), property-scoped access
- Payment (references to processor transaction, never raw card data), Refund
- AuditLog (append-only: entity type, entity id, actor, action, before/after diff, channel [web/staff/ai], timestamp)
- Notification (type, channel, status, related booking)
- Promotion/discount code

Use integer minor-unit fields for all money (e.g. priceCents), proper enums for statuses (booking status, payment status, room status), and appropriate indexes for the access patterns in the requirements doc (search by property+dates, lookup booking by confirmation code, staff calendar view by property+date range).

After the schema, write a short migration plan: what the first migration includes vs. what's deferred (e.g. multi-property support, channel manager fields) per the M/S/C priorities in the requirements doc.
```

---

## Phase 3 — NestJS Booking API Core

**Goal:** Core booking domain module with validation and concurrency-safe availability.

**Prompt:**
```
In apps/api (NestJS), implement the core booking module:
- PropertiesModule, RoomsModule, RatePlansModule: CRUD with role-based guards (staff only for writes, public read for published data)
- AvailabilityService: given propertyId, dates, guest count, room type — returns available rooms and price, using a concurrency-safe check (e.g. row-level locking or an availability ledger) so two simultaneous bookings cannot double-book the same room
- BookingsModule: create/read/update/cancel, with:
  - DTOs using class-validator, whitelist: true, forbidNonWhitelisted: true on the global ValidationPipe
  - Idempotency-Key header support on booking creation (store recent idempotency keys with result, return cached result on retry)
  - Booking state machine (pending_payment -> confirmed -> checked_in -> checked_out / cancelled / no_show) with guarded transitions
  - Every write goes through an AuditLogInterceptor that records actor, channel, before/after state
- Global exception filter: generic error responses with a correlation ID, full detail only to server logs (winston or pino, structured JSON logs for CloudWatch)
- Global rate limiting via @nestjs/throttler backed by Redis, with stricter limits configured for unauthenticated endpoints (search/availability) than authenticated ones

Write unit tests for the availability concurrency logic specifically — simulate two simultaneous booking attempts for the last available room and assert only one succeeds.
```

---

## Phase 4 — Auth & Access Control

**Goal:** JWT auth (web + mobile-ready), RBAC, property scoping.

**Prompt:**
```
Implement authentication and authorization in apps/api:
- JWT access token (short-lived, ~15 min) + refresh token (longer-lived, rotated on use, stored hashed) flow, usable by both cookie-based web sessions (httpOnly, SameSite=Strict) and bearer-token mobile/API clients
- Guest auth: passwordless option (magic link or OTP via email) plus standard email/password
- Staff auth: email/password with role assignment (front_desk, manager, finance, housekeeping, admin), property-scoped access stored on the user record
- Guards: 
  - RolesGuard checking function-level authorization (which roles can call which endpoints)
  - PropertyScopeGuard checking object-level authorization (can this user act on this specific property/booking) — apply to every booking and property-scoped endpoint, not just list endpoints
- OTP verification flow specifically for identity confirmation on phone/AI-assistant-driven booking changes (separate from login OTP) — short-lived code, rate-limited attempts, tied to a specific booking ID
- CSRF protection for cookie-based routes
- Write integration tests proving a front-desk user scoped to Property A gets 403 when requesting a booking belonging to Property B, even with a valid, correctly-signed token.
```

---

## Phase 5 — Public Web App (Next.js)

**Goal:** Guest-facing search, booking, and manage-booking flows.

**Prompt:**
```
In apps/web (Next.js App Router), build the guest-facing flows from 01-client-requirements.md sections 1-3:
- Search page (SSR for SEO): destination/date/guest search, filters, results grid, ISR revalidation for property listing pages
- Property detail page (SSR, ISR)
- Booking flow: room/rate selection -> guest details -> add-ons -> payment (hosted payment fields from the processor, never handle raw card input in your own form) -> confirmation
- Guest account: login, view bookings, modify/cancel booking with policy display before confirming cancellation
- Set CSP, X-Frame-Options, and other security headers in middleware.ts
- Use TanStack Query for client-side data fetching/caching against the NestJS API, with the shared Zod schemas from packages/shared for form validation matching the API's DTOs exactly
- Ensure all rendering of any user-generated or guest-provided text (special requests, review content if shown) is passed through the shared sanitize utility before render — never use dangerouslySetInnerHTML directly with unsanitized input

Do not implement payment provider integration logic yet — stub it behind an interface so the provider can be swapped in Phase 8.
```

---

## Phase 6 — Internal Staff Panel

**Goal:** Reservation management, calendar, check-in/out, housekeeping.

**Prompt:**
```
In apps/staff (Next.js), build the internal tools from 01-client-requirements.md section 4:
- Calendar/grid view of bookings and availability per property, per room
- Booking creation/modification on behalf of a guest
- Check-in/check-out flow with ID verification step
- Room blocking, room assignment, housekeeping status board
- Rate plan and pricing management UI
- Guest profile view (history, notes, preferences) scoped to what the logged-in role is permitted to see
- All screens enforce the same RBAC/property-scope as the API — hide actions the role can't perform, but never rely on hiding alone (the API already blocks it; UI hiding is just UX)
- Every action that mutates a booking shows the resulting audit log entry (or a link to view it) so staff can see their own changes are tracked

Reuse UI primitives from a shared component set if practical rather than duplicating the guest-facing design system.
```

---

## Phase 7 — Search & Caching Layer

**Goal:** Redis caching, OpenSearch (or deferred Postgres FTS), spike resilience.

**Prompt:**
```
Implement the caching layer described in 02-architecture-mobile-security.md:
- Redis cache for availability/search results, keyed by a hash of (propertyId/region, dates, guest count, filters), short TTL (60-300s), with active invalidation on any booking write that affects that inventory
- Redis-backed rate limiting already scaffolded in Phase 3 — extend with a distinct, tighter bucket for the AI assistant's tool-invocation endpoints specifically
- Search: start with Postgres full-text search (pg_trgm/tsvector) behind a SearchService interface; write it so swapping the implementation for OpenSearch later is a new class behind the same interface, not a rewrite
- Add a BullMQ (Redis-backed) queue for async work: confirmation emails, notification fan-out, invoice generation — booking creation should enqueue these and return fast, not block on them
- Load-test the availability endpoint and booking creation endpoint (k6 or artillery script included) simulating a spike, and document the observed p95 latency and the ECS auto-scaling behavior triggered
```

---

## Phase 8 — AI Assistant Integration

**Goal:** ElevenLabs agent wired to the booking API via signed webhooks, phone via SIP.

**Prompt:**
```
Implement the AI assistant integration boundary from 02-architecture-mobile-security.md section 4:
- A dedicated NestApi module under /api/v1/ai/* exposing only the operations the assistant needs: check availability, create booking, look up booking (requires OTP verification token), modify/cancel booking (requires OTP verification token)
- Verify HMAC signatures on every inbound webhook call from ElevenLabs; reject unsigned or invalid-signature requests; reject requests with a timestamp outside a small tolerance window (replay protection)
- Define the tool schema (JSON Schema) for each of these operations in the format ElevenLabs Conversational AI expects, matching the same DTOs used by the web/staff API so validation is identical everywhere
- Implement the OTP-issuance endpoint: given a booking lookup, send a one-time code to the phone/email on file, short expiry, limited attempts
- Log every AI-initiated action through the same AuditLogInterceptor as web/staff, tagged with channel = 'ai_voice' | 'ai_chat' | 'ai_phone'
- Document (in a README in this module) how the phone number is provisioned via Telnyx/Twilio SIP trunk to the ElevenLabs agent, referencing the existing pattern from the prior clinic receptionist build for SIP + webhook wiring
- Add integration tests: a webhook with an invalid signature is rejected; a booking-modification attempt without a valid OTP token is rejected; a valid, signed, OTP-verified request succeeds and produces an audit log entry
```

---

## Phase 9 — Mobile App (React Native / Expo)

**Goal:** Guest-facing mobile app reusing the existing API and shared schemas.

**Prompt:**
```
Scaffold apps/mobile as an Expo (React Native, TypeScript) app in the monorepo:
- Reuse packages/shared Zod schemas and types for all forms and API responses
- Implement: search, property detail, booking flow (hosted payment fields via the provider's mobile SDK, not a custom card form), account, view/manage booking
- Auth: bearer JWT stored in secure storage (Expo SecureStore / Keychain / Keystore), refresh token rotation matching the web app's token flow from Phase 4
- Push notifications: register device token with SNS platform endpoint on login; handle booking.confirmed, booking.cancelled, checkin.reminder push events (these should already be published as SNS events from Phase 7's notification queue — subscribe the mobile push handler to those same topics rather than building new backend events)
- Respect the same CSP-equivalent discipline for any WebView usage (e.g. if a payment SDK requires a WebView)

Confirm no backend changes were required beyond adding SNS platform applications for FCM/APNs — the app should be a pure new client of the existing /api/v1 API.
```

---

## Phase 10 — CI/CD Pipeline

**Goal:** GitHub Actions, security scanning gates, deploy to ECS.

**Prompt:**
```
Write GitHub Actions workflows for this monorepo:
- On PR: lint, typecheck, unit tests for all apps, tfsec/checkov scan on the terraform/ directory, Dependabot/Snyk-style dependency vulnerability check — fail the build on high/critical findings
- On merge to main: build Docker images for apps/api, apps/web, apps/staff, push to ECR with a commit-sha tag, then update the corresponding ECS service (staging environment) via `aws ecs update-service --force-new-deployment` or an equivalent deploy action, and wait for the deployment to stabilize before marking the workflow successful
- A manually-triggered promote-to-prod workflow that retags the already-built, already-tested staging image and deploys it to the prod ECS services (no rebuild — promote the exact artifact that was tested)
- Terraform plan runs automatically on PRs touching terraform/, terraform apply requires manual approval
- Secrets (AWS credentials, etc.) referenced via GitHub Actions secrets, never hardcoded
```

---

## Phase 11 — Security Hardening Pass

**Goal:** Final review against the security section before go-live.

**Prompt:**
```
Do a security review pass across the whole codebase against 02-architecture-mobile-security.md section 5. For each of these, report what's implemented, what's missing, and fix what's missing:
1. Every endpoint has server-side authorization checked against the specific resource (BOLA/BFLA) — list any endpoint missing an object-level or function-level check
2. No raw SQL string concatenation anywhere in the codebase (grep for template-literal SQL)
3. CSP, X-Frame-Options, X-Content-Type-Options headers present on all web/staff responses
4. All webhook endpoints (AI assistant, payment processor) verify signatures and reject replays
5. Rate limiting configured and tested on: auth endpoints, search/availability, AI assistant tool endpoints
6. No secrets in the repository (scan git history too, not just current files)
7. All money fields are integers in minor units, no floats
8. Global exception filter confirmed to never leak stack traces or DB errors to API responses
9. Dependency scan clean of high/critical vulnerabilities
10. Terraform scan (tfsec/checkov) clean, no public S3 buckets, no unencrypted storage

Produce a findings report as a markdown checklist with pass/fail per item and remediation for any failures, then apply the fixes.
```

---

## Notes on running this plan

- Phases 0-4 are sequential and foundational — don't parallelize them.
- Phases 5, 6, 9 (web, staff, mobile) can be worked in parallel once Phase 4 (auth) is done, since they're independent clients of the same API.
- Phase 8 (AI assistant) depends on Phases 3-4 being solid — the booking/availability logic and auth need to be correct before wiring an autonomous agent to them.
- Run Phase 11 again before any major release, not just once before initial go-live.
