# Hotel Booking Platform — Architecture (Web + Mobile-Ready + Security)

Builds on the requirements in `01-client-requirements.md`. This version extends the earlier architecture to be mobile-app-ready from day one (even though the native app ships in a later phase) and adds a full security design.

---

## 1. Design Principle: API-First

Everything — public web, internal staff panel, future mobile app, and the AI assistant — talks to **one versioned API** (`/api/v1/...`) in NestJS. No client gets a private backend path. This is what makes adding a mobile app later cheap: it's a new client of an API that already exists, not a new backend.

```
                              ┌────────────────────┐
                              │   Route 53 + WAF     │
                              └──────────┬───────────┘
                                          │
                              ┌───────────▼───────────┐
                              │      CloudFront        │
                              └─────┬────────────┬─────┘
                                    │            │
                       ┌────────────▼───┐   ┌────▼─────────────┐
                       │  Next.js (web)  │   │  ALB → NestJS API │
                       │  ECS Fargate    │   │  ECS Fargate      │
                       └─────────────────┘   │  /api/v1/*        │
                                              └──┬─────┬─────┬───┘
                                                 │     │     │
                     ┌───────────────────────────┘     │     └────────────────┐
                     │                                 │                      │
           ┌─────────▼─────────┐             ┌─────────▼────────┐   ┌─────────▼─────────┐
           │  RDS Postgres      │             │  ElastiCache Redis │   │  OpenSearch        │
           │  (Multi-AZ)        │             │  cache/queue/limits│   │  (search index)    │
           └────────────────────┘             └────────────────────┘   └────────────────────┘

  Additional clients of the same API:
  ┌────────────────────┐        ┌──────────────────────────────┐
  │ React Native mobile │───────▶│ same ALB /api/v1/*, JWT auth │
  │ (iOS/Android)       │        └──────────────────────────────┘
  └────────────────────┘
  ┌────────────────────┐        ┌──────────────────────────────┐
  │ ElevenLabs AI agent │───────▶│ signed webhook → /api/v1/ai/* │
  │ (chat/voice/phone)  │        └──────────────────────────────┘
  └────────────────────┘

  Push notifications: SNS Mobile Push → FCM (Android) / APNs (iOS)
```

---

## 2. Mobile App Readiness

Recommendation: **React Native (Expo)** for the eventual mobile app. Reasoning:
- Shares TypeScript types and Zod validation schemas with the web app and API if you structure the monorepo with a `packages/shared` package — one schema, three consumers (web, api, mobile).
- Your team is React/TypeScript already; no new language, no new mental model.
- Expo gets you push notifications, camera (for ID upload at check-in), and app store builds without native Xcode/Android Studio babysitting as a solo operator.

**What to build now so mobile is cheap later (do this in v1, costs almost nothing extra):**
1. **Auth**: use JWT access + refresh tokens issued by the API, not server-side sessions tied to cookies. Web can still use httpOnly cookies for the SSR session (safer against XSS token theft), but the underlying API auth mechanism is the same token-based flow mobile will use — don't build two auth systems.
2. **API versioning from day one** (`/api/v1/`) — mobile apps can't force-update instantly; you'll need to support an older API version while a new one rolls out.
3. **Push-notification-friendly events**: when you build the notification service (SQS-driven), design it to publish to SNS topics per event type (`booking.confirmed`, `booking.cancelled`, `checkin.reminder`) — email/SMS consume it now, mobile push consumes the same event later without backend changes.
4. **Idempotency keys on write endpoints** (especially booking creation/payment) — mobile networks drop and retry; without idempotency keys you'll get duplicate bookings.
5. **Image assets served via CloudFront with responsive variants** — same S3/CloudFront setup serves web and mobile, just request different sizes.

**When you actually build the app:** add an API Gateway... no — keep hitting the same ALB/NestJS API (no separate Gateway needed at this scale), add an Expo/React Native project to the monorepo, add SNS platform applications for FCM/APNs, and you're mobile without touching the backend architecture.

---

## 3. Data Architecture (unchanged core, noted for completeness)

