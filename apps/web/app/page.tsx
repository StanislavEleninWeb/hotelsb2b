import Link from "next/link";
import { serverGet } from "../lib/api";
import type { PropertySummary } from "../lib/types";
import { SearchForm } from "./_components/search-form";

// SSR — property list is server-rendered for SEO (SD-08).
export default async function Home() {
  let properties: PropertySummary[] = [];
  let error: string | null = null;
  try {
    properties = await serverGet<PropertySummary[]>("/properties");
  } catch {
    error = "Could not load properties. Is the API running?";
  }

  return (
    <>
      <h1>Find your stay</h1>
      <div className="card">
        <SearchForm />
      </div>

      <h2>Our properties</h2>
      {error && <p className="error">{error}</p>}
      <div className="grid">
        {properties.map((p) => (
          <div className="card" key={p.id}>
            <h2 style={{ marginTop: 0 }}>
              <Link href={`/property/${p.slug}`}>{p.name}</Link>
            </h2>
            {p.city && <p className="muted">{p.city}</p>}
            {p.description && <p>{p.description}</p>}
            <Link className="btn" href={`/property/${p.slug}`}>
              View & book
            </Link>
          </div>
        ))}
      </div>
    </>
  );
}
