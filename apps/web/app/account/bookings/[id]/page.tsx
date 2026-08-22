"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatMoney } from "@hotel/shared";
import { ApiError, browserFetch } from "../../../../lib/api";
import type { BookingView, CancellationPreview } from "../../../../lib/types";

export default function BookingDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const qc = useQueryClient();
  const [showCancel, setShowCancel] = useState(false);

  const booking = useQuery({
    queryKey: ["booking", id],
    queryFn: () => browserFetch<BookingView>(`/bookings/${id}`),
    retry: false,
  });

  const preview = useQuery({
    queryKey: ["cancel-preview", id],
    queryFn: () => browserFetch<CancellationPreview>(`/bookings/${id}/cancellation-preview`),
    enabled: showCancel,
    retry: false,
  });

  const cancel = useMutation({
    mutationFn: () => browserFetch<BookingView>(`/bookings/${id}/cancel`, { method: "POST", body: {} }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["booking", id] });
      void qc.invalidateQueries({ queryKey: ["my-bookings"] });
      setShowCancel(false);
    },
  });

  if (booking.isLoading) return <p>Loading…</p>;
  if (booking.isError) {
    const unauthorized = booking.error instanceof ApiError && booking.error.status === 401;
    return (
      <div className="card">
        <p className="error">{unauthorized ? "Please sign in." : (booking.error as Error).message}</p>
        <Link className="btn" href="/account/login">
          Sign in
        </Link>
      </div>
    );
  }

  const b = booking.data!;
  const cancelled = b.status === "CANCELLED";

  return (
    <>
      <p>
        <Link href="/account">← My bookings</Link>
      </p>
      <h1>{b.property?.name ?? "Booking"}</h1>
      <p className="muted">
        Confirmation {b.confirmationCode} · <strong>{b.status.replace("_", " ").toLowerCase()}</strong>
      </p>

      <div className="card">
        <div className="muted">
          {b.checkIn} → {b.checkOut} · {b.adults} adult(s), {b.children} child(ren)
        </div>
        {b.rooms.map((r) => (
          <div key={r.id} className="row" style={{ justifyContent: "space-between", borderTop: "1px solid var(--border)", paddingTop: "0.5rem" }}>
            <div>
              <strong>{r.roomType?.name ?? "Room"}</strong>
              {r.ratePlan && (
                <span className={`badge ${r.ratePlan.cancellationPolicy === "REFUNDABLE" ? "refundable" : "nonref"}`} style={{ marginLeft: "0.5rem" }}>
                  {r.ratePlan.cancellationPolicy === "REFUNDABLE" ? "Refundable" : "Non-refundable"}
                </span>
              )}
            </div>
            <div className="price">{formatMoney(r.priceMinor, r.currency)}</div>
          </div>
        ))}
        <div className="row" style={{ justifyContent: "space-between", borderTop: "2px solid var(--border)", paddingTop: "0.5rem" }}>
          <strong>Total</strong>
          <div className="price">{formatMoney(b.totalMinor, b.currency)}</div>
        </div>
      </div>

      {!cancelled && !showCancel && (
        <button className="secondary" onClick={() => setShowCancel(true)}>
          Cancel booking
        </button>
      )}

      {showCancel && (
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Cancel this booking?</h2>
          {preview.isLoading && <p>Calculating refund…</p>}
          {preview.isError && <p className="error">{(preview.error as Error).message}</p>}
          {preview.data && (
            <>
              <p>
                Refund to original payment method:{" "}
                <strong className="ok">{formatMoney(preview.data.refundableMinor, preview.data.currency)}</strong>
              </p>
              {preview.data.nonRefundableMinor > 0 && (
                <p className="muted">
                  Non-refundable: {formatMoney(preview.data.nonRefundableMinor, preview.data.currency)}
                </p>
              )}
            </>
          )}
          {cancel.isError && <p className="error">{(cancel.error as Error).message}</p>}
          <div className="row" style={{ marginTop: "0.75rem" }}>
            <button className="secondary" type="button" onClick={() => setShowCancel(false)}>
              Keep booking
            </button>
            <button type="button" disabled={cancel.isPending} onClick={() => cancel.mutate()}>
              {cancel.isPending ? "Cancelling…" : "Confirm cancellation"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
