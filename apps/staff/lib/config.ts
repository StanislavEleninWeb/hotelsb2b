// Browser calls go straight to the API origin (CORS). Server-side (SSR) calls can
// use an internal URL. Both default to local dev.
export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000/api/v1";
export const API_BASE_SERVER = process.env.API_BASE_URL ?? API_BASE;
