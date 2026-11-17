import { useState } from "react";
import { api } from "../api.js";
import { Notice } from "../components/ui.jsx";

export default function Auth({ onSignedIn }) {
  const [mode, setMode] = useState("signin");
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const signup = mode === "signup";
  const set = (key) => (event) => setForm((f) => ({ ...f, [key]: event.target.value }));

  async function submit(event) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const user = signup ? await api.signUp(form.name, form.email, form.password) : await api.signIn(form.email, form.password);
      onSignedIn(user);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth">
      <div className="auth-hero">
        <img src="/pgo-logo.png" alt="" width="64" height="64" />
        <h1>PGO Wealth</h1>
        <p>See how every fund you hold is really doing.</p>
      </div>
      <form className="auth-sheet" onSubmit={submit}>
        <div className="segmented" role="tablist">
          <button type="button" role="tab" aria-selected={!signup} className={!signup ? "on" : ""} onClick={() => { setMode("signin"); setError(""); }}>Sign in</button>
          <button type="button" role="tab" aria-selected={signup} className={signup ? "on" : ""} onClick={() => { setMode("signup"); setError(""); }}>Create account</button>
        </div>
        {signup && (
          <label className="field">
            <span>Your name</span>
            <input value={form.name} onChange={set("name")} autoComplete="name" required maxLength={80} />
          </label>
        )}
        <label className="field">
          <span>Email</span>
          <input type="email" inputMode="email" value={form.email} onChange={set("email")} autoComplete="email" required />
        </label>
        <label className="field">
          <span>Password</span>
          <input type="password" value={form.password} onChange={set("password")} autoComplete={signup ? "new-password" : "current-password"} minLength={signup ? 8 : undefined} required />
          {signup && <small>At least 8 characters.</small>}
        </label>
        {error && <Notice kind="error">{error}</Notice>}
        <button className="btn btn-primary" disabled={busy}>{busy ? "Please wait…" : signup ? "Create account" : "Sign in"}</button>
      </form>
    </div>
  );
}
