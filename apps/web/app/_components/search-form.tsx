"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

function isoDate(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

function nightsBetween(a: string, b: string): number {
  const d1 = new Date(a).getTime();
  const d2 = new Date(b).getTime();
  if (Number.isNaN(d1) || Number.isNaN(d2) || d2 <= d1) return 0;
  return Math.round((d2 - d1) / 86_400_000);
}

const cellLabel: React.CSSProperties = {
  fontSize: 10,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  color: "color-mix(in srgb, var(--color-text) 55%, transparent)",
  marginBottom: 8,
};
const bigVal: React.CSSProperties = {
  fontFamily: "var(--font-heading)",
  fontWeight: 800,
  fontSize: 22,
  border: 0,
  background: "transparent",
  padding: 0,
  width: "100%",
  color: "inherit",
};

function Stepper({
  value,
  min,
  max,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  const btn: React.CSSProperties = {
    width: 28,
    height: 28,
    border: "1px solid var(--color-divider)",
    background: "transparent",
    fontFamily: "var(--font-heading)",
    fontWeight: 800,
    fontSize: 15,
    cursor: "pointer",
    color: "inherit",
    lineHeight: 1,
  };
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <button type="button" style={btn} aria-label="decrease" onClick={() => onChange(Math.max(min, value - 1))}>
        –
      </button>
      <span className="num" style={{ fontSize: 22, minWidth: 20, textAlign: "center" }}>
        {value}
      </span>
      <button type="button" style={btn} aria-label="increase" onClick={() => onChange(Math.min(max, value + 1))}>
        +
      </button>
    </div>
  );
}

export function SearchForm({ defaults }: { defaults?: Partial<Record<string, string>> }) {
  const router = useRouter();
  const [checkIn, setCheckIn] = useState(defaults?.checkIn ?? isoDate(14));
  const [checkOut, setCheckOut] = useState(defaults?.checkOut ?? isoDate(16));
  const [adults, setAdults] = useState(Number(defaults?.adults ?? "2") || 2);
  const [children, setChildren] = useState(Number(defaults?.children ?? "0") || 0);
  const [destination, setDestination] = useState(defaults?.destination ?? "");

  const nights = nightsBetween(checkIn, checkOut);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams({
      checkIn,
      checkOut,
      adults: String(adults),
      children: String(children),
    });
    if (destination) params.set("destination", destination);
    router.push(`/search?${params.toString()}`);
  }

  return (
    <form onSubmit={submit}>
      <div
        className="stack-sm"
        style={{
          display: "grid",
          gridTemplateColumns: "2fr 1fr 1fr 1.4fr auto",
          alignItems: "stretch",
          borderTop: "2px solid var(--color-divider)",
          borderBottom: "2px solid var(--color-divider)",
        }}
      >
        <div style={{ padding: "24px 24px 24px 0" }}>
          <div style={cellLabel}>Destination</div>
          <input
            aria-label="Destination"
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            placeholder="Anywhere"
            style={bigVal}
          />
        </div>
        <div style={{ padding: 24, borderLeft: "1px solid var(--color-divider)" }}>
          <div style={cellLabel}>Check-in</div>
          <input aria-label="Check-in" type="date" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} style={bigVal} />
        </div>
        <div style={{ padding: 24, borderLeft: "1px solid var(--color-divider)" }}>
          <div style={cellLabel}>Check-out</div>
          <input aria-label="Check-out" type="date" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} style={bigVal} />
        </div>
        <div style={{ padding: 24, borderLeft: "1px solid var(--color-divider)", display: "flex", gap: 28, flexWrap: "wrap" }}>
          <div>
            <div style={cellLabel}>Adults</div>
            <Stepper value={adults} min={1} max={12} onChange={setAdults} />
          </div>
          <div>
            <div style={cellLabel}>Children</div>
            <Stepper value={children} min={0} max={12} onChange={setChildren} />
          </div>
        </div>
        <button
          type="submit"
          className="btn btn-primary"
          style={{ padding: "0 40px", borderRadius: 0, alignSelf: "stretch" }}
        >
          Search →
        </button>
      </div>
      <div style={{ padding: "12px 0 0", fontSize: 12, color: "color-mix(in srgb, var(--color-text) 55%, transparent)" }}>
        {nights > 0 ? `${nights} night${nights === 1 ? "" : "s"}` : "Select dates"} · {adults} adult
        {adults === 1 ? "" : "s"}
        {children > 0 ? `, ${children} child${children === 1 ? "" : "ren"}` : ""} · rates shown are totals, taxes included
      </div>
    </form>
  );
}