- **PostgreSQL (RDS, Multi-AZ)** — source of truth for properties, rooms, inventory, rate plans, bookings, users, payments references.
- **Redis (ElastiCache)** — search-result cache, availability cache, session/rate-limit counters, BullMQ queue backing store.
- **OpenSearch** — property/room search once catalog size and filter complexity outgrow Postgres full-text search.
- **S3** — images, generated invoices/ICS files, call transcripts/recordings (if retained).

---

## 4. AI Assistant Integration Boundary

The ElevenLabs agent (voice/phone) and any chat UI never touch the database directly. They call a dedicated, narrow set of authenticated webhook endpoints (`/api/v1/ai/*`) that wrap the same booking service used by the web and staff apps — same validation, same availability engine, same audit log. This is deliberate: it means the AI assistant literally cannot violate a business rule the human-facing app enforces, because it's calling the same code path.

---

## 5. Security Architecture

Grounded in the current OWASP Top 10 (2025 edition) — notably **Broken Access Control** remains #1, **Security Misconfiguration** moved up to #2, and **Software Supply Chain Failures** and **Mishandling of Exceptional Conditions** are new categories this cycle. The design below addresses each risk area you asked about explicitly, plus the broader OWASP-driven items that apply to a booking platform handling PII and payments.

### 5.1 Input Validation
- Every API endpoint has a DTO with strict validation (`class-validator`/`class-transformer` in NestJS, or Zod schemas shared with the frontend). Reject unknown fields (`whitelist: true, forbidNonWhitelisted: true`) — don't just ignore extra fields, reject the request.
- Validate on the server always, regardless of client-side (web/mobile) validation — client-side validation is UX, not security.
- Strict types for dates, currency amounts (use integer minor units, e.g. cents, never floats), and enums (room status, booking status) so invalid states can't be represented.
- File uploads (ID documents at check-in) validated by content-type sniffing (not just extension), size-limited, and scanned before storage — store in a private S3 bucket, never public.

### 5.2 Cross-Site Scripting (XSS)
- React/Next.js escape output by default — the risk is where you bypass that. Ban `dangerouslySetInnerHTML` outside of one reviewed component; if you must render guest-generated content (reviews, special requests shown back in staff UI), sanitize server-side with a library like DOMPurify before storage or before render, not just on the way in.
- Set a strict **Content-Security-Policy** header (via Next.js middleware) — no inline scripts, explicit allow-list for any third-party scripts (payment widget, ElevenLabs widget, analytics).
- Set `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY` (or `frame-ancestors` in CSP) to prevent clickjacking on the booking flow.
- Mobile app (React Native) isn't rendering arbitrary HTML by default, so the main XSS surface stays web — but any WebView usage inside the app needs the same CSP discipline.

### 5.3 SQL / Database Injection
- Prisma (or TypeORM with parameterized queries only) for all DB access — no raw string-concatenated SQL, ever. If a raw query is genuinely needed (complex reporting), use parameterized `$queryRaw` with typed parameters, never string interpolation of user input.
- Database roles are least-privilege: the API's DB user can't `DROP`, can't access tables outside its bounded context, and reporting/read-replica access uses a separate read-only credential.
- WAF SQLi managed rule set in front of the ALB as a second layer, not a substitute for parameterized queries.

