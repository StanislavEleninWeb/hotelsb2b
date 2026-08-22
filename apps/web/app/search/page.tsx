import Link from "next/link";
import { formatMoney } from "@hotel/shared";
import { serverGet } from "../../lib/api";
import type { AvailabilityResult, PropertySummary } from "../../lib/types";
import { SearchForm } from "../_components/search-form";

export const metadata = { title: "Search results" };

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

interface SearchRow {
  property: PropertySummary;
  availability: AvailabilityResult[];
}

// SSR results (SD-01/SD-04). Uses the Phase 7 GET /search endpoint — Postgres FTS
// destination search with availability computed server-side in one call (no N+1).
export default async function SearchPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const checkIn = one(sp.checkIn) ?? "";
  const checkOut = one(sp.checkOut) ?? "";
  const adults = one(sp.adults) ?? "2";
  const children = one(sp.children) ?? "0";
  const destination = one(sp.destination) ?? "";

  const valid = /^\d{4}-\d{2}-\d{2}$/.test(checkIn) && /^\d{4}-\d{2}-\d{2}$/.test(checkOut) && checkOut > checkIn;

  const qs = new URLSearchParams({ adults, children });
  if (destination) qs.set("destination", destination);
  if (valid) {
    qs.set("checkIn", checkIn);
    qs.set("checkOut", checkOut);
  }
  const results = await serverGet<SearchRow[]>(`/search?${qs}`).catch(() => [] as SearchRow[]);

  return (
    <>
      <h1>Search</h1>
      <div className="card">
        <SearchForm defaults={{ checkIn, checkOut, adults, children, destination: one(sp.destination) }} />
      </div>

      {!valid && <p className="error">Please choose a valid check-in and check-out date.</p>}

      {valid &&
        results.map(({ property, availability }) => (
          <div className="card" key={property.id}>
            <h2 style={{ marginTop: 0 }}>
              <Link href={`/property/${property.slug}`}>{property.name}</Link>
            </h2>
            {property.city && <p className="muted">{property.city}</p>}
            {availability.length === 0 && <p className="muted">No rooms available for these dates.</p>}
            {availability.map((rt) => {
              const cheapest = rt.ratePlans.length
                ? rt.ratePlans.reduce((min, r) => (r.priceMinor < min.priceMinor ? r : min))
                : undefined;
              return (
                <div className="row" key={rt.roomTypeId} style={{ justifyContent: "space-between", borderTop: "1px solid var(--border)", paddingTop: "0.75rem" }}>
                  <div>
                    <strong>{rt.roomTypeName}</strong>
                    <div className="muted">{rt.availableRooms} room(s) left</div>
                  </div>
                  {cheapest && (
                    <div style={{ textAlign: "right" }}>
                      <div className="price">{formatMoney(cheapest.priceMinor, cheapest.currency)}</div>
                      <div className="muted">total · {rt.ratePlans.length} rate plan(s)</div>
                      <Link
                        className="btn"
                        href={`/property/${property.slug}?checkIn=${checkIn}&checkOut=${checkOut}&adults=${adults}&children=${children}`}
                      >
                        Select
                      </Link>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
    </>
  );
}
