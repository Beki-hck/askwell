"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/browser";

export function LoginForm() {
  const router = useRouter();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const email = String(data.get("email"));
    const password = String(data.get("password"));
    setPending(true);
    setError(null);
    setNotice(null);
    const auth = createClient().auth;
    const result =
      mode === "in"
        ? await auth.signInWithPassword({ email, password })
        : await auth.signUp({ email, password, options: { emailRedirectTo: `${location.origin}/dashboard` } });
    setPending(false);

    if (result.error) {
      setError(
        result.error.message === "Invalid login credentials"
          ? "That email and password do not match an account."
          : result.error.message,
      );
    } else if (result.data.session) {
      router.push("/dashboard");
      router.refresh();
    } else {
      setNotice(`Check ${email} for a confirmation link, then come back and sign in.`);
    }
  }

  return (
    <form className="panel login-form" onSubmit={submit}>
      <div className="field">
        <label htmlFor="l-email">Email</label>
        <input id="l-email" name="email" type="email" required autoComplete="email" />
      </div>
      <div className="field">
        <label htmlFor="l-password">Password</label>
        <input
          id="l-password"
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete={mode === "in" ? "current-password" : "new-password"}
        />
        {mode === "up" && <p>At least 8 characters.</p>}
      </div>
      <div className="form-foot">
        <button className="button" type="submit" disabled={pending}>
          {pending ? "One moment" : mode === "in" ? "Sign in" : "Create account"}
        </button>
        <button type="button" className="link-button" onClick={() => { setMode(mode === "in" ? "up" : "in"); setError(null); }}>
          {mode === "in" ? "Create an account instead" : "I already have an account"}
        </button>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
    </form>
  );
}
