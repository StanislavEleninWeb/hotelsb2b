"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatMoney } from "@hotel/shared";
import { ApiError, browserFetch } from "../../../lib/api";
import type { RatePlan } from "../../../lib/types";

type RatePlanWithType = RatePlan & { roomType?: { name: string } };

export default function RatesPage() {
  const { propertyId } = useParams<{ propertyId: string }>();
  const qc = useQueryClient();
  const [edits, setEdits] = useState<Record<string, string>>({});

  const plans = useQuery({
    queryKey: ["rate-plans", propertyId],
    queryFn: () => browserFetch<RatePlanWithType[]>(`/rate-plans/by-property/${propertyId}`),
    retry: false,
  });

  const save = useMutation({
    mutationFn: (v: { id: string; basePriceMinor: number }) =>
      browserFetch(`/rate-plans/${v.id}`, { method: "PATCH", body: { basePriceMinor: v.basePriceMinor } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rate-plans", propertyId] }),
  });
  const toggle = useMutation({
    mutationFn: (v: { id: string; active: boolean }) =>
      browserFetch(`/rate-plans/${v.id}`, { method: "PATCH", body: { active: v.active } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rate-plans", propertyId] }),
  });

  if (plans.isLoading) return <p>Loading…</p>;
  if (plans.isError) {
    const status = plans.error instanceof ApiError ? plans.error.status : 0;
    return (
      <div className="card">
        <p className="error">
          {status === 401 ? "Please sign in." : status === 403 ? "Not authorized for this property (or role)." : (plans.error as Error).message}
        </p>
        <Link href="/">← Back</Link>
      </div>
    );
  }

  return (
    <>
      <p><Link href={`/property/${propertyId}`}>← Property</Link></p>
      <h1>Rate plans</h1>
      {(plans.data ?? []).map((rp) => (
        <div className="card" key={rp.id}>
          <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <strong>{rp.roomType?.name}</strong> — {rp.name}{" "}
              <span className={`badge ${rp.cancellationPolicy === "REFUNDABLE" ? "refundable" : "nonref"}`}>
                {rp.cancellationPolicy === "REFUNDABLE" ? "refundable" : "non-refundable"}
              </span>
              {!rp.active && <span className="badge" style={{ marginLeft: "0.5rem" }}>inactive</span>}
              <div className="muted">Current: {formatMoney(rp.basePriceMinor, rp.currency)} / night</div>
            </div>
            <div className="row" style={{ alignItems: "end" }}>
              <div className="field" style={{ maxWidth: 140 }}>
                <label htmlFor={`p-${rp.id}`}>New price (minor)</label>
                <input
                  id={`p-${rp.id}`}
                  type="number"
                  value={edits[rp.id] ?? String(rp.basePriceMinor)}
                  onChange={(e) => setEdits({ ...edits, [rp.id]: e.target.value })}
                />
              </div>
              <button
                type="button"
                onClick={() => save.mutate({ id: rp.id, basePriceMinor: Number(edits[rp.id] ?? rp.basePriceMinor) })}
              >
                Save
              </button>
              <button className="secondary" type="button" onClick={() => toggle.mutate({ id: rp.id, active: !rp.active })}>
                {rp.active ? "Deactivate" : "Activate"}
              </button>
            </div>
          </div>
        </div>
      ))}
      {(save.isError || toggle.isError) && (
        <p className="error">{((save.error ?? toggle.error) as Error).message}</p>
      )}
    </>
  );
}
