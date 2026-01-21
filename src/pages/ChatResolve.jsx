import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

export default function ChatResolve() {
  const navigate = useNavigate();
  const { taskId, receiverId } = useParams();

  useEffect(() => {
    const run = async () => {
      try {
        const { data: authData, error: authErr } =
          await supabase.auth.getUser();
        if (authErr) {
          console.error("ChatResolve authErr:", authErr);
          alert("Chat error: not authenticated.");
          return;
        }
        const user = authData?.user;
        if (!user?.id) {
          console.error("ChatResolve: no user");
          alert("Chat error: no user session.");
          return;
        }

        if (!taskId || !receiverId) {
          console.error("ChatResolve: missing params", { taskId, receiverId });
          alert("Chat error: missing parameters.");
          return;
        }

        console.log("ChatResolve params:", {
          taskId,
          receiverId,
          userId: user.id,
        });

        const me = user.id;

        const { data: existing, error: findErr } = await supabase
          .from("conversations")
          .select("id")
          .eq("task_id", taskId)
          .or(
            `and(user_a.eq.${me},user_b.eq.${receiverId}),and(user_a.eq.${receiverId},user_b.eq.${me})`
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
              user_a: me,
              user_b: receiverId,
            },
          ])
          .select("id")
          .single();

        if (createErr) throw createErr;

        navigate(`/chat/${created.id}`);
        return;

        alert("Chat error: could not resolve conversation.");
      } catch (e) {
        console.error("ChatResolve fatal:", e);
        alert("Chat error: unexpected failure (see console).");
      }
    };

    run();
  }, [taskId, receiverId, navigate]);

  return <div style={{ padding: 20 }}>Resolving chat…</div>;
}
