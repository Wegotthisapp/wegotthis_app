import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { requireUser } from "../lib/auth";

export default function ChatResolve() {
  const navigate = useNavigate();
  const { taskId, otherUserId } = useParams();

  useEffect(() => {
    (async () => {
      try {
        const user = await requireUser();

        const { data: conversationId, error: e1 } = await supabase.rpc(
          "get_or_create_conversation_by_pair",
          { p_user1: user.id, p_user2: otherUserId }
        );
        if (e1) throw e1;

        const { error: e2 } = await supabase.rpc("attach_task_to_conversation", {
          p_conversation_id: conversationId,
          p_task_id: taskId,
        });
        if (e2) throw e2;

        await supabase.from("messages").insert({
          conversation_id: conversationId,
          task_id: taskId,
          type: "task_request",
          sender_id: user.id,
          receiver_id: otherUserId,
          content: "New task request",
        });

        navigate(`/chat/c/${conversationId}`, { replace: true });
      } catch (err) {
        console.error("ChatResolve error:", err);
        navigate("/chat");
      }
    })();
  }, [taskId, otherUserId, navigate]);

  return <div>Loading…</div>;
}
