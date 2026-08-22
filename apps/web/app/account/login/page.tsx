"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { GuestRegisterSchema, LoginSchema } from "@hotel/shared";
import { browserFetch } from "../../../lib/api";
import type { AuthUser } from "../../../lib/types";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [form, setForm] = useState({ email: "", password: "", firstName: "", lastName: "" });
  const [error, setError] = useState<string | null>(null);

  const submit = useMutation({
    mutationFn: async () => {
      if (mode === "login") {
        const body = LoginSchema.parse({ email: form.email, password: form.password });
        return browserFetch<{ user: AuthUser }>("/auth/login", { method: "POST", body });
      }
      const body = GuestRegisterSchema.parse(form);
      return browserFetch<{ user: AuthUser }>("/auth/register", { method: "POST", body });
    },
    onSuccess: () => router.push("/account"),
    onError: (e) => setError((e as Error).message),
  });

  return (
    <>
      <h1>{mode === "login" ? "Sign in" : "Create an account"}</h1>
      <form
        className="card"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          submit.mutate();
        }}
      >
        {mode === "register" && (
          <div className="row">
            <div className="field">
              <label htmlFor="fn">First name</label>
              <input id="fn" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
            </div>
            <div className="field">
              <label htmlFor="ln">Last name</label>
              <input id="ln" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
            </div>
          </div>
        )}
        <div className="field">
          <label htmlFor="em">Email</label>
          <input id="em" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor="pw">Password {mode === "register" && <span className="muted">(min 10 chars)</span>}</label>
          <input id="pw" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </div>
        {error && <p className="error">{error}</p>}
        <button type="submit" disabled={submit.isPending} style={{ marginTop: "0.75rem" }}>
          {submit.isPending ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}
        </button>
      </form>
      <p className="muted">
        {mode === "login" ? "New here? " : "Already have an account? "}
        <button
          className="secondary"
          type="button"
          onClick={() => {
            setError(null);
            setMode(mode === "login" ? "register" : "login");
          }}
        >
          {mode === "login" ? "Create an account" : "Sign in"}
        </button>
      </p>
    </>
  );
}
