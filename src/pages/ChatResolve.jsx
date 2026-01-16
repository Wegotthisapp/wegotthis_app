import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

export default function ChatResolve() {
  const navigate = useNavigate();
  const { taskId, receiverId } = useParams();
  const [errMsg, setErrMsg] = useState("");

  useEffect(() => {
    (async () => {
      try {
        if (!taskId || taskId === "null" || taskId === "undefined") {
          throw new Error("Missing taskId in URL");
        }
        if (!receiverId || receiverId === "null" || receiverId === "undefined") {
          throw new Error("Missing receiverId in URL");
        }

        const { data: authData, error: authErr } = await supabase.auth.getUser();
        if (authErr) throw authErr;

        const me = authData?.user?.id;
        if (!me) throw new Error("User not logged in");
        if (me === receiverId) throw new Error("You cannot chat with yourself");

        const user_a = me < receiverId ? me : receiverId;
        const user_b = me < receiverId ? receiverId : me;

        const { data: existing, error: existingErr } = await supabase
          .from("conversations")
          .select("id")
          .eq("task_id", taskId)
          .eq("user_a", user_a)
          .eq("user_b", user_b)
          .maybeSingle();

        if (existingErr) throw existingErr;

        if (existing?.id) {
          navigate(`/chat/${existing.id}`);
          return;
        }

        const { data: created, error: createErr } = await supabase
          .from("conversations")
          .insert([{ task_id: taskId, user_a, user_b }])
          .select("id")
          .single();

        if (!createErr && created?.id) {
          navigate(`/chat/${created.id}`);
          return;
        }

        if (createErr?.code === "23505") {
          const { data: again, error: againErr } = await supabase
            .from("conversations")
            .select("id")
            .eq("task_id", taskId)
            .eq("user_a", user_a)
            .eq("user_b", user_b)
            .single();

          if (againErr) throw againErr;
          navigate(`/chat/${again.id}`);
          return;
        }

        throw createErr;
      } catch (err) {
        const msg = err?.message || String(err);
        setErrMsg(msg);
        navigate("/chat");
      }
    })();
  }, [taskId, receiverId, navigate]);

  return (
    <div style={{ padding: 16 }}>
      {errMsg ? `Chat error: ${errMsg}` : "Loading…"}
    </div>
  );
}
