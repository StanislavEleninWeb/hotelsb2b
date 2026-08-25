import { NextRequest, NextResponse } from "next/server";
import { buildContentSecurityPolicy, SECURITY_HEADERS } from "@hotel/shared/security";

// Security headers for every response (§5.2). Policy is defined once in
// @hotel/shared and shared with the staff app. A per-request nonce drives a strict
// CSP (no unsafe-inline for scripts) — Next propagates the nonce to its scripts,
// which forces dynamic rendering, so per-route ISR is deferred; SSR still crawlable.
export function middleware(request: NextRequest): NextResponse {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const apiOrigin = process.env.NEXT_PUBLIC_API_ORIGIN ?? "http://localhost:4000";

  const csp = buildContentSecurityPolicy({
    nonce,
    apiOrigin,
    dev: process.env.NODE_ENV === "development",
  });

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  // Next reads the nonce from the REQUEST's CSP header and applies it to its own
  // <script> tags (and opts the route out of static generation). Without this the
  // nonce never reaches the scripts and a strict CSP blocks ALL of them in prod.
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) response.headers.set(k, v);
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
