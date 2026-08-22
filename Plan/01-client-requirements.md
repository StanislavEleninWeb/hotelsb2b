# Hotel Booking Platform — Client Requirements List

**Priority key:** M = Must have (v1) · S = Should have (v1/v1.1) · C = Could have (later phase)

---

## 1. Guest — Search & Discovery

| ID | Requirement | Priority |
|---|---|---|
| SD-01 | Guest can search availability by destination/property, check-in/check-out dates, and guest count (adults/children/rooms) | M |
| SD-02 | Guest can filter results by price range, room type, amenities, cancellation policy, accessibility features, and guest rating | M |
| SD-03 | Guest can view property detail page: photos, description, amenities, location map, policies, reviews | M |
| SD-04 | Guest can view real-time room availability and price per room type for selected dates | M |
| SD-05 | Guest can compare rate plans for the same room (e.g. refundable vs non-refundable, breakfast included vs not) | S |
| SD-06 | Site supports multiple languages and currencies based on guest locale, with manual override | S |
| SD-07 | Guest can view and sort verified guest reviews/ratings | S |
| SD-08 | Search results and property pages are indexable/SEO-optimized | M |

## 2. Guest — Booking Creation

| ID | Requirement | Priority |
|---|---|---|
| BK-01 | Guest can book one or multiple rooms in a single reservation | M |
| BK-02 | Guest can complete booking as a guest (no account) or by creating/logging into an account | M |
| BK-03 | Guest provides primary contact details and, if required, names of additional occupants | M |
| BK-04 | Guest can select add-ons: breakfast, parking, airport transfer, extra bed, late checkout, etc. | S |
| BK-05 | Guest can apply a promo code or loyalty discount at checkout | S |
| BK-06 | Guest can pay full amount online, pay a deposit, or select "pay at property" where policy allows | M |
| BK-07 | System prevents double-booking of the same room/inventory unit (concurrency-safe availability check at payment time) | M |
| BK-08 | Guest receives booking confirmation via email (and SMS if provided) immediately after successful payment | M |
| BK-09 | Guest can complete a booking entirely through the AI assistant via web chat widget | M |
| BK-10 | Guest can complete a booking entirely through the AI assistant via voice (web voice widget) | S |
| BK-11 | Guest can complete a booking entirely through a phone call to a dedicated number, handled by the AI assistant | S |
| BK-12 | AI assistant confirms captured booking details back to the guest before finalizing payment/booking | M |

## 3. Guest — Manage Existing Booking

| ID | Requirement | Priority |
|---|---|---|
| MG-01 | Guest can retrieve a booking via account login or via confirmation code + email/last name lookup | M |
| MG-02 | Guest can view full booking details, invoice, and current status | M |
| MG-03 | Guest can modify dates, room type, or guest count, subject to availability and change policy | S |
| MG-04 | Guest can cancel a booking and see applicable refund amount/policy before confirming | M |
| MG-05 | Guest can add special requests (e.g. high floor, dietary needs) post-booking | C |
| MG-06 | Guest can request resend of confirmation email/invoice | M |
| MG-07 | Guest can complete online pre-arrival check-in (ID upload, arrival time, special requests) | C |
| MG-08 | Guest can modify or cancel a booking via the AI assistant (chat/voice/phone) after identity verification | S |

## 4. Internal Staff — Reservation Management

| ID | Requirement | Priority |
|---|---|---|
| ST-01 | Staff can create a new booking on behalf of a guest (walk-in, phone, email request) | M |
| ST-02 | Staff can view a calendar/grid of room availability and existing bookings across the property (or all properties, if multi-property) | M |
| ST-03 | Staff can modify or cancel any booking, with reason code and audit trail | M |
| ST-04 | Staff can manually block/unblock rooms for maintenance, owner use, or other operational reasons | M |
| ST-05 | Staff can assign a specific physical room number to a booking (separate from the room-type level booked by the guest) | M |
| ST-06 | Staff can check a guest in and out, including ID verification | M |
| ST-07 | Staff can split or merge bookings, and manage group/block bookings for multiple rooms under one reservation | S |
| ST-08 | Staff can manage rate plans and pricing rules (seasonal rates, weekday/weekend, minimum stay, dynamic pricing overrides) | M |
| ST-09 | Staff can manage room inventory: add/edit/remove room types and individual rooms | M |
| ST-10 | Staff can apply manual discounts, comps, or price overrides with permission controls | S |
| ST-11 | Staff can take/process payments, issue refunds, and record deposits at the front desk | M |
| ST-12 | Staff can view a guest profile with booking history, preferences, and internal notes | S |
| ST-13 | Staff can track housekeeping status per room (clean/dirty/inspected/out of service) | S |
| ST-14 | Staff can manage a waitlist and handle overbooking scenarios | S |
| ST-15 | Staff can flag and process no-shows according to policy | M |
| ST-16 | System supports role-based permissions (front desk, manager, finance, housekeeping, super admin) | M |
| ST-17 | Every reservation change made internally is logged with who/what/when for audit and dispute resolution | M |
| ST-18 | (If multi-property) staff/admin can manage several properties from one account with property-scoped access | C |
| ST-19 | (If OTA distribution is in scope) inventory and rates sync with external channels (Booking.com, Expedia, etc.) via channel manager | C |

