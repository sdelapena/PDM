"use client";

import Link from "next/link";
import { useState } from "react";
import { api } from "./ui";

export function AuthForm({ mode, token = "" }: { mode: "login" | "forgot" | "reset"; token?: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [again, setAgain] = useState("");
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    if (mode === "reset" && password !== again) return setErr("The passwords don't match.");
    setBusy(true);
    try {
      if (mode === "login") {
        await api("/api/auth/login", { json: { email, password } });
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.href = "/";
        return;
      }
      if (mode === "forgot") await api("/api/auth/forgot", { json: { email } });
      else await api("/api/auth/reset", { json: { token, password } });
      setDone(true);
    } catch (x) {
      setErr((x as Error).message);
    }
    setBusy(false);
  }

  const title = mode === "login" ? "Sign in" : mode === "forgot" ? "Reset your password" : "Choose a password";
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <form onSubmit={submit} className="card" style={{ width: "100%", maxWidth: 400, padding: 28, display: "flex", flexDirection: "column", gap: 16, boxSizing: "border-box" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "#5a6075" }}>PDM · Product Development Manager</div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, letterSpacing: "-0.01em" }}>{title}</h1>
        </div>
        {done ? (
          <div style={{ fontSize: 14, color: "#4a5068" }}>
            {mode === "forgot" ? "If that email belongs to an account, we sent a link to reset the password. It is valid for 1 hour." : "Your password is set. You can sign in now."}
          </div>
        ) : (
          <>
            {mode !== "reset" ? (
              <label className="formlabel">
                Email
                <input className="inp" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" />
              </label>
            ) : null}
            {mode !== "forgot" ? (
              <label className="formlabel">
                {mode === "reset" ? "New password (8+ characters)" : "Password"}
                <input className="inp" type="password" autoComplete={mode === "reset" ? "new-password" : "current-password"} required minLength={mode === "reset" ? 8 : undefined} value={password} onChange={(e) => setPassword(e.target.value)} />
              </label>
            ) : null}
            {mode === "reset" ? (
              <label className="formlabel">
                Repeat password
                <input className="inp" type="password" autoComplete="new-password" required value={again} onChange={(e) => setAgain(e.target.value)} />
              </label>
            ) : null}
            {err ? <div role="alert" className="alertbox">{err}</div> : null}
            <button className="tbtn btn-primary" type="submit" disabled={busy}>
              {mode === "login" ? "Sign in" : mode === "forgot" ? "Send reset link" : "Save password"}
            </button>
          </>
        )}
        <div style={{ fontSize: 13 }}>{mode === "login" ? <Link href="/forgot-password">Forgot your password?</Link> : <Link href="/login">Back to sign in</Link>}</div>
      </form>
    </div>
  );
}
