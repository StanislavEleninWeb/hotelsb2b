# Security Review — Phase 11

Review against Plan/03 Phase 11 **and** Plan/02 §5 (not only the ten bullets).
Pass/fail per item with evidence and remediation. **Re-run before every major
release** with:

```bash
pnpm -r typecheck && pnpm -r lint
pnpm --filter @hotel/api test
tfsec terraform
pnpm audit --audit-level high
git grep -nE "AKIA[0-9A-Z]{16}|-----BEGIN .* PRIVATE"   # + scan history: git log -p --all
NODE_ENV=production pnpm --filter @hotel/web start   # then verify CSP + hydration in a browser
```

Date: 2026-08-23 · Branch: `feat/phase-11-security`

| # | Item | Result |
|---|---|---|
| 1 | Object- & function-level authorization (BOLA/BFLA) | ✅ PASS (1 fix; guards fail-open on absent metadata — see note) |
| 2 | No raw string-concatenated SQL | ✅ PASS |
| 3 | CSP + security headers on web/staff | ✅ PASS **after fixing a production-breaking CSP bug** |
| 4 | Webhook signature + replay verification | ✅ PASS (payment webhook N/A — deferred) |
| 5 | Rate limiting on auth, search/availability, AI | ✅ PASS (+ THROTTLE_DISABLED now ignored in prod) |
| 6 | No secrets in the repository (incl. git history) | ✅ PASS |
| 7 | Money is integer minor units, no floats | ✅ PASS |
| 8 | Exception filter never leaks internals | ✅ PASS |
| 9 | Dependency scan clean of high/critical | ⚠️ PASS with documented triage (one runtime advisory named) |
| 10 | Terraform scan; no public S3; encrypted | ✅ tfsec PASS · checkov un-run |
| §5.3 | Least-privilege DB credentials | ❌ FINDING — app uses the RDS master user |

---

### 1. Authorization (BOLA/BFLA) — PASS, one fix, one structural note

- **BFLA:** `RolesGuard` (`@Roles`) on staff endpoints. **BOLA:** `PropertyScopeGuard`
  (`@PropertyScope`) resolves the target resource's property and checks staff scope
  or guest ownership. Proven: front-desk-A → **403** on B's rooms/bookings; guest →
  **404** on another guest's booking.
- **Fix applied:** `DELETE /devices/:token` was authenticated but unscoped — now scoped
  to the caller's own `userId`/`guestId`.
- **Structural note (important):** both guards **return `true` when their metadata is
  absent** — a new endpoint with no decorator is public by default. This snapshot was
  verified by hand; there is no test asserting "every mutation is guarded." **Remediation:**
  add a CI check/test that every `@Post/@Patch/@Delete` carries `@Roles`/`@PropertyScope`/
  `@UseGuards` or is on an explicit allow-list.
- **Deliberately public** (the allow-list): `GET /properties`, `/properties/by-slug/:slug`,
  `/properties/:id`, `GET /rate-plans`, `GET /search`, `GET /availability`,
  `POST /bookings` (guest create), `POST /bookings/lookup` (code + last name),
  `GET /ai/tools`. Note `GET /bookings/:id` uses **`@PropertyScope` only** — guest
  ownership is its *sole* control (no `@Roles`), by design.

### 2. No raw SQL — PASS

