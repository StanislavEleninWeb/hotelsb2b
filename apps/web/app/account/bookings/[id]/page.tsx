"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatMoney } from "@hotel/shared";
import { ApiError, browserFetch } from "../../../../lib/api";
import type { BookingView, CancellationPreview } from "../../../../lib/types";
import { Photo } from "../../../_components/photo";

const cellLabel: React.CSSProperties = {
  fontSize: 10,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  color: "color-mix(in srgb, var(--color-text) 72%, transparent)",
  marginBottom: 6,
};

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

  if (booking.isLoading) return <div className="pad" style={{ padding: "48px var(--pad-x)" }}><p className="muted">Loading…</p></div>;
  if (booking.isError) {
    const unauthorized = booking.error instanceof ApiError && booking.error.status === 401;
    return (
      <div className="pad" style={{ padding: "56px var(--pad-x)", maxWidth: 520 }}>
        <p className="error">{unauthorized ? "Please sign in." : (booking.error as Error).message}</p>
        <Link className="btn btn-primary" href="/account/login">Sign in</Link>
      </div>
    );
  }

  const b = booking.data!;
  const cancelled = b.status === "CANCELLED";
  const statusLabel = b.status === "CONFIRMED" ? "Confirmed" : b.status.replace(/_/g, " ").toLowerCase();

  return (
    <>
      <Photo label={b.property?.name ?? "Stay"} height={300} />

      <section className="pad stack-sm" style={{ paddingTop: 44, paddingBottom: 64, display: "grid", gridTemplateColumns: "8fr 4fr", gap: 56 }}>
        <div>
          <Link href="/account" className="backlink">
            ← My bookings
          </Link>
          <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "24px 0 12px", flexWrap: "wrap" }}>
            <span className={`tag ${cancelled ? "tag-neutral" : "tag-accent"}`}>{statusLabel}</span>
            <span className="muted" style={{ fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase" }}>
              Confirmation {b.confirmationCode}
            </span>
          </div>
          <h1 style={{ fontSize: "clamp(38px, 5vw, 56px)", lineHeight: 1, letterSpacing: "-0.03em", marginBottom: 32 }}>
            {b.property?.name ?? "Booking"}
          </h1>

          {/* Summary */}
          <div className="stack-sm" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", borderTop: "2px solid var(--color-divider)", borderBottom: "2px solid var(--color-divider)", marginBottom: 32 }}>
            <SummaryCell label="Check-in" value={b.checkIn} sub={b.property?.checkInTime ? `from ${b.property.checkInTime}` : undefined} first />
            <SummaryCell label="Check-out" value={b.checkOut} sub={b.property?.checkOutTime ? `until ${b.property.checkOutTime}` : undefined} />
            <SummaryCell label="Guests" value={`${b.adults} adult${b.adults === 1 ? "" : "s"}`} sub={b.children > 0 ? `${b.children} children` : "no children"} />
          </div>

          {/* Line items */}
          <div style={{ overflowX: "auto" }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Room</th>
                  <th>Rate plan</th>
                  <th style={{ textAlign: "right" }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {b.rooms.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <strong>{r.roomType?.name ?? "Room"}</strong>
                    </td>
                    <td>
                      {r.ratePlan?.name ?? "—"}
                      {r.ratePlan && (
                        <span className={`tag ${r.ratePlan.cancellationPolicy === "REFUNDABLE" ? "tag-accent" : "tag-neutral"}`} style={{ marginLeft: 6 }}>
                          {r.ratePlan.cancellationPolicy === "REFUNDABLE" ? "Refundable" : "Non-refundable"}
                        </span>
                      )}
                    </td>
                    <td style={{ textAlign: "right" }} className="num">{formatMoney(r.priceMinor, r.currency)}</td>
                  </tr>
                ))}
                <tr>
                  <td colSpan={2} className="num" style={{ fontSize: 16 }}>{cancelled ? "Total" : "Total paid"}</td>
                  <td style={{ textAlign: "right" }} className="num"><span style={{ fontSize: 24 }}>{formatMoney(b.totalMinor, b.currency)}</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Manage sidebar */}
        <aside style={{ borderLeft: "2px solid var(--color-divider)", paddingLeft: 32, display: "flex", flexDirection: "column", gap: 28 }}>
          <div>
            <div style={cellLabel}>Manage</div>
            {cancelled ? (
              <p className="muted" style={{ fontSize: 14, margin: 0 }}>This booking was cancelled.</p>
            ) : (
              <button type="button" className="btn btn-accent-outline btn-block" onClick={() => setShowCancel(true)}>
                Cancel booking
              </button>
            )}
          </div>
          {b.property?.name && (
            <div style={{ borderTop: "1px solid var(--color-hairline)", paddingTop: 20 }}>
              <div style={cellLabel}>Property</div>
              <div style={{ fontSize: 14, lineHeight: 1.7 }}>
                {b.property.name}
                {b.property.checkInTime && <><br />Check-in from {b.property.checkInTime}</>}
                {b.property.checkOutTime && <><br />Check-out until {b.property.checkOutTime}</>}
              </div>
            </div>
          )}
        </aside>
      </section>

      {showCancel && (
        <div className="dialog-backdrop" role="dialog" aria-modal="true" aria-label="Cancel booking">
          <div className="dialog">
            <div className="num" style={{ fontSize: 26, lineHeight: 1.1 }}>Cancel this booking?</div>
            {preview.isLoading && <p className="muted" style={{ margin: 0 }}>Calculating refund…</p>}
            {preview.isError && <p className="error" style={{ margin: 0 }}>{(preview.error as Error).message}</p>}
            {preview.data && (
              <div>
                <DialogRow label="Paid" value={formatMoney(b.totalMinor, b.currency)} first />
                <DialogRow label="Refund to original card" value={formatMoney(preview.data.refundableMinor, preview.data.currency)} accent />
                {preview.data.nonRefundableMinor > 0 && (
                  <DialogRow label="Non-refundable" value={formatMoney(preview.data.nonRefundableMinor, preview.data.currency)} muted />
                )}
              </div>
            )}
            {cancel.isError && <p className="error" style={{ margin: 0 }}>{(cancel.error as Error).message}</p>}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button type="button" className="btn btn-outline" onClick={() => setShowCancel(false)}>Keep booking</button>
              <button type="button" className="btn btn-primary" disabled={cancel.isPending} onClick={() => cancel.mutate()}>
                {cancel.isPending ? "Cancelling…" : "Confirm cancellation"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function SummaryCell({ label, value, sub, first }: { label: string; value: string; sub?: string; first?: boolean }) {
  return (
    <div style={{ padding: first ? "18px 18px 18px 0" : 18, borderLeft: first ? undefined : "1px solid var(--color-hairline)" }}>
      <div style={cellLabel}>{label}</div>
      <div className="num" style={{ fontSize: 20 }}>{value}</div>
      {sub && <div className="muted" style={{ fontSize: 12 }}>{sub}</div>}
    </div>
  );
}

function DialogRow({ label, value, first, accent, muted }: { label: string; value: string; first?: boolean; accent?: boolean; muted?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 0", borderTop: first ? undefined : "1px solid var(--color-hairline)", fontSize: 14, color: muted ? "color-mix(in srgb, var(--color-text) 72%, transparent)" : undefined }}>
      <span>{label}</span>
      <span className="num" style={{ color: accent ? "var(--color-accent-700)" : undefined }}>{value}</span>
    </div>
  );
}
