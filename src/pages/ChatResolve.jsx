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
          setErrMsg(`Missing taskId in URL. Got: ${taskId}`);
          return;
        }
        if (!receiverId || receiverId === "null" || receiverId === "undefined") {
          setErrMsg(`Missing receiverId in URL. Got: ${receiverId}`);
          return;
        }

        const { data: authData, error: authErr } = await supabase.auth.getUser();
        if (authErr) throw authErr;
        const me = authData?.user?.id;

        if (!me) {
          setErrMsg("Not logged in.");
          return;
        }

        if (me === receiverId) {
          setErrMsg("You cannot start a chat with yourself.");
          return;
        }

        const { data: existing, error: findErr } = await supabase
          .from("conversations")
          .select("id, task_id, user1_id, user2_id")
          .eq("task_id", taskId)
          .or(
            `and(user1_id.eq.${me},user2_id.eq.${receiverId}),and(user1_id.eq.${receiverId},user2_id.eq.${me})`
          )
          .maybeSingle();

        if (findErr) throw findErr;

        if (existing?.id) {
          navigate(`/chat/${existing.id}`);
          return;
        }

        const { data: created, error: createErr } = await supabase
          .from("conversations")
          .insert([
            {
              task_id: taskId,
              user1_id: me,
              user2_id: receiverId,
            },
          ])
          .select("id")
          .single();

        if (createErr) throw createErr;

        navigate(`/chat/${created.id}`);
      } catch (err) {
        console.error(err);
        const msg = err?.message || JSON.stringify(err);
        setErrMsg(msg);
        alert(`Chat failed: ${msg}`);
        navigate("/chat");
      }
    })();
  }, [taskId, receiverId, navigate]);

  if (errMsg) return <div style={{ padding: 16, color: "red" }}>{errMsg}</div>;
  return <div style={{ padding: 16 }}>Loading…</div>;
}
