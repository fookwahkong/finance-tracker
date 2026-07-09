import { useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { supabase } from "../lib/supabase";

export default function Login() {
  const { signInDemo } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError(error.message);
  };

  const demo = async () => {
    setError(null);
    const { error } = await signInDemo();
    if (error) setError(error.message);
  };

  return (
    <div className="login">
      <h1>Finance Tracker</h1>
      <form onSubmit={submit}>
        <input type="email" placeholder="Email" value={email}
               onChange={(e) => setEmail(e.target.value)} />
        <input type="password" placeholder="Password" value={password}
               onChange={(e) => setPassword(e.target.value)} />
        <button type="submit">Sign in</button>
      </form>
      <button type="button" onClick={demo}>Try the demo</button>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
