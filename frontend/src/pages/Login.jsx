import { useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { supabase } from "../lib/supabase";

const DEMO_EMAIL = import.meta.env.VITE_DEMO_EMAIL;
const DEMO_PASSWORD = import.meta.env.VITE_DEMO_PASSWORD;

export default function Login() {
  const { signInDemo } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError(error.message);
    setBusy(false);
  };

  const demo = async () => {
    setError(null);
    setBusy(true);
    const { error } = await signInDemo();
    if (error) setError(error.message);
    setBusy(false);
  };

  return (
    <div className="login-shell">
      <div className="login-card">
        <div className="login-brand">
          <span className="brand-mark">💸</span>
          <span className="login-brand-name">Finance Tracker</span>
        </div>
        <p className="login-tagline">Log a transaction by just typing "spent 12.50 on lunch."</p>

        {error && <p className="form-error" role="alert">{error}</p>}

        <form onSubmit={submit} className="login-form">
          <div className="field">
            <label className="field-label" htmlFor="login-email">Email</label>
            <input
              id="login-email"
              className="input"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>
          <div className="field">
            <label className="field-label" htmlFor="login-password">Password</label>
            <input
              id="login-password"
              className="input"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>
          <button type="submit" className="btn btn-primary login-submit" disabled={busy}>
            Sign in
          </button>
        </form>

        <div className="login-divider"><span>or</span></div>

        <button type="button" className="btn btn-outline login-demo-btn" onClick={demo} disabled={busy}>
          Try the demo
        </button>
        {DEMO_EMAIL && DEMO_PASSWORD && (
          <p className="login-demo-hint">
            Portfolio visitors — sign in instantly above, or use{" "}
            <strong>{DEMO_EMAIL}</strong> / <strong>{DEMO_PASSWORD}</strong> manually.
          </p>
        )}
      </div>
    </div>
  );
}
