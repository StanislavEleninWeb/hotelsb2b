"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { formatMoney } from "@hotel/shared";
import { ApiError, browserFetch } from "../../lib/api";
import type { BookingView } from "../../lib/types";

export default function AccountPage() {
  const bookings = useQuery({
    queryKey: ["my-bookings"],
    queryFn: () => browserFetch<BookingView[]>("/bookings/mine"),
    retry: false,
  });

  if (bookings.isLoading) return <p>Loading your bookings…</p>;

  if (bookings.isError) {
    const unauthorized = bookings.error instanceof ApiError && bookings.error.status === 401;
    return (
      <div className="card">
        <p className="error">{unauthorized ? "Please sign in to view your bookings." : (bookings.error as Error).message}</p>
        <Link className="btn" href="/account/login">
          Sign in
        </Link>
      </div>
    );
  }

  const list = bookings.data ?? [];
  return (
    <>
      <h1>My bookings</h1>
      {list.length === 0 && <p className="muted">You have no bookings yet.</p>}
      {list.map((b) => (
        <div className="card" key={b.id}>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <div>
              <strong>{b.property?.name ?? "Booking"}</strong>
              <div className="muted">
                {b.checkIn} → {b.checkOut} · {b.rooms.length} room(s)
              </div>
              <div className="muted">Confirmation {b.confirmationCode} · {b.status.replace("_", " ").toLowerCase()}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div className="price">{formatMoney(b.totalMinor, b.currency)}</div>
              <Link className="btn" href={`/account/bookings/${b.id}`}>
                Manage
              </Link>
            </div>
          </div>
        </div>
      ))}
    </>
  );
}
