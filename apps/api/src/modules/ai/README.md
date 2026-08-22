# AI Assistant Integration (`/api/v1/ai/*`)

The narrow, signed boundary the ElevenLabs Conversational AI agent calls. It wraps
the **same** booking/availability/auth services the web and staff apps use, so the
assistant cannot break a rule the human-facing app enforces (AI-08, invariant #6).

## Endpoints (all POST unless noted)

| Tool | Route | Auth |
|---|---|---|
| `check_availability` | `POST /ai/availability` | HMAC |
| `create_booking` | `POST /ai/bookings` | HMAC + `Idempotency-Key` |
| `request_booking_otp` | `POST /ai/otp/request` | HMAC |
| `verify_booking_otp` | `POST /ai/otp/verify` | HMAC |
| `get_booking` | `POST /ai/bookings/get` | HMAC + verification token |
| `cancel_booking` | `POST /ai/bookings/cancel` | HMAC + verification token |
| tool schemas | `GET /ai/tools` | public |

## Security

- **HMAC signatures** (`HmacSignatureGuard`): every webhook must carry
  `X-AI-Signature` = `HMAC-SHA256("{timestamp}.{rawBody}", AI_WEBHOOK_SECRET)` (hex)
  and `X-AI-Timestamp` (unix seconds). Verified over the exact request bytes
  (`rawBody: true`), within a ±5-min window, and each signature is a **one-time
  nonce** (Redis `SET NX`) — a captured request can't be replayed (§5.4).
- **Identity before disclosure (AI-03):** disclosing or changing a booking requires
  a verification token. Get one by `request_booking_otp` (confirmation code + last
  name must match; the OTP is sent to the contact **on the booking record**, never a
  request-supplied one) → `verify_booking_otp`. The token is signed with a **separate
  secret** and is NOT accepted as an access token.
- **Channel:** send `X-Channel: AI_VOICE | AI_CHAT | AI_PHONE`; every write is audited
  with that channel.
- **Rate limiting:** per-IP is a weak backstop (all traffic shares the provider IP);
  the real limit is **per-booking** (OTP request counter in `AiService`).

## Confirm-before-finalize (BK-12)

`get_booking` returns the booking **and** a `cancellationPreview` (refund amount).
The agent must read the refund back to the caller before `cancel_booking` — refund
rules live in the API, never in the prompt (invariant #6).

## Phone provisioning (Telnyx/Twilio SIP → ElevenLabs)

Voice (BK-10) and phone (BK-11) require an actual agent + SIP trunk — configuration,
not application code, and **not verified in this repo**:

1. Provision a number and a SIP trunk with Telnyx (or Twilio), following the same
   SIP + webhook wiring as the prior clinic-receptionist build.
2. Point the trunk at the ElevenLabs Conversational AI agent's SIP endpoint.
3. In the ElevenLabs agent, register the tools from `GET /ai/tools`; set the webhook
   base URL to `https://<api-host>/api/v1/ai` and the signing secret to
   `AI_WEBHOOK_SECRET`.
4. Configure the agent to send `X-Channel: AI_PHONE` for phone calls, `AI_VOICE` for
   the web voice widget, `AI_CHAT` for the chat widget.

## Env

- `AI_WEBHOOK_SECRET` — HMAC signing secret shared with the provider.
- `JWT_BOOKING_SECRET` — separate secret for booking-action verification tokens.
