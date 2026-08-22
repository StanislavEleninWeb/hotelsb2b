"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatMoney } from "@hotel/shared";
import { ApiError, browserFetch } from "../../../lib/api";
import type { AuditEntry, StaffBooking, StaffRoom } from "../../../lib/types";

interface BookingWithProperty extends StaffBooking {
  propertyId: string;
}

const NEXT_ACTIONS: Record<string, { to: string; label: string }[]> = {
  PENDING_PAYMENT: [
    { to: "CONFIRMED", label: "Confirm (walk-in / paid)" },
    { to: "CANCELLED", label: "Cancel" },
  ],
  CONFIRMED: [
    { to: "CHECKED_IN", label: "Check in" },
    { to: "NO_SHOW", label: "Mark no-show" },
    { to: "CANCELLED", label: "Cancel" },
  ],
  CHECKED_IN: [
    { to: "CHECKED_OUT", label: "Check out" },
    { to: "CANCELLED", label: "Cancel (early departure)" },
  ],
};

export default function StaffBookingPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const [idVerified, setIdVerified] = useState(false);

  const booking = useQuery({
    queryKey: ["booking", id],
    queryFn: () => browserFetch<BookingWithProperty>(`/bookings/${id}`),
    retry: false,
  });
  const rooms = useQuery({
    queryKey: ["rooms-for-assign", booking.data?.propertyId],
    queryFn: () => browserFetch<StaffRoom[]>(`/rooms/by-property/${booking.data!.propertyId}`),
    enabled: Boolean(booking.data?.propertyId),
  });
  const audit = useQuery({
    queryKey: ["audit", id],
    queryFn: () => browserFetch<AuditEntry[]>(`/bookings/${id}/audit`),
    enabled: booking.isSuccess,
  });

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["booking", id] });
    void qc.invalidateQueries({ queryKey: ["audit", id] });
  };

  const transition = useMutation({
    mutationFn: (to: string) => browserFetch(`/bookings/${id}/transition`, { method: "POST", body: { to } }),
    onSuccess: invalidate,
  });
  const assign = useMutation({
    mutationFn: (v: { bookingRoomId: string; roomId: string }) =>
      browserFetch(`/bookings/booking-rooms/${v.bookingRoomId}/assign`, {
        method: "PATCH",
        body: { roomId: v.roomId },
      }),
    onSuccess: invalidate,
  });

  if (booking.isLoading) return <p>Loading…</p>;
  if (booking.isError) {
    const status = booking.error instanceof ApiError ? booking.error.status : 0;
    return (
      <div className="card">
        <p className="error">
          {status === 401 ? "Please sign in." : status === 403 ? "Not authorized for this property." : (booking.error as Error).message}
        </p>
        <Link className="btn" href="/login">Sign in</Link>
      </div>
    );
  }

  const b = booking.data!;
  const actions = NEXT_ACTIONS[b.status] ?? [];

  return (
    <>
      <p><Link href={`/property/${b.propertyId}`}>← Property</Link></p>
      <h1>{b.confirmationCode}</h1>
      <p className="muted">
        {b.primaryGuest?.firstName} {b.primaryGuest?.lastName}
        {b.primaryGuestId && <> · <Link href={`/guest/${b.primaryGuestId}`}>guest profile</Link></>} · {b.status.replace("_", " ").toLowerCase()}
      </p>

      <div className="card">
        <div className="muted">{b.checkIn} → {b.checkOut} · {b.adults} adult(s), {b.children} child(ren)</div>
        {b.rooms.map((r) => (
          <div key={r.id} className="row" style={{ justifyContent: "space-between", borderTop: "1px solid var(--border)", paddingTop: "0.5rem" }}>
            <div>
              <strong>{r.roomType?.name}</strong> · {formatMoney(r.priceMinor, r.currency)}
              <div className="muted">{r.room ? `Assigned: #${r.room.number}` : "Not assigned"}</div>
            </div>
            {!r.room && (
              <div>
                <select
                  defaultValue=""
                  onChange={(e) => e.target.value && assign.mutate({ bookingRoomId: r.id, roomId: e.target.value })}
                >
                  <option value="">Assign room…</option>
                  {(rooms.data ?? [])
                    .filter((room) => room.roomTypeId === r.roomTypeId && room.status !== "OUT_OF_SERVICE" && room.active)
                    .map((room) => (
                      <option key={room.id} value={room.id}>#{room.number}</option>
                    ))}
                </select>
              </div>
            )}
          </div>
        ))}
      </div>

      {assign.isError && <p className="error">{(assign.error as Error).message}</p>}

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Actions</h2>
        {b.status === "CONFIRMED" && (
          <label style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
            <input type="checkbox" style={{ width: "auto" }} checked={idVerified} onChange={(e) => setIdVerified(e.target.checked)} />
            Guest ID verified (required to check in)
          </label>
        )}
        <div className="row" style={{ marginTop: "0.5rem" }}>
          {actions.map((a) => {
            const blockedCheckIn = a.to === "CHECKED_IN" && !idVerified;
            return (
              <button
                key={a.to}
                type="button"
                className={a.to === "CANCELLED" || a.to === "NO_SHOW" ? "secondary" : ""}
                disabled={transition.isPending || blockedCheckIn}
                onClick={() => transition.mutate(a.to)}
              >
                {a.label}
              </button>
            );
          })}
          {actions.length === 0 && <span className="muted">No further actions.</span>}
        </div>
        {transition.isError && <p className="error">{(transition.error as Error).message}</p>}
      </div>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Audit trail</h2>
        {(audit.data ?? []).length === 0 && <p className="muted">No entries yet.</p>}
        <ul className="clean" style={{ flexDirection: "column", alignItems: "stretch" }}>
          {(audit.data ?? []).map((e) => (
            <li key={e.id} className="muted" style={{ borderBottom: "1px solid var(--border)", padding: "0.3rem 0" }}>
              <strong>{e.action}</strong> · {e.channel.toLowerCase()} · {new Date(e.createdAt).toLocaleString()}
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
