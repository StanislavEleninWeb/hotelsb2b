# Migration Plan — Phase 2 Schema

The first migration (`migrations/*_init`) creates the full v1 domain. This doc
records what the initial migration includes, what is deliberately deferred, and
the invariants the **application layer** must enforce that the schema alone cannot.

## In the first migration (v1)

- **Multi-property core:** `Property` (+ images, amenities) with `propertyId` on
  every scoped entity — multi-property is day-one (confirmed scope decision).
- **Inventory:** `RoomType` (+ images, amenities), `Room` (status: clean/dirty/
  inspected/out_of_service), `RoomBlock` (maintenance/owner blocks).
- **Pricing:** `RatePlan` (refundable/non-refundable, deposit/full/pay-at-property,
  min/max stay), `RateRule` (seasonal/weekday overrides), `AddOn`.
- **Bookings:** `Booking`, `BookingRoom` (multi-room + physical-room assignment),
  `BookingOccupant`, `BookingAddOn`, `Promotion`.
- **Guests:** `Guest` (account or one-off), `GuestNote`.
- **Payments:** `Payment` (Stripe references only, no card data), `Refund`.
- **Ops & trust:** `AuditLog` (append-only), `Notification`, `Review`.
- **Staff & access:** `User`, `StaffPropertyAccess` (property-scoped roles).
- **CHECK constraints (hand-added to the SQL):** `Review.rating` ∈ [1,5];
  non-negative money on all `*Minor` columns; `checkOut > checkIn` on `Booking`
  and `BookingRoom`.

## Deferred (NOT in this migration)

| Deferred entity/field | Requirement | Phase |
|---|---|---|
| `RefreshToken`, `OtpCode` (hashed, rotated, identity-OTP) | AI-03, auth | **Phase 4** |
| `CheckIn` record + uploaded ID-document reference (private S3 key) | ST-06, MG-07 | Phase 6 (staff) / later |
| `Waitlist` / overbooking handling | ST-14 | later (S priority) |
| `CallSession` / `Transcript` (with consent + retention) | AI-07 | **Phase 8** |
| Channel-manager / OTA sync fields | ST-19 | later (C priority) |
| Localization/translation tables | AD-04, SD-06 | later (C priority) — `locale`/`currency` columns exist; full i18n deferred |

## Application-layer invariants the schema cannot enforce

These are **not** bugs in the schema — they are decisions the service layer owns
(flagged so Phase 3+ handles them deliberately):

1. **Guest identity resolution.** `Guest.email` is intentionally **not unique**
   (BK-02 allows repeat no-account bookings). Deciding when to reuse vs. create a
   guest, and any profile-merge policy, is an application concern.
2. **Single currency per booking.** `BookingRoom`, `BookingAddOn`, and `Payment`
   each carry `currency`; the service MUST assert they equal `Booking.currency`.
3. **Denormalized copies stay in sync.** `BookingRoom.propertyId`/`roomTypeId` are
   denormalized (they back the availability indexes). The service MUST copy
   `propertyId` from the booking and assert an assigned `Room`'s type matches
   `roomTypeId`.
4. **Concurrency (same discipline as BK-07).** `Promotion.redemptionsCount` vs
   `maxRedemptions` is a read-modify-write race — enforce with row locking /
   atomic update, exactly like the availability check in Phase 3.
5. **Date envelope vs per-room dates.** `Booking.checkIn/checkOut` is the
   reservation envelope; `BookingRoom` dates are authoritative for availability
   and may stagger within the envelope.
6. **AuditLog is append-only.** Never `UPDATE`/`DELETE` — enforced by convention
   and the audit interceptor (Phase 3), not a DB trigger yet.

## Commands

```bash
cd apps/api
export DATABASE_URL="postgresql://hotel:hotel_dev_password@localhost:5432/hotel"
pnpm db:migrate          # prisma migrate dev (create + apply in dev)
pnpm db:deploy           # prisma migrate deploy (apply committed migrations in CI/prod)
pnpm db:generate         # regenerate the client after schema edits
```