### 5.4 Spoofing / Identity Assurance
- **Webhook spoofing (ElevenLabs/Telnyx/Twilio → your API):** verify request signatures on every inbound webhook (HMAC signature validation using the provider's signing secret), reject anything unsigned or with an invalid signature. Add timestamp + nonce checks to prevent replay of a captured valid webhook call.
- **Phone caller ID is not authentication.** Caller ID is trivially spoofable. Any booking modification or PII disclosure over the phone requires a secondary factor: confirmation code + name match, or an OTP sent to the phone/email on file for that booking, before the AI assistant (or a human agent) discloses or changes anything.
- **CSRF** protection on the web app's cookie-authenticated session routes (SameSite=Strict/Lax cookies + CSRF token on state-changing requests) — the mobile app's bearer-token auth is naturally CSRF-resistant since it isn't cookie-based.
- **Payment spoofing:** never trust a client-reported "payment succeeded" — booking is only confirmed after a server-to-server webhook from the payment processor confirms the charge, itself signature-verified.

### 5.5 Rate Limiting & Abuse Prevention
- Layered: WAF rate-based rules at the edge (blunt, IP-based) → ALB → application-level rate limiting in Redis (token bucket, per-IP and per-account/per-API-key) for finer control.
- Unauthenticated endpoints (search, availability check) get tighter limits than authenticated ones — these are the most scraped and most likely to be hit by bots.
- AI assistant tool-invocation endpoints get their own limit independent of general API traffic — a runaway or manipulated agent session shouldn't be able to hammer the booking engine or rack up payment-processor calls.
- Auth endpoints (login, OTP request/verify) get aggressive rate limiting plus exponential backoff/lockout after repeated failures, logged and alertable.

### 5.6 Access Control (OWASP #1 — Broken Access Control)
- Every endpoint enforces authorization **server-side**, checked against the resource being accessed, not just "is the user logged in." Explicitly test for:
  - **BOLA** (Broken Object-Level Authorization): a staff member or guest requesting `/bookings/{id}` must be authorized for *that specific booking*, not just any booking — check ownership/property-scope on every fetch, not just on create.
  - **BFLA** (Broken Function-Level Authorization): role checks on the endpoint itself (e.g., only `manager`/`admin` roles can hit rate-override endpoints), not just hidden in the UI.
- Staff roles are property-scoped: a front-desk user at Property A cannot query or modify Property B's bookings even with a guessed ID.

### 5.7 Security Misconfiguration (OWASP #2)
- All infrastructure defined in Terraform, scanned in CI with `tfsec`/`checkov` before apply — catches public S3 buckets, open security groups, missing encryption, before they reach prod.
- No default credentials anywhere; all secrets in Secrets Manager, rotated, never in env files committed to git.
- Debug endpoints, verbose error pages, and framework version headers disabled/stripped in production builds.

### 5.8 Software Supply Chain (OWASP #3, new category)
- Automated dependency scanning (GitHub Dependabot or Snyk) in CI, blocking merges on high/critical vulnerabilities.
- Lockfiles committed (`pnpm-lock.yaml`), reproducible builds, container base images pinned to digest not `:latest`.
- Given the AI assistant integration pulls in third-party SDKs (ElevenLabs, Telnyx/Twilio), review their permission scope and pin versions deliberately.

### 5.9 Mishandling of Exceptional Conditions (OWASP #10, new category)
- Centralized NestJS exception filter: every error returns a generic message + correlation ID to the client; full stack trace and internal details go only to CloudWatch logs, never the response body.
- Payment and booking-creation flows are wrapped so a failure partway through (e.g. payment succeeds but booking-write fails) triggers a defined reconciliation path, not a silent inconsistent state — this is where double-charges and phantom bookings come from in practice.

### 5.10 Data Protection & Compliance
- TLS 1.2+ enforced everywhere (ALB listener policy, CloudFront viewer protocol policy).
- Encryption at rest: RDS and S3 with KMS-managed keys.
- PCI-DSS scope minimization: card data never touches your servers — hosted payment fields/tokenization (e.g. Stripe Elements or equivalent) keeps you at the lowest PCI SAQ tier (A/A-EP) instead of full SAQ D.
- GDPR: data export and deletion endpoints for guest data subject requests; defined retention period for call recordings/transcripts (consent notice required before recording); data processing agreements with ElevenLabs/Telnyx/payment processor as sub-processors.
- Immutable audit log (append-only table or separate audit store) for every reservation and pricing change — who, what, when, from which channel (web/staff/AI) — needed for both fraud investigation and dispute resolution with guests.

---

## 6. Updated AWS Services List (adds to previous doc)

| Layer | Service | Note |
|---|---|---|
| Edge security | AWS WAF | SQLi/XSS managed rules + custom rate-based rules |
| Mobile push | SNS Mobile Push (+ FCM/APNs) | added when mobile ships |
| Secrets | Secrets Manager | webhook signing secrets, API keys, DB creds |
| Scanning | CI-integrated: Dependabot/Snyk, tfsec/checkov | not an AWS service, but part of the pipeline |
| Audit storage | Dedicated Postgres audit table or S3 + Athena for long-term | append-only |

This doesn't materially change the budget tiers from the first architecture document — WAF adds roughly $10–20/mo, SNS push is near-free at this scale.
