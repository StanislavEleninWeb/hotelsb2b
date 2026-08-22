import { HealthResponseSchema } from "@hotel/shared";

// Phase 0 placeholder. Proves @hotel/shared (ESM build) imports into the staff app.
export default function Home() {
  const health = HealthResponseSchema.parse({
    status: "ok",
    service: "staff",
    timestamp: new Date().toISOString(),
  });

  return (
    <main style={{ fontFamily: "system-ui", padding: "2rem" }}>
      <h1>Hotel Booking — Staff Panel</h1>
      <p>Scaffold OK. Shared schema resolves: {health.service} / {health.status}</p>
    </main>
  );
}
