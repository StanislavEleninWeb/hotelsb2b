"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { LoginSchema } from "@hotel/shared";
import { browserFetch } from "../../lib/api";
import type { AuthUser } from "../../lib/types";

export default function StaffLoginPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState<string | null>(null);

  const login = useMutation({
    mutationFn: () => {
      const body = LoginSchema.parse(form);
      return browserFetch<{ user: AuthUser }>("/auth/staff/login", { method: "POST", body });
    },
    onSuccess: () => router.push("/"),
    onError: (e) => setError((e as Error).message),
  });

  return (
    <>
      <h1>Staff sign in</h1>
      <form
        className="card"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          login.mutate();
        }}
      >
        <div className="field">
          <label htmlFor="em">Email</label>
          <input id="em" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor="pw">Password</label>
          <input id="pw" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </div>
        {error && <p className="error">{error}</p>}
        <button type="submit" disabled={login.isPending} style={{ marginTop: "0.75rem" }}>
          {login.isPending ? "Signing in…" : "Sign in"}
        </button>
        <p className="muted" style={{ marginTop: "0.75rem" }}>
          Seeded: admin@hotel.test / frontdesk@hotel.test — password123
        </p>
      </form>
    </>
  );
}
