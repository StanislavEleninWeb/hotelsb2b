"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

function isoDate(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

export function SearchForm({ defaults }: { defaults?: Partial<Record<string, string>> }) {
  const router = useRouter();
  const [checkIn, setCheckIn] = useState(defaults?.checkIn ?? isoDate(14));
  const [checkOut, setCheckOut] = useState(defaults?.checkOut ?? isoDate(16));
  const [adults, setAdults] = useState(defaults?.adults ?? "2");
  const [children, setChildren] = useState(defaults?.children ?? "0");
  const [destination, setDestination] = useState(defaults?.destination ?? "");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams({ checkIn, checkOut, adults, children });
    if (destination) params.set("destination", destination);
    router.push(`/search?${params.toString()}`);
  }

  return (
    <form className="row" onSubmit={submit}>
      <div className="field">
        <label htmlFor="destination">Destination (optional)</label>
        <input
          id="destination"
          value={destination}
          onChange={(e) => setDestination(e.target.value)}
          placeholder="City or hotel"
        />
      </div>
      <div className="field">
        <label htmlFor="checkIn">Check-in</label>
        <input id="checkIn" type="date" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="checkOut">Check-out</label>
        <input id="checkOut" type="date" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} />
      </div>
      <div className="field" style={{ maxWidth: 90 }}>
        <label htmlFor="adults">Adults</label>
        <input id="adults" type="number" min={1} max={20} value={adults} onChange={(e) => setAdults(e.target.value)} />
      </div>
      <div className="field" style={{ maxWidth: 90 }}>
        <label htmlFor="children">Children</label>
        <input id="children" type="number" min={0} max={20} value={children} onChange={(e) => setChildren(e.target.value)} />
      </div>
      <button type="submit">Search</button>
    </form>
  );
}