## 5. AI Assistant — Conversational Operations

| ID | Requirement | Priority |
|---|---|---|
| AI-01 | Assistant answers availability and pricing questions in natural language across chat, voice widget, and phone | M |
| AI-02 | Assistant performs multi-turn slot-filling to collect dates, room type, guest count, and contact details | M |
| AI-03 | Assistant verifies caller/guest identity (confirmation code + name, or OTP) before disclosing or modifying an existing booking | M |
| AI-04 | Assistant can escalate/transfer to a human staff member when it cannot resolve a request or the guest asks for a human | M |
| AI-05 | Assistant answers common FAQs (check-in/out time, parking, pet policy, cancellation policy) from a maintained knowledge base | S |
| AI-06 | Assistant sends a confirmation (SMS/email) at the end of any booking or change made through it | M |
| AI-07 | Call/chat transcripts are logged for QA and dispute resolution, with guest consent and retention policy defined | M |
| AI-08 | Assistant's booking/modification actions go through the same validation and availability rules as the web and staff flows (single source of truth) | M |

## 6. Payments & Billing

| ID | Requirement | Priority |
|---|---|---|
| PB-01 | Support major card payments plus at least one regional payment method relevant to target markets | M |
| PB-02 | Support deposit-only, full-payment, and pay-at-property flows per rate plan configuration | M |
| PB-03 | Refunds are processed back through the original payment method where possible, with an auditable trail | M |
| PB-04 | System generates a downloadable invoice/receipt per booking | M |
| PB-05 | No raw cardholder data is stored by the application — payment processor handles PCI-scoped data | M |
| PB-06 | Multi-currency pricing and settlement supported if serving international guests | C |

## 7. Notifications

| ID | Requirement | Priority |
|---|---|---|
| NT-01 | Automated booking confirmation, pre-arrival reminder, and post-stay message | M |
| NT-02 | Automated cancellation/modification notification to guest and relevant staff | M |
| NT-03 | Staff notified in near-real-time of new bookings, cancellations, and no-shows relevant to their property | S |
| NT-04 | Guest can opt in/out of marketing communications separately from transactional notifications | M |

## 8. Reporting & Analytics (internal)

| ID | Requirement | Priority |
|---|---|---|
| RP-01 | Occupancy rate, ADR (average daily rate), and RevPAR reporting by date range and property | S |
| RP-02 | Booking source breakdown (direct web, AI assistant — chat/voice/phone, OTA) | S |
| RP-03 | Revenue reporting with filters by property, room type, and channel | S |
| RP-04 | Cancellation and no-show rate reporting | C |
| RP-05 | Exportable reports (CSV/Excel) for finance use | S |

## 9. Admin / System Configuration

| ID | Requirement | Priority |
|---|---|---|
| AD-01 | CMS for property and room content: photos, descriptions, amenities, policies | M |
| AD-02 | User and role management with the ability to invite/deactivate staff accounts | M |
| AD-03 | Rate and availability calendar management interface | M |
| AD-04 | Localization management for supported languages | C |

## 10. Non-Functional Requirements (summary — detailed in Architecture doc)

| ID | Requirement | Priority |
|---|---|---|
| NF-01 | Platform must remain responsive during traffic spikes (seasonal demand, marketing campaigns) | M |
| NF-02 | Public site is mobile-responsive at launch; native mobile app planned as a future phase reusing the same API | M |
| NF-03 | Security: input validation, XSS/injection protection, rate limiting, and access control on all endpoints (see Architecture doc §5) | M |
| NF-04 | Compliance: GDPR (guest PII), PCI-DSS scope minimization (payments) | M |
| NF-05 | Public-facing pages meet WCAG 2.1 AA accessibility where practical | S |
| NF-06 | 99.9% uptime target for booking-critical paths | S |

---

**Next step:** review priorities (M/S/C) and flag anything out of scope for v1, anything missing (e.g. loyalty program, multi-property from day one, specific target markets/payment methods) — this determines what goes into the v1 architecture vs. what's designed-for-but-deferred.
