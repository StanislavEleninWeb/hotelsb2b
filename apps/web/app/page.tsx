import Link from "next/link";
import { serverGet } from "../lib/api";
import type { PropertySummary } from "../lib/types";
import { SearchForm } from "./_components/search-form";
import { Photo } from "./_components/photo";

// SSR — property list is server-rendered for SEO (SD-08).
export default async function Home() {
  let properties: PropertySummary[] = [];
  let error: string | null = null;
  try {
    properties = await serverGet<PropertySummary[]>("/properties");
  } catch {
    error = "Could not load properties. Is the API running?";
  }

  const amenities = ["Free Wi-Fi", "Parking", "Swimming pool", "Breakfast", "Step-free access"];

  return (
    <>
      {/* Hero */}
      <section style={{ position: "relative", height: 600, overflow: "hidden", background: "var(--color-neutral-300)" }}>
        <div className="hs-kb" style={{ position: "absolute", inset: 0 }}>
          <Photo label="Waterfront exterior · dusk" height="100%" />
        </div>
        <div style={{ position: "absolute", left: 0, bottom: 0, padding: "40px var(--pad-x)" }}>
          <span
            style={{
              display: "inline-block",
              background: "var(--color-accent)",
              color: "var(--color-bg)",
              fontSize: 11,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              padding: "6px 12px",
            }}
          >
            Lisbon · Innsbruck
          </span>
        </div>
      </section>

      {/* Headline */}
      <section
        className="pad stack-sm"
        data-reveal
        style={{ padding: "56px var(--pad-x) 40px", display: "grid", gridTemplateColumns: "7fr 5fr", gap: 48, alignItems: "end" }}
      >
        <h1 style={{ fontSize: "clamp(44px, 6vw, 88px)", lineHeight: 0.95, letterSpacing: "-0.03em" }}>
          Rooms above
          <br />
          the water.
          <br />
          <span className="accent">Booked direct.</span>
        </h1>
        <p style={{ margin: 0, fontSize: 16, lineHeight: 1.6, color: "color-mix(in srgb, var(--color-text) 72%, transparent)" }}>
          Two properties, run by the people who own them. Real-time availability, the same rate the front desk sees, and no
          agency sitting between you and the room.
        </p>
      </section>

      <hr className="rule" style={{ margin: "0 var(--pad-x)" }} />

      {/* Stay picker */}
      <section className="pad" style={{ paddingTop: 24, paddingBottom: 0 }}>
        <SearchForm />
      </section>

      {/* Properties */}
      <section className="pad" data-reveal style={{ paddingTop: 72 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 16, marginBottom: 28, flexWrap: "wrap" }}>
          <h2 style={{ fontSize: 32 }}>The properties</h2>
          <span className="muted" style={{ fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase" }}>
            {properties.length > 0 ? `${properties.length} · both direct` : "Both direct"}
          </span>
        </div>

        {error && <p style={{ color: "var(--color-accent)" }}>{error}</p>}

        <div className="stack-sm" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2, background: "var(--color-divider)" }}>
          {properties.map((p) => (
            <div key={p.id} style={{ background: "var(--color-bg)" }}>
              <div style={{ height: 380 }}>
                <Photo label={p.name} height={380} />
              </div>
              <div style={{ padding: "24px 0 32px" }}>
                {p.city && <div className="kicker" style={{ marginBottom: 8 }}>{[p.city, p.countryCode].filter(Boolean).join(", ")}</div>}
                <h3 style={{ margin: "0 0 10px", fontSize: 30, letterSpacing: "-0.02em" }}>{p.name}</h3>
                {p.description && (
                  <p style={{ margin: "0 0 20px", fontSize: 15, maxWidth: "46ch", color: "color-mix(in srgb, var(--color-text) 70%, transparent)" }}>
                    {p.description}
                  </p>
                )}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "1px solid var(--color-hairline)", paddingTop: 16 }}>
                  <span className="muted" style={{ fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase" }}>
                    Book direct
                  </span>
                  <Link href={`/property/${p.slug}`} className="btn btn-primary">
                    View &amp; book
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Amenities strip */}
      <section className="pad" data-reveal style={{ padding: "64px var(--pad-x)" }}>
        <div
          className="stack-sm"
          style={{ display: "grid", gridTemplateColumns: `repeat(${amenities.length}, 1fr)`, borderTop: "2px solid var(--color-divider)", borderBottom: "2px solid var(--color-divider)" }}
        >
          {amenities.map((a, i) => (
            <div
              key={a}
              style={{
                padding: i === 0 ? "20px 20px 20px 0" : 20,
                borderLeft: i === 0 ? undefined : "1px solid var(--color-hairline)",
                fontSize: 13,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                fontFamily: "var(--font-heading)",
                fontWeight: 800,
              }}
            >
              {a}
            </div>
          ))}
        </div>
      </section>

      {/* CTA band */}
      <section
        className="pad stack-sm"
        data-reveal
        style={{ background: "var(--color-accent)", color: "var(--color-bg)", padding: "72px var(--pad-x)", display: "grid", gridTemplateColumns: "8fr 4fr", gap: 48, alignItems: "end" }}
      >
        <h2 style={{ fontSize: "clamp(36px, 5vw, 64px)", lineHeight: 1, letterSpacing: "-0.03em", color: "var(--color-bg)" }}>
          Book on the site
          <br />
          the front desk uses.
        </h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 16, alignItems: "flex-start" }}>
          <p style={{ margin: 0, fontSize: 15, lineHeight: 1.6, color: "color-mix(in srgb, #fff 88%, transparent)" }}>
            Same availability, same prices, same audit trail — whether you book here, call, or talk to the assistant.
          </p>
          <Link
            href="/search"
            className="btn"
            style={{ background: "var(--color-bg)", color: "var(--color-text)" }}
          >
            Check dates →
          </Link>
        </div>
      </section>
    </>
  );
}
