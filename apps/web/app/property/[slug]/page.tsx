import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatMoney } from "@hotel/shared";
import { serverGet, ApiError } from "../../../lib/api";
import type { AvailabilityResult, PropertyDetail } from "../../../lib/types";
import { SearchForm } from "../../_components/search-form";
import { Photo } from "../../_components/photo";

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

function nights(a: string, b: string): number {
  const d = (Date.parse(b) - Date.parse(a)) / 86_400_000;
  return Number.isFinite(d) && d > 0 ? Math.round(d) : 0;
}

async function getProperty(slug: string): Promise<PropertyDetail | null> {
  try {
    return await serverGet<PropertyDetail>(`/properties/by-slug/${encodeURIComponent(slug)}`);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const property = await getProperty(slug).catch(() => null);
  if (!property) return { title: "Property not found" };
  return {
    title: property.name,
    description: property.description ?? `Book ${property.name}`,
    alternates: { canonical: `/property/${property.slug}` },
  };
}

const infoLabel: React.CSSProperties = {
  fontSize: 10,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  color: "var(--color-accent-text)",
  marginBottom: 6,
};

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
  const datesValid =
    /^\d{4}-\d{2}-\d{2}$/.test(checkIn) && /^\d{4}-\d{2}-\d{2}$/.test(checkOut) && checkOut > checkIn;
  const nightCount = datesValid ? nights(checkIn, checkOut) : 0;

  const availabilityByType = new Map<string, AvailabilityResult>();
  if (datesValid) {
    const qs = new URLSearchParams({ propertyId: property.id, checkIn, checkOut, adults, children });
    const avail = await serverGet<AvailabilityResult[]>(`/availability?${qs}`).catch(() => [] as AvailabilityResult[]);
    for (const a of avail) availabilityByType.set(a.roomTypeId, a);
  }

  const heroImg = property.images[0]?.url;

  return (
    <>
      {/* Image mosaic */}
      <div
        className="stack-sm"
        style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gridTemplateRows: "240px 240px", gap: 2, background: "var(--color-divider)" }}
      >
        <div style={{ gridRow: "span 2" }}>
          <Photo src={heroImg} alt={property.images[0]?.alt} label={`${property.name} — room`} height="100%" />
        </div>
        <Photo src={property.images[1]?.url} label="Pool" height="100%" />
        <Photo src={property.images[2]?.url} label="Breakfast room" height="100%" />
      </div>

      <section className="pad stack-sm" style={{ paddingTop: 44, display: "grid", gridTemplateColumns: "8fr 4fr", gap: 56 }}>
        <div>
          <Link href="/search" className="backlink">
            ← All stays
          </Link>
          {property.city && (
            <div className="kicker" style={{ margin: "24px 0 10px" }}>
              {[property.city, property.countryCode].filter(Boolean).join(", ")}
            </div>
          )}
          <h1 style={{ fontSize: "clamp(40px, 5vw, 62px)", lineHeight: 1, letterSpacing: "-0.03em", marginBottom: 16 }}>
            {property.name}
          </h1>
          {/* Guest / CMS text — React escapes it; never dangerouslySetInnerHTML. */}
          {property.description && (
            <p style={{ margin: "0 0 28px", fontSize: 17, lineHeight: 1.6, maxWidth: "58ch", color: "color-mix(in srgb, var(--color-text) 75%, transparent)" }}>
              {property.description}
            </p>
          )}
          {property.amenities.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {property.amenities.map((a) => (
                <span className="tag tag-outline" key={a.amenity.code}>
                  {a.amenity.name}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Your stay */}
        <aside style={{ borderLeft: "2px solid var(--color-divider)", paddingLeft: 32 }}>
          <div style={{ fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: "color-mix(in srgb, var(--color-text) 72%, transparent)", marginBottom: 16 }}>
            Your stay
          </div>
          {datesValid ? (
            <>
              <StayRow label="Check-in" value={checkIn} />
              <StayRow label="Check-out" value={checkOut} />
              <StayRow label="Guests" value={`${adults} adult${adults === "1" ? "" : "s"}${Number(children) > 0 ? `, ${children} ch.` : ""}`} />
              <StayRow label="Nights" value={String(nightCount)} last />
            </>
          ) : (
            <p className="muted" style={{ fontSize: 14, margin: "0 0 16px" }}>Pick your dates below to see live prices and availability.</p>
          )}
        </aside>
      </section>

      {/* Date picker */}
      <section className="pad" style={{ paddingTop: 40 }}>
        <div style={{ fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: "color-mix(in srgb, var(--color-text) 72%, transparent)", marginBottom: 8 }}>
          Choose your dates
        </div>
        <SearchForm defaults={{ checkIn, checkOut, adults, children }} />
      </section>

      {/* Rooms */}
      <section className="pad" data-reveal style={{ paddingTop: 64, paddingBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 16, borderBottom: "2px solid var(--color-divider)", paddingBottom: 16, flexWrap: "wrap" }}>
          <h2 style={{ fontSize: 32 }}>Rooms</h2>
          <span className="muted" style={{ marginLeft: "auto", fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase" }}>
            {datesValid ? `Totals for ${nightCount} night${nightCount === 1 ? "" : "s"}` : "Prices per night"}
          </span>
        </div>

        {property.roomTypes.map((rt) => {
          const avail = availabilityByType.get(rt.id);
          const soldOut = datesValid && (!avail || avail.availableRooms === 0);
          const few = datesValid && avail && avail.availableRooms > 0 && avail.availableRooms <= 3;
          return (
            <div className="stack-sm" key={rt.id} style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 32, padding: "32px 0", borderBottom: "1px solid var(--color-hairline)" }}>
              <Photo src={rt.images[0]?.url} alt={rt.images[0]?.alt} label={rt.name} height={220} />
              <div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 6, flexWrap: "wrap" }}>
                  <h3 style={{ margin: 0, fontSize: 26 }}>{rt.name}</h3>
                  <span className="muted" style={{ fontSize: 12 }}>
                    {[rt.bedConfig, `sleeps ${rt.maxAdults + rt.maxChildren}`].filter(Boolean).join(" · ")}
                  </span>
                  {few && <span className="tag tag-accent" style={{ marginLeft: "auto" }}>{avail!.availableRooms} left for these dates</span>}
                  {soldOut && <span className="tag tag-neutral" style={{ marginLeft: "auto" }}>Sold out for these dates</span>}
                </div>
                {rt.description && (
                  <p style={{ margin: "0 0 20px", fontSize: 14, color: "color-mix(in srgb, var(--color-text) 68%, transparent)" }}>{rt.description}</p>
                )}

                {rt.ratePlans.map((rp) => {
                  const live = avail?.ratePlans.find((p) => p.ratePlanId === rp.id);
                  const canBook = datesValid && !soldOut;
                  return (
                    <div
                      className="stack-sm"
                      key={rp.id}
                      style={{ display: "grid", gridTemplateColumns: "1fr auto auto", alignItems: "center", gap: 24, padding: "16px 0", borderTop: "1px solid var(--color-hairline)" }}
                    >
                      <div>
                        <div className="num" style={{ fontSize: 16 }}>{rp.name}</div>
                        <div className="muted" style={{ fontSize: 12 }}>
                          {rp.cancellationPolicy === "REFUNDABLE" ? "Free cancellation" : "Non-refundable"}
                          {rp.includesBreakfast ? " · breakfast included" : " · room only"}
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div className="num" style={{ fontSize: 24 }}>
                          {live ? formatMoney(live.priceMinor, live.currency) : formatMoney(rp.basePriceMinor, rp.currency)}
                        </div>
                        <div className="muted" style={{ fontSize: 11 }}>
                          {live ? `${nightCount} night${nightCount === 1 ? "" : "s"}` : "per night"}
                        </div>
                      </div>
                      {canBook ? (
                        <Link
                          className={`btn ${rp.cancellationPolicy === "REFUNDABLE" ? "btn-primary" : "btn-outline"}`}
                          href={`/book?propertyId=${property.id}&roomTypeId=${rt.id}&ratePlanId=${rp.id}&checkIn=${checkIn}&checkOut=${checkOut}&adults=${adults}&children=${children}`}
                        >
                          Book this rate
                        </Link>
                      ) : (
                        <span className="muted" style={{ fontSize: 12 }}>Choose dates to book</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </section>

      {/* Info strip */}
      <section className="pad" style={{ paddingBottom: 56 }}>
        <div className="stack-sm" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", borderTop: "2px solid var(--color-divider)" }}>
          <div style={{ padding: "20px 20px 20px 0" }}>
            <div style={infoLabel}>Payment</div>
            <div style={{ fontSize: 14 }}>Pay in full now, or at the property on Flexible rates</div>
          </div>
          <div style={{ padding: 20, borderLeft: "1px solid var(--color-hairline)" }}>
            <div style={infoLabel}>Currency</div>
            <div style={{ fontSize: 14 }}>{property.currency} · charged in {property.currency}</div>
          </div>
        </div>
      </section>
    </>
  );
}

function StayRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline",
        padding: "12px 0",
        borderBottom: last ? undefined : "1px solid var(--color-hairline)",
      }}
    >
      <span className="muted" style={{ fontSize: 13 }}>{label}</span>
      <span className="num" style={{ fontSize: 18 }}>{value}</span>
    </div>
  );
}
