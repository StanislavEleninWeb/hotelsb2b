import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatMoney } from "@hotel/shared";
import { serverGet } from "../../../lib/api";
import { ApiError } from "../../../lib/api";
import type { AvailabilityResult, PropertyDetail } from "../../../lib/types";
import { SearchForm } from "../../_components/search-form";

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

async function getProperty(slug: string): Promise<PropertyDetail | null> {
  try {
    return await serverGet<PropertyDetail>(`/properties/by-slug/${encodeURIComponent(slug)}`);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const property = await getProperty(slug).catch(() => null);
  if (!property) return { title: "Property not found" };
  return {
    title: property.name,
    description: property.description ?? `Book ${property.name}`,
    alternates: { canonical: `/property/${property.slug}` },
  };
}

export default async function PropertyPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<SP>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const property = await getProperty(slug);
  if (!property) notFound();

  const checkIn = one(sp.checkIn) ?? "";
  const checkOut = one(sp.checkOut) ?? "";
  const adults = one(sp.adults) ?? "2";
  const children = one(sp.children) ?? "0";
  const datesValid = /^\d{4}-\d{2}-\d{2}$/.test(checkIn) && /^\d{4}-\d{2}-\d{2}$/.test(checkOut) && checkOut > checkIn;

  const availabilityByType = new Map<string, AvailabilityResult>();
  if (datesValid) {
    const qs = new URLSearchParams({ propertyId: property.id, checkIn, checkOut, adults, children });
    const avail = await serverGet<AvailabilityResult[]>(`/availability?${qs}`).catch(
      () => [] as AvailabilityResult[],
    );
    for (const a of avail) availabilityByType.set(a.roomTypeId, a);
  }

  return (
    <>
      <p>
        <Link href="/search">← Back to search</Link>
      </p>
      <h1>{property.name}</h1>
      {property.city && <p className="muted">{property.city}</p>}
      {/* Guest-provided / CMS text — rendered as plain text (React escapes it); never dangerouslySetInnerHTML. */}
      {property.description && <p>{property.description}</p>}

      {property.amenities.length > 0 && (
        <ul className="clean">
          {property.amenities.map((a) => (
            <li className="badge" key={a.amenity.code}>
              {a.amenity.name}
            </li>
          ))}
        </ul>
      )}

      <div className="card">
        <strong>Choose your dates</strong>
        <div style={{ marginTop: "0.5rem" }}>
          <SearchForm defaults={{ checkIn, checkOut, adults, children }} />
        </div>
      </div>

      <h2>Rooms</h2>
      {property.roomTypes.map((rt) => {
        const avail = availabilityByType.get(rt.id);
        return (
          <div className="card" key={rt.id}>
            <h2 style={{ marginTop: 0 }}>{rt.name}</h2>
            {rt.bedConfig && <p className="muted">{rt.bedConfig} · sleeps {rt.maxAdults + rt.maxChildren}</p>}
            {rt.description && <p>{rt.description}</p>}
            {datesValid && avail && avail.availableRooms === 0 && (
              <p className="error">Sold out for these dates.</p>
            )}
            {rt.ratePlans.map((rp) => {
              const live = avail?.ratePlans.find((p) => p.ratePlanId === rp.id);
              const soldOut = datesValid && (!avail || avail.availableRooms === 0);
              return (
                <div
                  className="row"
                  key={rp.id}
                  style={{ justifyContent: "space-between", borderTop: "1px solid var(--border)", paddingTop: "0.6rem" }}
                >
                  <div>
                    <strong>{rp.name}</strong>{" "}
                    <span className={`badge ${rp.cancellationPolicy === "REFUNDABLE" ? "refundable" : "nonref"}`}>
                      {rp.cancellationPolicy === "REFUNDABLE" ? "Free cancellation" : "Non-refundable"}
                    </span>
                    {rp.includesBreakfast && <div className="muted">Breakfast included</div>}
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div className="price">
                      {live
                        ? `${formatMoney(live.priceMinor, live.currency)} total`
                        : `${formatMoney(rp.basePriceMinor, rp.currency)} / night`}
                    </div>
                    {datesValid && !soldOut ? (
                      <Link
                        className="btn"
                        href={`/book?propertyId=${property.id}&roomTypeId=${rt.id}&ratePlanId=${rp.id}&checkIn=${checkIn}&checkOut=${checkOut}&adults=${adults}&children=${children}`}
                      >
                        Book this rate
                      </Link>
                    ) : (
                      <span className="muted">Choose dates to book</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
    </>
  );
}
