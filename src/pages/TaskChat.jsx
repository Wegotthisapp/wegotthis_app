import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { resolveConversationId } from "../lib/resolveConversation";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../auth/useAuth";

const TYPE_COLORS = {
  ask: { bg: "#dbeafe", fg: "#1e40af", border: "#bfdbfe" },
  offer: { bg: "#ede9fe", fg: "#5b21b6", border: "#ddd6fe" },
};

function typeMeta(taskType) {
  const t = (taskType || "ask").toLowerCase();
  return TYPE_COLORS[t] || TYPE_COLORS.ask;
}

export default function TaskChat() {
  const { taskId, otherUserId } = useParams();
  const navigate = useNavigate();
  const listRef = useRef(null);

  const { user: me, loading: authLoading } = useAuth();
  const [task, setTask] = useState(null);
  const [peerUserId, setPeerUserId] = useState(null);
  const [conversationId, setConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState("");

  async function loadMessages(currentConversationId) {
    const { data, error } = await supabase
      .from("messages")
      .select("id, conversation_id, sender_id, receiver_id, body, content, created_at, read_at")
      .eq("conversation_id", currentConversationId)
      .order("created_at", { ascending: true });

    if (error) {
      setErr(error.message);
      setMessages([]);
      return;
    }

    setMessages(data || []);
    requestAnimationFrame(() => {
      if (listRef.current) {
        listRef.current.scrollTop = listRef.current.scrollHeight;
      }
    });
  }

  useEffect(() => {
    if (!me?.id) return;

    let cancelled = false;

    (async () => {
      setLoading(true);
      setErr("");
      setPeerUserId(null);
      setConversationId(null);
      setMessages([]);

      if (!taskId) {
        setErr("Missing task id in chat URL.");
        setLoading(false);
        return;
      }

      const { data: taskRow, error: taskErr } = await supabase
        .from("tasks")
        .select("id, title, user_id, status, task_type, price_min, price_max, currency, is_negotiable, description")
        .eq("id", taskId)
        .maybeSingle();

      if (cancelled) return;

      if (taskErr || !taskRow) {
        setErr(taskErr?.message || "Task not found.");
        setLoading(false);
        return;
      }

      setTask(taskRow);
      const resolvedPeerUserId =
        otherUserId || (taskRow.user_id !== me.id ? taskRow.user_id : null);

      if (!resolvedPeerUserId) {
        setErr("Missing other user in chat URL. Use /chat/task/:taskId/user/:otherUserId.");
        setLoading(false);
        return;
      }

      try {
        const resolvedConversationId = await resolveConversationId({
          supabase,
          taskId,
          otherUserId: resolvedPeerUserId,
        });

        if (cancelled) return;

        if (!resolvedConversationId) {
          setErr("Resolver did not return a conversation id.");
          setLoading(false);
          return;
        }

        setPeerUserId(resolvedPeerUserId);
        setConversationId(resolvedConversationId);
        await loadMessages(resolvedConversationId);
      } catch (resolverError) {
        if (cancelled) return;
        console.error("resolveConversationId failed", resolverError);
        setErr(resolverError?.message || "Could not open conversation.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [me?.id, taskId, otherUserId]);

  async function send() {
    if (!draft.trim() || !conversationId || !me?.id || !peerUserId) return;

    setSending(true);
    setErr("");

    const body = draft.trim();
    setDraft("");

    const { error: msgErr } = await supabase.from("messages").insert({
      conversation_id: conversationId,
      task_id: taskId,
      sender_id: me.id,
      receiver_id: peerUserId,
      body,
      type: "text",
    });

    if (msgErr) {
      setErr(msgErr.message);
      setSending(false);
      return;
    }

    await supabase
      .from("conversations")
      .update({ last_message_at: new Date().toISOString() })
      .eq("id", conversationId);

    await loadMessages(conversationId);
    setSending(false);
  }

  async function markThreadRead() {
    if (!me?.id || !conversationId) return;

    await supabase
      .from("messages")
      .update({ read_at: new Date().toISOString() })
      .eq("conversation_id", conversationId)
      .eq("receiver_id", me.id)
      .is("read_at", null);
  }

  useEffect(() => {
    if (!conversationId || !me?.id) return;

    markThreadRead();

    const channel = supabase
      .channel(`messages:conversation:${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const msg = payload.new;
          setMessages((prev) => [...prev, msg]);
          requestAnimationFrame(() => {
            if (listRef.current) {
              listRef.current.scrollTop = listRef.current.scrollHeight;
            }
          });
          if (msg.sender_id !== me.id) markThreadRead();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, me?.id]);

  if (!me && !authLoading) {
    return (
      <div style={{ maxWidth: 900, margin: "0 auto", padding: 24 }}>
        <p style={{ color: "#ef4444" }}>{err || "Please log in"}</p>
      </div>
    );
  }

  if (loading || !conversationId) {
    return (
      <div style={{ maxWidth: 900, margin: "0 auto", padding: 24, color: "#111827" }}>
        {err ? <div style={{ color: "#ef4444" }}>{err}</div> : "Loading chat..."}
      </div>
    );
  }

  const meta = typeMeta(task?.task_type);

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: 24, color: "#111827" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, color: "#111827" }}>Chat</h2>
          <div style={{ color: "#475569", marginTop: 6 }}>Direct task conversation.</div>
        </div>

        <button
          onClick={() => navigate("/chat")}
          style={{
            padding: "10px 14px",
            borderRadius: 999,
            border: "1px solid #e5e7eb",
            background: "white",
            color: "#111827",
            fontWeight: 800,
            cursor: "pointer",
          }}
        >
          Back
        </button>
      </div>

      {task && (
        <div
          style={{
            marginTop: 16,
            border: `1px solid ${meta.border}`,
            borderRadius: 18,
            padding: 16,
            background: "white",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span
              style={{
                background: meta.bg,
                color: meta.fg,
                border: `1px solid ${meta.border}`,
                padding: "0.18rem 0.55rem",
                borderRadius: 999,
                fontWeight: 900,
                fontSize: 12,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}
            >
              {task.task_type === "offer" ? "OFFER" : "ASK"}
            </span>

            <div style={{ fontWeight: 950, fontSize: 16, color: "#111827" }}>{task.title}</div>
          </div>

          {task.description ? (
            <div style={{ marginTop: 10, color: "#374151", lineHeight: 1.5 }}>{task.description}</div>
          ) : null}

          <div style={{ marginTop: 12, display: "flex", gap: 18, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: 12, color: "#64748b", fontWeight: 900 }}>STATUS</div>
              <div style={{ fontWeight: 900, marginTop: 4 }}>{task.status || "open"}</div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: "#64748b", fontWeight: 900 }}>PRICE</div>
              <div style={{ fontWeight: 900, marginTop: 4 }}>
                {task.price_min != null || task.price_max != null
                  ? `${task.price_min ?? ""}${task.price_min != null && task.price_max != null ? "-" : ""}${task.price_max ?? ""} ${task.currency || "EUR"}`
                  : "-"}{" "}
                {task.is_negotiable ? "(negotiable)" : ""}
              </div>
            </div>

            <button
              onClick={() => navigate(`/task/${task.id}`)}
              style={{
                marginLeft: "auto",
                padding: "10px 14px",
                borderRadius: 999,
                border: "1px solid #e5e7eb",
                background: "white",
                color: "#111827",
                fontWeight: 900,
                cursor: "pointer",
              }}
            >
              Open task
            </button>
          </div>
        </div>
      )}

      <div
        ref={listRef}
        style={{
          marginTop: 16,
          border: "1px solid #e5e7eb",
          borderRadius: 18,
          padding: 16,
          background: "#fafafa",
          minHeight: 260,
          maxHeight: 440,
          overflowY: "auto",
        }}
      >
        {messages.length ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {messages.map((m) => {
              const mine = m.sender_id === me.id;
              const text = m.body ?? m.content ?? "";

              return (
                <div key={m.id} style={{ display: "flex", justifyContent: mine ? "flex-end" : "flex-start" }}>
                  <div
                    style={{
                      maxWidth: "75%",
                      padding: "10px 12px",
                      borderRadius: 14,
                      background: mine ? "#e0f2fe" : "white",
                      border: "1px solid #e5e7eb",
                      color: "#111827",
                      whiteSpace: "pre-wrap",
                      overflowWrap: "anywhere",
                    }}
                    title={m.created_at ? new Date(m.created_at).toLocaleString() : ""}
                  >
                    {text}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ color: "#475569", fontWeight: 700 }}>No messages yet in this thread.</div>
        )}
      </div>

      <div style={{ marginTop: 12, display: "flex", gap: 10 }}>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Write a message..."
          disabled={!conversationId || sending}
          style={{
            flex: 1,
            padding: "12px 14px",
            borderRadius: 14,
            border: "1px solid #e5e7eb",
            outline: "none",
            color: "#111827",
            background: "white",
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") send();
          }}
        />

        <button
          onClick={send}
          disabled={!conversationId || sending || !draft.trim()}
          style={{
            padding: "12px 16px",
            borderRadius: 14,
            border: "none",
            background: "#2563eb",
            color: "white",
            fontWeight: 900,
            cursor: "pointer",
            opacity: !conversationId || sending || !draft.trim() ? 0.5 : 1,
          }}
        >
          Send
        </button>
      </div>

      {err && <div style={{ marginTop: 12, color: "#ef4444" }}>{err}</div>}
    </div>
  );
}
