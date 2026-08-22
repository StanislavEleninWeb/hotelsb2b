"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CreateBookingSchema, PrimaryGuestSchema, formatMoney } from "@hotel/shared";
import { browserFetch } from "../../lib/api";
import { stubPaymentProvider } from "../../lib/payment";
import type { AvailabilityResult, BookingView } from "../../lib/types";

function BookInner() {
  const sp = useSearchParams();
  const propertyId = sp.get("propertyId") ?? "";
  const roomTypeId = sp.get("roomTypeId") ?? "";
  const ratePlanId = sp.get("ratePlanId") ?? "";
  const checkIn = sp.get("checkIn") ?? "";
  const checkOut = sp.get("checkOut") ?? "";
  const adults = Number(sp.get("adults") ?? "2");
  const children = Number(sp.get("children") ?? "0");

  const [step, setStep] = useState<"details" | "payment" | "done">("details");
  const [guest, setGuest] = useState({ firstName: "", lastName: "", email: "", phone: "" });
  const [specialRequests, setSpecialRequests] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  // A fresh idempotency key per finalized payload; regenerated whenever the guest
  // goes back to edit (so a changed body doesn't collide with the prior key → 422).
  const [idempotencyKey, setIdempotencyKey] = useState<string>(() => crypto.randomUUID());
  const [booking, setBooking] = useState<BookingView | null>(null);

  const availability = useQuery({
    queryKey: ["availability", propertyId, checkIn, checkOut, adults, children],
    queryFn: () => {
      const qs = new URLSearchParams({
        propertyId,
        checkIn,
        checkOut,
        adults: String(adults),
        children: String(children),
      });
      return browserFetch<AvailabilityResult[]>(`/availability?${qs}`);
    },
    enabled: Boolean(propertyId && checkIn && checkOut),
  });

  const selected = useMemo(() => {
    const rt = availability.data?.find((a) => a.roomTypeId === roomTypeId);
    const rp = rt?.ratePlans.find((p) => p.ratePlanId === ratePlanId);
    return rt && rp ? { roomTypeName: rt.roomTypeName, price: rp } : null;
  }, [availability.data, roomTypeId, ratePlanId]);

  const createBooking = useMutation({
    mutationFn: async () => {
      const payload = {
        propertyId,
        checkIn,
        checkOut,
        rooms: [{ roomTypeId, ratePlanId, adults, children }],
        primaryGuest: {
          firstName: guest.firstName,
          lastName: guest.lastName,
          email: guest.email || undefined,
          phone: guest.phone || undefined,
        },
        specialRequests: specialRequests || undefined,
      };
      // Validate against the same schema the API enforces (UX; server re-validates).
      const parsed = CreateBookingSchema.parse(payload);
      return browserFetch<BookingView>("/bookings", {
        method: "POST",
        body: parsed,
        idempotencyKey,
      });
    },
    onSuccess: (b) => {
      setBooking(b);
      setStep("done");
    },
  });

  function goToPayment(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    const result = PrimaryGuestSchema.safeParse({
      firstName: guest.firstName,
      lastName: guest.lastName,
      email: guest.email || undefined,
      phone: guest.phone || undefined,
    });
    if (!result.success) {
      setFormError(result.error.issues[0]?.message ?? "Please check your details.");
      return;
    }
    void stubPaymentProvider.init({ bookingId: "pending", amountMinor: selected?.price.priceMinor ?? 0, currency: selected?.price.currency ?? "EUR" });
    setStep("payment");
  }

  if (!propertyId || !roomTypeId || !ratePlanId || !checkIn || !checkOut) {
    return <p className="error">Missing booking details. Please start from a property page.</p>;
  }

  return (
    <>
      <h1>Book your stay</h1>
      <div className="steps">
        <span className={`step ${step === "details" ? "active" : ""}`}>1 · Guest details</span>
        <span className={`step ${step === "payment" ? "active" : ""}`}>2 · Payment</span>
        <span className={`step ${step === "done" ? "active" : ""}`}>3 · Confirmation</span>
      </div>

      <div className="card">
        <strong>{selected?.roomTypeName ?? "Room"}</strong>
        <div className="muted">
          {checkIn} → {checkOut} · {adults} adult(s), {children} child(ren)
        </div>
        {selected && <div className="price">{formatMoney(selected.price.priceMinor, selected.price.currency)} total</div>}
      </div>

      {step === "details" && (
        <form className="card" onSubmit={goToPayment}>
          <h2 style={{ marginTop: 0 }}>Guest details</h2>
          <div className="row">
            <div className="field">
              <label htmlFor="fn">First name</label>
              <input id="fn" value={guest.firstName} onChange={(e) => setGuest({ ...guest, firstName: e.target.value })} />
            </div>
            <div className="field">
              <label htmlFor="ln">Last name</label>
              <input id="ln" value={guest.lastName} onChange={(e) => setGuest({ ...guest, lastName: e.target.value })} />
            </div>
          </div>
          <div className="row">
            <div className="field">
              <label htmlFor="em">Email</label>
              <input id="em" type="email" value={guest.email} onChange={(e) => setGuest({ ...guest, email: e.target.value })} />
            </div>
            <div className="field">
              <label htmlFor="ph">Phone</label>
              <input id="ph" value={guest.phone} onChange={(e) => setGuest({ ...guest, phone: e.target.value })} />
            </div>
          </div>
          <div className="field">
            <label htmlFor="sr">Special requests (optional)</label>
            <input id="sr" value={specialRequests} onChange={(e) => setSpecialRequests(e.target.value)} />
          </div>
          {formError && <p className="error">{formError}</p>}
          <button type="submit" style={{ marginTop: "0.75rem" }}>
            Continue to payment
          </button>
        </form>
      )}

      {step === "payment" && (
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Payment</h2>
          <p className="muted">
            Card details are entered in the payment provider’s hosted fields — they never touch
            our servers (PB-05). Provider integration is added in a later phase; this is a
            placeholder.
          </p>
          <div className="card" style={{ background: "var(--bg)", textAlign: "center" }}>
            <em className="muted">[ Hosted payment fields — stubbed ]</em>
          </div>
          {createBooking.isError && <p className="error">{(createBooking.error as Error).message}</p>}
          <div className="row" style={{ marginTop: "0.75rem" }}>
            <button
              className="secondary"
              type="button"
              onClick={() => {
                setIdempotencyKey(crypto.randomUUID());
                setStep("details");
              }}
            >
              Back
            </button>
            <button type="button" disabled={createBooking.isPending} onClick={() => createBooking.mutate()}>
              {createBooking.isPending ? "Placing booking…" : "Place booking"}
            </button>
          </div>
        </div>
      )}

      {step === "done" && booking && (
        <div className="card">
          <h2 style={{ marginTop: 0 }} className="ok">
            Booking received
          </h2>
          <p>
            Confirmation code: <strong>{booking.confirmationCode}</strong>
          </p>
          <p className="muted">
            Status: {booking.status.replace("_", " ").toLowerCase()} — your reservation is{" "}
            <strong>awaiting payment confirmation</strong>. You’ll receive an email once payment is
            confirmed.
          </p>
          <Link className="btn" href="/account">
            View my bookings
          </Link>
        </div>
      )}
    </>
  );
}

export default function BookPage() {
  return (
    <Suspense fallback={<p>Loading…</p>}>
      <BookInner />
    </Suspense>
  );
}
