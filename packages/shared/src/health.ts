import { z } from "zod";

// Trivial schema used by every app in Phase 0 to prove @hotel/shared imports
// cleanly from NestJS (CJS) and both Next.js apps (ESM).
export const HealthResponseSchema = z.object({
  status: z.literal("ok"),
  service: z.string(),
  timestamp: z.string().datetime(),
});

export type HealthResponse = z.infer<typeof HealthResponseSchema>;
