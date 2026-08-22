"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError, browserFetch } from "../../../lib/api";
import type { GuestProfile } from "../../../lib/types";

export default function GuestProfilePage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const [note, setNote] = useState("");
  const [propertyId, setPropertyId] = useState("");

  const profile = useQuery({
    queryKey: ["guest", id],
    queryFn: () => browserFetch<GuestProfile>(`/guests/${id}`),
    retry: false,
  });

  const addNote = useMutation({
    mutationFn: () => browserFetch(`/guests/${id}/notes`, { method: "POST", body: { propertyId, body: note } }),
    onSuccess: () => {
      setNote("");
      void qc.invalidateQueries({ queryKey: ["guest", id] });
    },
  });

  if (profile.isLoading) return <p>Loading…</p>;
  if (profile.isError) {
    const status = profile.error instanceof ApiError ? profile.error.status : 0;
    return (
      <div className="card">
        <p className="error">{status === 401 ? "Please sign in." : (profile.error as Error).message}</p>
        <Link className="btn" href="/login">Sign in</Link>
      </div>
    );
  }

  const p = profile.data!;
  // Distinct properties from the guest's (scope-filtered) bookings, for note attribution.
  const properties = Array.from(
    new Map(p.bookings.map((b) => [(b as { propertyId?: string }).propertyId, b.property?.name])).entries(),
  ).filter(([pid]) => pid);

  return (
    <>
      <h1>{p.guest.firstName} {p.guest.lastName}</h1>
      <p className="muted">
        {p.guest.email ?? "no email"} · {p.guest.phone ?? "no phone"} ·{" "}
        {p.guest.isAccount ? "account holder" : "guest contact"}
      </p>

      <h2>Booking history</h2>
      <p className="muted">Only bookings at properties you’re scoped to are shown.</p>
      {p.bookings.length === 0 && <p className="muted">No bookings visible.</p>}
      {p.bookings.map((b) => (
        <div className="card" key={b.id}>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <div>
              <strong>{b.confirmationCode}</strong> · {b.status.replace("_", " ").toLowerCase()}
              <div className="muted">{b.property?.name} · {b.checkIn} → {b.checkOut}</div>
            </div>
            <Link className="btn" href={`/booking/${b.id}`}>Open</Link>
          </div>
        </div>
      ))}

      <h2>Internal notes</h2>
      {p.notes.map((n) => (
        <div className="card" key={n.id}>
          <div>{n.body}</div>
          <div className="muted">{new Date(n.createdAt).toLocaleString()}</div>
        </div>
      ))}

      {properties.length > 0 && (
        <form
          className="card"
          onSubmit={(e) => {
            e.preventDefault();
            if (propertyId && note) addNote.mutate();
          }}
        >
          <h2 style={{ marginTop: 0 }}>Add a note</h2>
          <div className="field">
            <label htmlFor="prop">Property</label>
            <select id="prop" value={propertyId} onChange={(e) => setPropertyId(e.target.value)}>
              <option value="">Select…</option>
              {properties.map(([pid, name]) => (
                <option key={pid} value={pid as string}>{name}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="note">Note</label>
            <input id="note" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          {addNote.isError && <p className="error">{(addNote.error as Error).message}</p>}
          <button type="submit" disabled={addNote.isPending} style={{ marginTop: "0.5rem" }}>Add note</button>
        </form>
      )}
    </>
  );
}
