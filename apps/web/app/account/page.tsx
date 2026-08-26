"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { formatMoney } from "@hotel/shared";
import { ApiError, browserFetch } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import type { BookingView } from "../../lib/types";
import { Photo } from "../_components/photo";

type Tab = "upcoming" | "past" | "cancelled";

function statusTag(status: string): { label: string; cls: string } {
  switch (status) {
    case "CONFIRMED":
    case "CHECKED_IN":
    case "CHECKED_OUT":
      return { label: status === "CONFIRMED" ? "Confirmed" : status.replace("_", " ").toLowerCase(), cls: "tag-accent" };
    case "PENDING_PAYMENT":
      return { label: "Awaiting payment", cls: "tag-outline" };
    case "CANCELLED":
      return { label: "Cancelled", cls: "tag-neutral" };
    default:
      return { label: status.replace(/_/g, " ").toLowerCase(), cls: "tag-neutral" };
  }
}

function groupOf(b: BookingView, today: string): Tab {
  if (b.status === "CANCELLED") return "cancelled";
  return b.checkOut >= today ? "upcoming" : "past";
}

export default function AccountPage() {
  const { data: user } = useAuth();
  const [tab, setTab] = useState<Tab>("upcoming");

  const bookings = useQuery({
    queryKey: ["my-bookings"],
    queryFn: () => browserFetch<BookingView[]>("/bookings/mine"),
    retry: false,
  });

  const today = new Date().toISOString().slice(0, 10);
  const groups = useMemo(() => {
    const g: Record<Tab, BookingView[]> = { upcoming: [], past: [], cancelled: [] };
    for (const b of bookings.data ?? []) g[groupOf(b, today)].push(b);
    return g;
  }, [bookings.data, today]);

  if (bookings.isLoading) return <div className="pad" style={{ padding: "48px var(--pad-x)" }}><p className="muted">Loading your bookings…</p></div>;

  if (bookings.isError) {
    const unauthorized = bookings.error instanceof ApiError && bookings.error.status === 401;
    return (
      <div className="pad" style={{ padding: "56px var(--pad-x)", maxWidth: 520 }}>
        <p className="error">{unauthorized ? "Please sign in to view your bookings." : (bookings.error as Error).message}</p>
        <Link className="btn btn-primary" href="/account/login">Sign in</Link>
      </div>
    );
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: "upcoming", label: "Upcoming" },
    { key: "past", label: "Past" },
    { key: "cancelled", label: "Cancelled" },
  ];
  const list = groups[tab];

  return (
    <>
      <section className="pad" style={{ paddingTop: 48, display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 32, flexWrap: "wrap" }}>
        <div>
          {user?.email && <div className="kicker" style={{ marginBottom: 10 }}>{user.email}</div>}
          <h1 style={{ fontSize: "clamp(40px, 5vw, 56px)", letterSpacing: "-0.03em" }}>My bookings</h1>
        </div>
        <div style={{ display: "flex", border: "1px solid var(--color-divider)" }}>
          {tabs.map((t, i) => {
            const active = t.key === tab;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                style={{
                  minHeight: 44,
                  padding: "10px 18px",
                  fontSize: 12,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  fontFamily: "var(--font-heading)",
                  fontWeight: 800,
                  cursor: "pointer",
                  border: 0,
                  borderLeft: i === 0 ? undefined : "1px solid var(--color-divider)",
                  background: active ? "var(--color-accent)" : "transparent",
                  color: active ? "var(--color-bg)" : "color-mix(in srgb, var(--color-text) 72%, transparent)",
                }}
              >
                {t.label} {groups[t.key].length}
              </button>
            );
          })}
        </div>
      </section>

      <section className="pad" data-reveal style={{ paddingTop: 36, paddingBottom: 56 }}>
        {list.length === 0 ? (
          <p className="muted" style={{ borderTop: "2px solid var(--color-divider)", paddingTop: 28 }}>
            No {tab} bookings.
          </p>
        ) : (
          list.map((b, i) => {
            const tag = statusTag(b.status);
            const nights = Math.max(1, Math.round((Date.parse(b.checkOut) - Date.parse(b.checkIn)) / 86_400_000));
            const roomName = b.rooms[0]?.roomType?.name;
            return (
              <div
                className="stack-sm"
                key={b.id}
                style={{ display: "grid", gridTemplateColumns: "200px 1fr", gap: 32, padding: "28px 0", borderTop: i === 0 ? "2px solid var(--color-divider)" : "1px solid var(--color-hairline)", alignItems: "center" }}
              >
                <Photo label={b.property?.name ?? "Stay"} height={140} />
                <div className="stack-sm" style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: 28, alignItems: "center" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6, flexWrap: "wrap" }}>
                      <h3 style={{ margin: 0, fontSize: 24 }}>{b.property?.name ?? "Booking"}</h3>
                      <span className={`tag ${tag.cls}`}>{tag.label}</span>
                    </div>
                    <div style={{ fontSize: 14, color: "color-mix(in srgb, var(--color-text) 70%, transparent)" }}>
                      {b.checkIn} → {b.checkOut} · {nights} night{nights === 1 ? "" : "s"}
                      {roomName ? ` · ${roomName}` : ""} · {b.adults} adult{b.adults === 1 ? "" : "s"}
                      {b.children > 0 ? `, ${b.children} child${b.children === 1 ? "" : "ren"}` : ""}
                    </div>
                    <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>Confirmation {b.confirmationCode}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div className="num" style={{ fontSize: 30 }}>{formatMoney(b.totalMinor, b.currency)}</div>
                    <div className="muted" style={{ fontSize: 11 }}>
                      {b.status === "PENDING_PAYMENT" ? "Not yet charged" : "Paid in full"}
                    </div>
                  </div>
                  <Link className="btn btn-primary" href={`/account/bookings/${b.id}`}>Manage</Link>
                </div>
              </div>
            );
          })
        )}
      </section>
    </>
  );
}
