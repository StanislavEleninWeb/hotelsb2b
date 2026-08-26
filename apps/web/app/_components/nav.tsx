"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { browserFetch } from "../../lib/api";
import { AUTH_QUERY_KEY, useAuth } from "../../lib/auth";

// Auth-aware Modernist nav. Signed out → "Sign in"; signed in → account links plus a
// "Sign out" action. While the session check is in flight we render no auth control at
// all (rather than defaulting to "Sign in"), so a signed-in user never sees a stale
// "Sign in" flash on load.
export function Nav() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: user, isPending } = useAuth();

  const logout = useMutation({
    mutationFn: () => browserFetch("/auth/logout", { method: "POST" }),
    onSuccess: async () => {
      queryClient.setQueryData(AUTH_QUERY_KEY, null);
      await queryClient.invalidateQueries({ queryKey: AUTH_QUERY_KEY });
      router.replace("/");
    },
  });

  return (
    <nav className="nav">
      <Link href="/" className="nav-brand">
        HARBOR&nbsp;STAYS
      </Link>
      <Link href="/search" className="nav-link">
        Stays
      </Link>

      {!isPending && user && (
        <>
          <Link href="/account" className="nav-link">
            My bookings
          </Link>
          {user.email && <span className="nav-user muted">{user.email}</span>}
          <button
            className="btn btn-outline"
            type="button"
            style={{ padding: "8px 15px" }}
            onClick={() => logout.mutate()}
            disabled={logout.isPending}
          >
            {logout.isPending ? "Signing out…" : "Sign out"}
          </button>
        </>
      )}

      {!isPending && !user && (
        <Link href="/account/login" className="btn btn-primary" style={{ padding: "8px 16px" }}>
          Sign in
        </Link>
      )}
    </nav>
  );
}
