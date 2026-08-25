"use client";

import { useQuery } from "@tanstack/react-query";
import { ApiError, browserFetch } from "./api";
import type { AuthUser } from "./types";

// Single source of truth for "who is signed in" on the client. Both the nav and the
// login page read this query key; mutations (login/register/logout) invalidate it so
// the UI reacts immediately without a full reload.
export const AUTH_QUERY_KEY = ["auth", "me"] as const;

// Resolves the current guest session via the cookie-backed GET /auth/me.
// A 401 is the normal "signed out" state — mapped to null, not an error, so consumers
// can branch on `data` cleanly. `undefined` while `isPending` means "not yet known".
export function useAuth() {
  return useQuery<AuthUser | null>({
    queryKey: AUTH_QUERY_KEY,
    queryFn: async () => {
      try {
        return await browserFetch<AuthUser>("/auth/me");
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) return null;
        throw err;
      }
    },
    retry: false,
  });
}
