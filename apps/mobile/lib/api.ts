import { API_BASE } from './config';
import { clearTokens, getAccessToken, getRefreshToken, setTokens } from './tokens';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

interface TokenResponse {
  user: { kind: 'guest' | 'staff'; id: string; email: string | null };
  accessToken: string;
  refreshToken: string;
}

async function parse<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = Array.isArray(body?.message) ? body.message.join(', ') : (body?.message ?? `Failed (${res.status})`);
    throw new ApiError(res.status, message);
  }
  return body as T;
}

async function rawFetch(
  path: string,
  init: RequestInit,
  withAuth: boolean,
  idempotencyKey?: string,
): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set('accept', 'application/json');
  if (init.body) headers.set('content-type', 'application/json');
  if (idempotencyKey) headers.set('idempotency-key', idempotencyKey);
  if (withAuth) {
    const token = await getAccessToken();
    if (token) headers.set('authorization', `Bearer ${token}`);
  }
  return fetch(`${API_BASE}${path}`, { ...init, headers });
}

/**
 * Bearer-mode fetch. On 401, rotates the refresh token (POST /auth/refresh with
 * the token in the body → bearer response) once and retries. Mirrors the web
 * flow, but the client owns refresh (refresh cookie is web-only).
 */
export async function apiFetch<T>(
  path: string,
  opts: { method?: string; body?: unknown; auth?: boolean; idempotencyKey?: string } = {},
): Promise<T> {
  const init: RequestInit = {
    method: opts.method ?? 'GET',
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  };
  const auth = opts.auth ?? false;

  let res = await rawFetch(path, init, auth, opts.idempotencyKey);
  if (res.status === 401 && auth) {
    const refreshed = await tryRefresh();
    if (refreshed) res = await rawFetch(path, init, true, opts.idempotencyKey);
  }
  return parse<T>(res);
}

async function tryRefresh(): Promise<boolean> {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) return false;
  const res = await rawFetch('/auth/refresh', { method: 'POST', body: JSON.stringify({ refreshToken }) }, false);
  if (!res.ok) {
    await clearTokens();
    return false;
  }
  const data = (await res.json()) as TokenResponse;
  await setTokens(data.accessToken, data.refreshToken);
  return true;
}

export async function login(email: string, password: string): Promise<TokenResponse['user']> {
  const res = await rawFetch('/auth/login', { method: 'POST', body: JSON.stringify({ email, password, mode: 'bearer' }) }, false);
  const data = await parse<TokenResponse>(res);
  await setTokens(data.accessToken, data.refreshToken);
  return data.user;
}

export async function register(input: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}): Promise<TokenResponse['user']> {
  const res = await rawFetch('/auth/register', { method: 'POST', body: JSON.stringify({ ...input, mode: 'bearer' }) }, false);
  const data = await parse<TokenResponse>(res);
  await setTokens(data.accessToken, data.refreshToken);
  return data.user;
}

export async function logout(): Promise<void> {
  const refreshToken = await getRefreshToken();
  if (refreshToken) {
    await rawFetch('/auth/logout', { method: 'POST', body: JSON.stringify({ refreshToken }) }, false).catch(() => undefined);
  }
  await clearTokens();
}
