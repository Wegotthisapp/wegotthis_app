import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

export default function ChatResolve() {
  const { taskId, userId: otherUserId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      setError("");

      const { data: authData, error: authErr } = await supabase.auth.getUser();
      if (authErr || !authData?.user?.id) {
        setError("Please log in.");
        return;
      }
      const meId = authData.user.id;

      if (!taskId || !otherUserId) {
        setError("Missing taskId or userId in URL.");
        return;
      }
      if (meId === otherUserId) {
        setError("You cannot chat with yourself.");
        return;
      }

      // Pair key must match your generated column logic:
      const a = [meId, otherUserId].sort()[0];
      const b = [meId, otherUserId].sort()[1];
      const pairKey = `${a}:${b}`;

      // 1) get or create conversation (task + pair)
      let conversationId = null;

      const { data: existingConv, error: convFindErr } = await supabase
        .from("conversations")
        .select("id")
        .eq("pair_key", pairKey)
        .eq("task_id", taskId)
        .maybeSingle();

      if (convFindErr) {
        console.error("ChatResolve find conversation error:", convFindErr);
        setError(JSON.stringify(convFindErr, null, 2));
        return;
      }

      if (existingConv?.id) {
        conversationId = existingConv.id;
      } else {
        const { data: createdConv, error: convCreateErr } = await supabase
          .from("conversations")
          .insert([{ user_a: a, user_b: b, task_id: taskId }])
          .select("id")
          .single();

        if (convCreateErr) {
          console.error("ChatResolve create conversation error:", convCreateErr);
          setError(JSON.stringify(convCreateErr, null, 2));
          return;
        }
        conversationId = createdConv.id;
      }

      // 2) get or create conversation_task (task context inside conversation)
      let conversationTaskId = null;

      const { data: existingCT, error: ctFindErr } = await supabase
        .from("conversation_tasks")
        .select("id, color_index")
        .eq("conversation_id", conversationId)
        .eq("task_id", taskId)
        .maybeSingle();

      if (ctFindErr) {
        console.error("ChatResolve find conversation_task error:", ctFindErr);
        setError(JSON.stringify(ctFindErr, null, 2));
        return;
      }

      if (existingCT?.id) {
        conversationTaskId = existingCT.id;
      } else {
        // assign next color_index = count existing threads
        const { count, error: countErr } = await supabase
          .from("conversation_tasks")
          .select("id", { count: "exact", head: true })
          .eq("conversation_id", conversationId);

        if (countErr) {
          console.error("ChatResolve count conversation_tasks error:", countErr);
          setError(JSON.stringify(countErr, null, 2));
          return;
        }

        const nextColorIndex = Number(count || 0);

        const { data: createdCT, error: ctCreateErr } = await supabase
          .from("conversation_tasks")
          .insert([
            {
              conversation_id: conversationId,
              task_id: taskId,
              status: "discussing",
              color_index: nextColorIndex,
            },
          ])
          .select("id")
          .single();

        if (ctCreateErr) {
          console.error("ChatResolve create conversation_task error:", ctCreateErr);
          setError(JSON.stringify(ctCreateErr, null, 2));
          return;
        }

        conversationTaskId = createdCT.id;
      }

      // 3) go to task chat thread
      navigate(`/chat/task/${taskId}/user/${otherUserId}`, { replace: true });
    })();
  }, [taskId, otherUserId, navigate, searchParams]);

  if (error) {
    return (
      <div style={{ maxWidth: 760, margin: "2rem auto", padding: "1.25rem", color: "#ef4444" }}>
        {error}
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 760, margin: "2rem auto", padding: "1.25rem" }}>
      Resolving chat…
    </div>
  );
}
