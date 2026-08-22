// One definition of the web security policy, consumed by every Next app's
// middleware (guest web + staff). Pure string builder — no React/Next deps — so it
// belongs here rather than being copy-pasted per app (where a CSP fix in one would
// miss the other).

export interface CspOptions {
  nonce: string;
  apiOrigin: string;
  // `next dev` uses eval for HMR/source-maps; allow it in development ONLY.
  dev?: boolean;
  // Extra sources per directive, added when a phase needs them (Stripe, ElevenLabs).
  extra?: Partial<Record<string, string[]>>;
}

export function buildContentSecurityPolicy({ nonce, apiOrigin, dev, extra }: CspOptions): string {
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'", ...(dev ? ["'unsafe-eval'"] : [])],
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
  for (const [key, values] of Object.entries(extra ?? {})) {
    directives[key] = [...(directives[key] ?? []), ...(values ?? [])];
  }
  return Object.entries(directives)
    .map(([k, v]) => `${k} ${v.join(" ")}`)
    .join("; ");
}

// Non-CSP security headers, identical across apps.
export const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
};
