import { NextRequest, NextResponse } from "next/server";

// Security headers for every response (§5.2). A per-request nonce drives a strict
// CSP (script-src 'strict-dynamic' + nonce, no unsafe-inline) — Next propagates
// the nonce to its own scripts automatically. This forces dynamic rendering, so
// per-route ISR is deferred (nonce and cached HTML are mutually exclusive); SSR +
// metadata still deliver crawlable pages.
//
// Third-party slots (empty until the phase that needs them):
//   Stripe (Phase 8): script-src https://js.stripe.com ; frame-src https://js.stripe.com https://hooks.stripe.com
//   ElevenLabs widget (Phase 8): connect-src / frame-src for its origins
function buildCsp(nonce: string, apiOrigin: string): string {
  // `next dev` uses eval for HMR/source-maps; allow it in development ONLY.
  // Production builds contain no eval, so the strict policy applies there.
  const devEval = process.env.NODE_ENV === "development" ? ["'unsafe-eval'"] : [];
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'", ...devEval],
    "style-src": ["'self'", "'unsafe-inline'"], // Next injects inline styles
    "img-src": ["'self'", "data:", "https:"],
    "font-src": ["'self'"],
    "connect-src": ["'self'", apiOrigin],
    "frame-src": ["'none'"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
  };
  return Object.entries(directives)
    .map(([k, v]) => `${k} ${v.join(" ")}`)
    .join("; ");
}

export function middleware(request: NextRequest): NextResponse {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const apiOrigin = process.env.NEXT_PUBLIC_API_ORIGIN ?? "http://localhost:4000";

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", buildCsp(nonce, apiOrigin));
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  return response;
}

export const config = {
  // Skip static assets and Next internals.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
