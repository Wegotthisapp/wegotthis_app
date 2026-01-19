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

        const a = user.id < receiverId ? user.id : receiverId;
        const b = user.id < receiverId ? receiverId : user.id;

        console.log("ChatResolve params:", {
          taskId,
          receiverId,
          userId: user.id,
          a,
          b,
        });

        const { data: existing, error: findError } = await supabase
          .from("conversations")
          .select("id, task_id, user_a, user_b, created_at")
          .eq("task_id", taskId)
          .eq("user_a", a)
          .eq("user_b", b)
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle();

        console.log("ChatResolve existing:", existing, "findError:", findError);

        if (findError) {
          console.error("ChatResolve findError (likely RLS):", findError);
        }

        if (existing?.id) {
          navigate(`/chat/${existing.id}`);
          return;
        }

        const { data: created, error: createError } = await supabase
          .from("conversations")
          .insert([{ task_id: taskId, user_a: a, user_b: b }])
          .select("id")
          .single();

        console.log("ChatResolve created:", created, "createError:", createError);

        if (createError) {
          const isDup =
            createError.code === "23505" ||
            String(createError.message || "")
              .toLowerCase()
              .includes("duplicate") ||
            String(createError.details || "")
              .toLowerCase()
              .includes("duplicate");

          if (isDup) {
            const { data: afterDup, error: afterDupErr } = await supabase
              .from("conversations")
              .select("id, created_at")
              .eq("task_id", taskId)
              .eq("user_a", a)
              .eq("user_b", b)
              .order("created_at", { ascending: true })
              .limit(1)
              .maybeSingle();

            console.log(
              "ChatResolve afterDup:",
              afterDup,
              "afterDupErr:",
              afterDupErr
            );

            if (afterDup?.id) {
              navigate(`/chat/${afterDup.id}`);
              return;
            }

            alert(
              "Chat error: conversation exists but cannot be read (RLS). Fix policies."
            );
            return;
          }

          alert(
            `Chat error: ${
              createError.message || "Could not create conversation."
            }`
          );
          return;
        }

        if (created?.id) {
          navigate(`/chat/${created.id}`);
          return;
        }

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
