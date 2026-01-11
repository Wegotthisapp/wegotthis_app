import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

export default function Login() {
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const onSubmit = async (e) => {
    e.preventDefault();
    setErr(""); setLoading(true);

    const { data, error } = await supabase.auth.signInWithPassword({
      email, password
    });
    if (error) { setErr(error.message); setLoading(false); return; }

    // on success, go to profile (or wherever you prefer)
    if (data.session?.user) nav("/profile");
    setLoading(false);
  };

  return (
    <div className="auth-container">
      <h2>Log in</h2>
      <form onSubmit={onSubmit}>
        <input
          type="email" placeholder="Email"
          value={email} onChange={(e)=>setEmail(e.target.value)} required
        />
        <input
          type="password" placeholder="Password"
          value={password} onChange={(e)=>setPassword(e.target.value)} required
        />
        <button disabled={loading} type="submit">
          {loading ? "Logging in..." : "Log in"}
        </button>
      </form>
      {err && <p style={{color:"red"}}>{err}</p>}
    </div>
  );
}
