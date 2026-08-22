import { API_BASE, API_BASE_SERVER } from "./config";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function parse<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = Array.isArray(body?.message)
      ? body.message.join(", ")
      : (body?.message ?? `Request failed (${res.status})`);
    throw new ApiError(res.status, message);
  }
  return body as T;
}

// Server-side read for SSR pages. `revalidate` opts in to caching where the route
// allows it (nonce CSP forces dynamic, so this is mostly no-store in practice).
export async function serverGet<T>(path: string, revalidate?: number): Promise<T> {
  const res = await fetch(`${API_BASE_SERVER}${path}`, {
    headers: { accept: "application/json" },
    ...(revalidate === undefined ? { cache: "no-store" } : { next: { revalidate } }),
  });
  return parse<T>(res);
}

function csrfToken(): string | undefined {
  if (typeof document === "undefined") return undefined;
  return document.cookie
    .split("; ")
    .find((c) => c.startsWith("csrf_token="))
    ?.split("=")[1];
}

// Browser fetch: cookie session (credentials) + CSRF header for mutations.
export async function browserFetch<T>(
  path: string,
  opts: { method?: string; body?: unknown; idempotencyKey?: string } = {},
): Promise<T> {
  const method = opts.method ?? "GET";
  const headers: Record<string, string> = { accept: "application/json" };
  if (opts.body !== undefined) headers["content-type"] = "application/json";
  if (method !== "GET") {
    const token = csrfToken();
    if (token) headers["x-csrf-token"] = token;
  }
  if (opts.idempotencyKey) headers["idempotency-key"] = opts.idempotencyKey;

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    credentials: "include",
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  return parse<T>(res);
}