No `$queryRawUnsafe`/`$executeRawUnsafe`. All raw queries use tagged `$queryRaw` /
`Prisma.sql` with typed params; the one `Prisma.raw` (search `LIMIT`) wraps an integer
clamped to `1..50`. (Invariant #2.)

### 3. Web/staff CSP + headers — PASS (fixed a production-breaking bug)

**Finding & fix (found by verifying production, not dev):** the strict nonce CSP was
**completely broken in production** — with `'strict-dynamic'`, `'self'` is disabled, and
Next never applied the nonce, so **every script was blocked and no page hydrated**. Two
causes fixed:
1. The middleware set the CSP only on the *response*; Next reads the nonce from the
   **request** `Content-Security-Policy` header — now set on both (web + staff).
2. Client pages were statically prerendered (no per-request nonce); `export const
   dynamic = "force-dynamic"` on the root layout renders every route dynamically.

**Verified in `NODE_ENV=production`:** header carries `script-src 'self' 'nonce-…'
'strict-dynamic'` with **no `unsafe-eval`**; external scripts load; `/account` and
`/search` **hydrate and are interactive**. Plus `X-Frame-Options: DENY`, `nosniff`,
`Referrer-Policy`, `Permissions-Policy` on every response (one shared definition,
`@hotel/shared/security`). The API also emits `nosniff`/frame-deny/referrer now.

**Residual (documented):** Next's inline RSC flight-data scripts still aren't nonced by
Next and are CSP-blocked; the app degrades gracefully (client re-fetches) and functions,
but this should be closed before go-live — via Next's inline-script nonce support or a
hashed allow-list. Tracked.

### 4. Webhook signature + replay — PASS (payment N/A)

AI webhooks (`HmacSignatureGuard`): HMAC-SHA256 over exact raw bytes + ±5-min window +
one-time Redis nonce. Tests: bad-sig/stale/replay → 401. **Payment webhook not
implemented** (Stripe deferred) — must use the same pattern + confirm bookings only on
the signed server webhook (invariants #8/#9).

### 5. Rate limiting — PASS

Auth 10/min (OTP 3/min) + per-identifier lockout; search/availability 20/min; lookup
5/min; AI 30/min + per-booking OTP cap. Redis-backed. **`THROTTLE_DISABLED=1`** (load
testing) is now **ignored when `NODE_ENV==='production'`** so it can't disable limits on
a real deploy.

### 6. Secrets — PASS

No `.env` tracked (only `.env.example` placeholders); no AWS keys / private keys / tokens
in tracked files or the **full git history**. Real secrets → AWS Secrets Manager (TF) +
GitHub Actions secrets.

### 7. Money integers — PASS

All money is `Int` minor units + ISO `currency`; no `Float` money; CHECK constraints
enforce non-negative amounts. (Invariant #1.)

### 8. Exception filter — PASS

`AllExceptionsFilter` returns `{statusCode, message, correlationId, timestamp}`; 5xx →
generic `"Internal server error"`; stack traces + DB errors only to pino logs. (§5.9.)

### 9. Dependency scan — PASS with documented triage

`pnpm audit --audit-level high` is a CI gate. 20 transitive high/critical advisories are
triaged in `pnpm-workspace.yaml → auditConfig.ignoreGhsas`. Most are **build/dev tooling
not shipped** (Expo CLI, NestJS/Prisma dev CLIs). **One ships in the runtime image and is
named separately: `sharp`** (a `next` production dependency, used for image optimization)
— resolves on Next bumps; watch it specifically. The gate **still fails on any NEW
advisory**; Dependabot opens weekly PRs. Re-review the ignore list each bump.

### 10. Terraform scan — tfsec PASS · checkov un-run

`tfsec terraform` → **0 findings** (173 passed, 32 justified inline ignores). S3 buckets
private + encrypted; RDS/Redis encrypted at rest, Redis in transit; only `0.0.0.0/0`
ingress is 443/80 on the ALB SG. **checkov** is wired into CI but `soft_fail: true` —
its baseline wasn't triageable here (checkov not installed). **Remediation:** run checkov,
triage, flip to `soft_fail: false`.

### §5.3 — Least-privilege DB credentials — ❌ FINDING

The Terraform provisions **one RDS master user**, and the API connects as it. §5.3 wants
the app's DB user to be unable to `DROP` / reach out-of-context tables, with a **separate
read-only credential** for reporting. **Remediation:** create a dedicated `hotel_app` role
(DML only, no DDL, scoped grants) that the app uses, run migrations under a
migration-privileged role, and a read-only role for reporting/read-replicas.

---

## Other §5 items (one line each)

- **§5.1 file-upload validation** — N/A by absence (no upload path exists yet; ST-06 ID
  docs deferred). When added: content-type sniffing, size limit, scan, private S3.
- **§5.10 TLS** — Terraform enforces TLS 1.2+ (ALB/CloudFront) + KMS at rest; **un-applied**
  (no AWS account here).
- **CI Redis has no auth** (`redis://localhost:6379`) — **accepted**: ephemeral CI service
  container only; local/prod Redis use a password (§5.7).

## Open items (tracked, not blocking this review)

- Close the residual CSP inline-script gap before go-live (item 3).
- Least-privilege DB roles (§5.3 finding above).
- checkov baseline → hard gate (item 10).
- Payment webhook with HMAC + replay when Stripe lands (item 4).
- Guard-coverage CI assertion (item 1 structural note).
- GDPR export/delete endpoints + transcript retention (§5.10 / AI-07) — deferred features.
