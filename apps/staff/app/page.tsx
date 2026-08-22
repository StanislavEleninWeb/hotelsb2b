"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ApiError, browserFetch } from "../lib/api";
import type { AuthUser, PropertySummary } from "../lib/types";

export default function Dashboard() {
  const me = useQuery({
    queryKey: ["me"],
    queryFn: () => browserFetch<AuthUser>("/auth/me"),
    retry: false,
  });
  const properties = useQuery({
    queryKey: ["properties"],
    queryFn: () => browserFetch<PropertySummary[]>("/properties"),
    enabled: me.isSuccess,
  });

  if (me.isLoading) return <p>Loading…</p>;
  if (me.isError) {
    const unauth = me.error instanceof ApiError && me.error.status === 401;
    return (
      <div className="card">
        <p className="error">{unauth ? "Please sign in to continue." : (me.error as Error).message}</p>
        <Link className="btn" href="/login">Sign in</Link>
      </div>
    );
  }

  return (
    <>
      <h1>Properties</h1>
      <p className="muted">
        Signed in as {me.data?.email} · role <strong>{me.data?.role}</strong>
      </p>
      <div className="grid">
        {(properties.data ?? []).map((p) => (
          <div className="card" key={p.id}>
            <h2 style={{ marginTop: 0 }}>{p.name}</h2>
            {p.city && <p className="muted">{p.city}</p>}
            <Link className="btn" href={`/property/${p.id}`}>Manage</Link>
          </div>
        ))}
      </div>
      <p className="muted">
        You can open any property, but actions are blocked server-side for properties you aren’t
        scoped to (BOLA).
      </p>
    </>
  );
}
