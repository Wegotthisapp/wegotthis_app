import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

export default function Signup() {
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const onSubmit = async (e) => {
    e.preventDefault();
    setErr(""); setMsg(""); setLoading(true);

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: window.location.origin + "/auth" }
    });
    if (error) {
      console.error("signUp error", error); // see DevTools console
      alert(`signUp: ${error.name || ""} ${error.status || ""} — ${error.message}`);
      setErr(error.message);
      setLoading(false);
      return;
    }

    if (data.session?.user) {
      await supabase.from("profiles").update({ full_name: fullName })
        .eq("id", data.session.user.id);
      nav("/profile");
    } else {
      setMsg("Check your email to confirm your account.");
    }
    setLoading(false);
  };

  return (
    <div className="auth-container">
      <h2>Create account</h2>
      <form onSubmit={onSubmit}>
        <input
          type="text" placeholder="Full name"
          value={fullName} onChange={(e)=>setFullName(e.target.value)} required
        />
        <input
          type="email" placeholder="Email"
          value={email} onChange={(e)=>setEmail(e.target.value)} required
        />
        <input
          type="password" placeholder="Password"
          value={password} onChange={(e)=>setPassword(e.target.value)} required
        />
        <button disabled={loading} type="submit">
          {loading ? "Signing up..." : "Sign up"}
        </button>
      </form>
      {err && <p style={{color:"red"}}>{err}</p>}
      {msg && <p>{msg}</p>}
    </div>
  );
}
