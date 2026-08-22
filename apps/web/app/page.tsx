import { HealthResponseSchema } from "@hotel/shared";

// Phase 0 placeholder. Proves @hotel/shared (ESM build) imports into Next.js.
export default function Home() {
  const health = HealthResponseSchema.parse({
    status: "ok",
    service: "web",
    timestamp: new Date().toISOString(),
  });

  return (
    <main style={{ fontFamily: "system-ui", padding: "2rem" }}>
      <h1>Hotel Booking — Guest Web</h1>
      <p>Scaffold OK. Shared schema resolves: {health.service} / {health.status}</p>
    </main>
  );
}
