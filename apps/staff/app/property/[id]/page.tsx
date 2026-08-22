"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatMoney } from "@hotel/shared";
import { ApiError, browserFetch } from "../../../lib/api";
import type { StaffBooking, StaffRoom } from "../../../lib/types";

const STATUSES: StaffRoom["status"][] = ["CLEAN", "DIRTY", "INSPECTED", "OUT_OF_SERVICE"];

export default function PropertyPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();

  const bookings = useQuery({
    queryKey: ["calendar", id],
    queryFn: () => browserFetch<StaffBooking[]>(`/bookings/by-property/${id}`),
    retry: false,
  });
  const rooms = useQuery({
    queryKey: ["rooms", id],
    queryFn: () => browserFetch<StaffRoom[]>(`/rooms/by-property/${id}`),
    retry: false,
  });

  const setStatus = useMutation({
    mutationFn: (v: { roomId: string; status: string }) =>
      browserFetch(`/rooms/${v.roomId}`, { method: "PATCH", body: { status: v.status } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rooms", id] }),
  });

  const block = useMutation({
    mutationFn: (v: { roomId: string; startDate: string; endDate: string; reason: string }) =>
      browserFetch(`/rooms/${v.roomId}/block`, {
        method: "POST",
        body: { startDate: v.startDate, endDate: v.endDate, reason: v.reason },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rooms", id] }),
  });

  const notAuthorized =
    (bookings.error instanceof ApiError && bookings.error.status === 403) ||
    (rooms.error instanceof ApiError && rooms.error.status === 403);
  const unauthenticated =
    (bookings.error instanceof ApiError && bookings.error.status === 401) ||
    (rooms.error instanceof ApiError && rooms.error.status === 401);

  if (unauthenticated) {
    return (
      <div className="card">
        <p className="error">Please sign in.</p>
        <Link className="btn" href="/login">Sign in</Link>
      </div>
    );
  }
  if (notAuthorized) {
    return (
      <div className="card">
        <p className="error">You are not authorized for this property (BOLA — blocked server-side).</p>
        <Link href="/">← Back</Link>
      </div>
    );
  }

  return (
    <>
      <p><Link href="/">← Properties</Link></p>
      <h1>Property management</h1>
      <p><Link href={`/rates/${id}`}>Manage rate plans →</Link></p>

      <h2>Bookings calendar</h2>
      {bookings.isLoading && <p>Loading…</p>}
      {(bookings.data ?? []).length === 0 && !bookings.isLoading && (
        <p className="muted">No active bookings in range.</p>
      )}
      {(bookings.data ?? []).map((b) => (
        <div className="card" key={b.id}>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <div>
              <strong>{b.confirmationCode}</strong> · {b.status.replace("_", " ").toLowerCase()}
              <div className="muted">
                {b.primaryGuest?.firstName} {b.primaryGuest?.lastName} · {b.checkIn} → {b.checkOut}
              </div>
              <div className="muted">
                Rooms: {b.rooms.map((r) => `${r.roomType?.name ?? "?"}${r.room ? ` (#${r.room.number})` : " (unassigned)"}`).join(", ")}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div className="price">{formatMoney(b.totalMinor, b.currency)}</div>
              <Link className="btn" href={`/booking/${b.id}`}>Open</Link>
            </div>
          </div>
        </div>
      ))}

      <h2>Housekeeping & rooms</h2>
      {rooms.isLoading && <p>Loading…</p>}
      <div className="grid">
        {(rooms.data ?? []).map((r) => (
          <div className="card" key={r.id}>
            <strong>#{r.number}</strong> <span className="muted">{r.roomType?.name}</span>
            <div className="field" style={{ marginTop: "0.5rem" }}>
              <label htmlFor={`st-${r.id}`}>Housekeeping status</label>
              <select
                id={`st-${r.id}`}
                value={r.status}
                onChange={(e) => setStatus.mutate({ roomId: r.id, status: e.target.value })}
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>{s.replace("_", " ").toLowerCase()}</option>
                ))}
              </select>
            </div>
            <button
              className="secondary"
              type="button"
              style={{ marginTop: "0.5rem" }}
              onClick={() => {
                const startDate = prompt("Block start date (YYYY-MM-DD)");
                const endDate = startDate ? prompt("Block end date (YYYY-MM-DD)") : null;
                const reason = endDate ? prompt("Reason") : null;
                if (startDate && endDate && reason) block.mutate({ roomId: r.id, startDate, endDate, reason });
              }}
            >
              Block room
            </button>
          </div>
        ))}
      </div>
      {(setStatus.isError || block.isError) && (
        <p className="error">{((setStatus.error ?? block.error) as Error)?.message}</p>
      )}
    </>
  );
}
