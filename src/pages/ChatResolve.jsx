import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

export default function ChatResolve() {
  const navigate = useNavigate();
  const { receiverId } = useParams();
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      try {
        setErr("");

        const { data: auth } = await supabase.auth.getUser();
        const me = auth?.user?.id;

        if (!me) {
          navigate("/login", { replace: true });
          return;
        }

        if (!receiverId) {
          setErr("Missing receiver id.");
          return;
        }

        if (receiverId === me) {
          setErr("You cannot chat with yourself.");
          return;
        }

        const [a, b] = [me, receiverId].sort();

        const { data: existing, error: findErr } = await supabase
          .from("conversations")
          .select("id")
          .or(
            `and(user_a.eq.${a},user_b.eq.${b}),and(user_a.eq.${b},user_b.eq.${a})`
          )
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (findErr) throw findErr;

        if (existing?.id) {
          navigate(`/chat/${existing.id}`, { replace: true });
          return;
        }

        const { data: created, error: createErr } = await supabase
          .from("conversations")
          .insert([
            {
              user_a: a,
              user_b: b,
            },
          ])
          .select("id")
          .single();

        if (createErr) throw createErr;

        navigate(`/chat/${created.id}`, { replace: true });
      } catch (e) {
        console.error("ChatResolve error:", e);
        setErr(e?.message || "Unexpected failure");
      }
    })();
  }, [navigate, receiverId]);

  if (err) return <div style={{ padding: 16 }}>Chat error: {err}</div>;
  return <div style={{ padding: 16 }}>Opening chat…</div>;
}
