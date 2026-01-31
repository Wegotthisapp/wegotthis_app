import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

const TYPE_COLORS = {
  ask: { bg: "#dbeafe", fg: "#1e40af", border: "#bfdbfe" },   // blue
  offer: { bg: "#ede9fe", fg: "#5b21b6", border: "#ddd6fe" }, // violet
};
function typeMeta(task_type) {
  const t = (task_type || "ask").toLowerCase();
  return TYPE_COLORS[t] || TYPE_COLORS.ask;
}

function safeName(profile, fallback) {
  if (!profile) return fallback;
  return profile.full_name || profile.username || profile.nickname || fallback;
}

function pairKey(a, b) {
  const [x, y] = [String(a), String(b)].sort();
  return `${x}:${y}`; // IMPORTANT: matches generated column expression
}

export default function TaskChat() {
  console.log("✅ TaskChat LOADED - NEW VERSION");
  const { taskId, otherUserId } = useParams();
  const navigate = useNavigate();

  const [me, setMe] = useState(null);

  const [task, setTask] = useState(null);
  const [people, setPeople] = useState([]); // responders list
  const [activeOtherId, setActiveOtherId] = useState(otherUserId || null);
  const [activeConversationId, setActiveConversationId] = useState(null);

  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState("");

  const listRef = useRef(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data, error } = await supabase.auth.getUser();
      if (!mounted) return;
      if (error || !data?.user) setErr("Please log in");
      else setMe(data.user);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  async function loadMessages(convoId) {
    const { data, error } = await supabase
      .from("messages")
      .select("id, conversation_id, sender_id, receiver_id, body, content, created_at, read_at")
      .eq("conversation_id", convoId)
      .order("created_at", { ascending: true });

    if (error) {
      setErr(error.message);
      setMessages([]);
      return;
    }
    setMessages(data || []);
    requestAnimationFrame(() => {
      if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
    });
  }

  async function getOrCreateConversationId({ taskId, userA, userB, pairKey }) {
    // 1) try select by unique key
    const first = await supabase
      .from("conversations")
      .select("id")
      .eq("task_id", taskId)
      .eq("pair_key", pairKey)
      .maybeSingle();

    if (first.error) throw first.error;
    if (first.data?.id) return first.data.id;

    // 2) insert WITHOUT expecting returned row (RLS may hide it)
    const ins = await supabase.from("conversations").insert({
      task_id: taskId,
      user_a: userA,
      user_b: userB,
      last_message_at: new Date().toISOString(), // overwritten when real messages exist
    });

    if (ins.error && ins.error.code !== "23505") throw ins.error;

    // 3) re-select to obtain id
    const second = await supabase
      .from("conversations")
      .select("id")
      .eq("task_id", taskId)
      .eq("pair_key", pairKey)
      .single();

    if (second.error) throw second.error;
    return second.data.id;
  }

  async function archiveConversation(conversationId) {
    if (!me?.id || !conversationId) return;
    await supabase.from("conversation_archives").insert({
      user_id: me.id,
      conversation_id: conversationId,
    });
  }

  async function loadAll() {
    if (!me?.id || !taskId) return;
    setLoading(true);
    setErr("");

    // 1) task
    const { data: taskRow, error: taskErr } = await supabase
      .from("tasks")
      .select("id, title, user_id, status, task_type, price_min, price_max, currency, is_negotiable, max_distance_km, description")
      .eq("id", taskId)
      .maybeSingle();

    if (taskErr || !taskRow) {
      setErr(taskErr?.message || "Task not found.");
      setTask(null);
      setLoading(false);
      return;
    }
    setTask(taskRow);

    const isMine = taskRow.user_id === me.id;

    // 2) If NOT my task: direct 1:1 with owner (no responder list)
    if (!isMine) {
      const ownerId = taskRow.user_id;

      // Non-owner always chats with OWNER. Ignore otherUserId.
      const pk = pairKey(me.id, ownerId);
      console.log("[chat] pairKey", pk);
      console.log("[chat] userA", me.id, "userB", ownerId);
      let convoId = null;
      try {
        convoId = await getOrCreateConversationId({
          taskId,
          userA: me.id,
          userB: ownerId,
          pairKey: pk,
        });
      } catch (e) {
        console.error("[chat] getOrCreateConversationId failed", e);
        setErr("Could not open conversation (no conversation id returned). Check RLS/permissions.");
        setLoading(false);
        return;
      }
      if (!convoId) {
        setErr("Could not open conversation (no conversation id returned). Check RLS/permissions.");
        setLoading(false);
        return;
      }
      setErr("");
      setActiveOtherId(ownerId);
      setActiveConversationId(convoId);
      setPeople([]);
      if (convoId) await loadMessages(convoId);
      setLoading(false);
      return;
    }

    // 3) If my task: responders = conversations for this task (excluding archived)
    const { data: convs, error: convErr } = await supabase
      .from("conversations")
      .select("id, user_a, user_b, last_message_at")
      .eq("task_id", taskId)
      .order("last_message_at", { ascending: false, nullsFirst: false });

    if (convErr) {
      setErr(convErr.message);
      setPeople([]);
      setLoading(false);
      return;
    }

    const convoRows = convs || [];

    // archives
    const convoIds = convoRows.map((c) => c.id);
    const { data: archives } = await supabase
      .from("conversation_archives")
      .select("conversation_id")
      .eq("user_id", me.id)
      .in("conversation_id", convoIds);

    const archivedSet = new Set((archives || []).map((a) => a.conversation_id));
    const visibleConvos = convoRows.filter((c) => !archivedSet.has(c.id));

    // Build otherIds
    const otherIds = visibleConvos.map((c) => (c.user_a === me.id ? c.user_b : c.user_a));

    // Profiles (public)
    let profMap = new Map();
    if (otherIds.length > 0) {
      const { data: profs } = await supabase
        .from("public_profiles")
        .select("id, full_name, username, nickname, avatar_url")
        .in("id", otherIds);

      profMap = new Map((profs || []).map((p) => [p.id, p]));
    }

    const builtPeople = visibleConvos.map((c) => {
      const oid = c.user_a === me.id ? c.user_b : c.user_a;
      return {
        otherUserId: oid,
        conversationId: c.id,
        lastMessageAt: c.last_message_at || null,
        profile: profMap.get(oid) || null,
      };
    });

    setPeople(builtPeople);

    // Auto-open rules:
    // - 0 responders: no active convo
    // - >=1: open most recent (already sorted)
    const initial = otherUserId
      ? builtPeople.find((p) => p.otherUserId === otherUserId)
      : builtPeople[0];

    const initialOther = initial?.otherUserId || null;
    const initialConvo = initial?.conversationId || null;

    setActiveOtherId(initialOther);
    setActiveConversationId(initialConvo);

    if (initialConvo) await loadMessages(initialConvo);
    else setMessages([]);

    setLoading(false);
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.id, taskId, otherUserId]);

  async function onSelectPerson(oid) {
    setActiveOtherId(oid);
    const convoId = people.find((p) => p.otherUserId === oid)?.conversationId || null;
    setActiveConversationId(convoId);

    // keep URL stable
    navigate(`/chat/task/${taskId}/user/${oid}`, { replace: true });

    if (convoId) await loadMessages(convoId);
  }

  async function send() {
    if (!draft.trim() || !activeConversationId || !me?.id) return;
    setSending(true);
    setErr("");

    const body = draft.trim();
    setDraft("");

    // determine receiver
    let receiver = null;
    if (task?.user_id === me.id) {
      receiver = activeOtherId; // owner -> responder
    } else {
      receiver = task?.user_id; // responder -> owner
    }

    const { error: msgErr } = await supabase.from("messages").insert({
      conversation_id: activeConversationId,
      task_id: taskId,
      sender_id: me.id,
      receiver_id: receiver,
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
      .eq("id", activeConversationId);

    await loadMessages(activeConversationId);
    setSending(false);
  }

  async function markThreadRead() {
    if (!me?.id || !activeConversationId) return;
    await supabase
      .from("messages")
      .update({ read_at: new Date().toISOString() })
      .eq("conversation_id", activeConversationId)
      .eq("receiver_id", me.id)
      .is("read_at", null);
  }

  useEffect(() => {
    if (!activeConversationId || !me?.id) return;

    markThreadRead();

    const channel = supabase
      .channel(`messages:conversation:${activeConversationId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${activeConversationId}` },
        (payload) => {
          const msg = payload.new;
          setMessages((prev) => [...prev, msg]);
          requestAnimationFrame(() => {
            if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
          });
          if (msg.sender_id !== me.id) markThreadRead();
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeConversationId, me?.id]);

  if (!me) {
    return (
      <div style={{ maxWidth: 900, margin: "0 auto", padding: 24 }}>
        <p style={{ color: "#ef4444" }}>{err || "Please log in"}</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ maxWidth: 900, margin: "0 auto", padding: 24, color: "#111827" }}>
        Loading…
      </div>
    );
  }

  if (!task) {
    return (
      <div style={{ maxWidth: 900, margin: "0 auto", padding: 24, color: "#111827" }}>
        Task not found.
      </div>
    );
  }

  const isMine = task.user_id === me.id;
  const meta = typeMeta(task.task_type);

  const activeProfile = people.find((p) => p.otherUserId === activeOtherId)?.profile || null;
  const personLabel = safeName(activeProfile, "Someone");

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: 24, color: "#111827" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, color: "#111827" }}>Chat</h2>
          <div style={{ color: "#475569", marginTop: 6 }}>
            {isMine ? "Manage responders for this task." : "Direct chat with the task owner."}
          </div>
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

      {/* TASK HEADER */}
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

          <div style={{ fontWeight: 950, fontSize: 16, color: "#111827" }}>
            {isMine ? task.title : `${task.title} — ${personLabel}`}
          </div>
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
                : task.price ?? "—"}{" "}
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

      {/* RESPONDERS (owner only) */}
      {isMine && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 12, color: "#64748b", marginBottom: 10, fontWeight: 900, letterSpacing: "0.12em" }}>
            PEOPLE WHO RESPONDED ({people.length})
          </div>

          {people.length === 0 ? (
            <div style={{ padding: 14, border: "1px solid #e5e7eb", borderRadius: 14, color: "#475569", background: "white" }}>
              <div style={{ fontWeight: 900, color: "#0f172a" }}>No messages yet.</div>
              <div style={{ marginTop: 6 }}>
                Tip: Increase distance or boost/share your task to reach more people.
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
              {people.map((p) => {
                const active = p.otherUserId === activeOtherId;
                const label = safeName(p.profile, `User ${String(p.otherUserId).slice(0, 6)}`);

                return (
                  <div
                    key={p.otherUserId}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "10px 12px",
                      borderRadius: 999,
                      border: active ? "2px solid #1d4ed8" : "1px solid #e5e7eb",
                      background: active ? "#eff6ff" : "white",
                      cursor: "pointer",
                      maxWidth: "100%",
                    }}
                    title={label}
                    onClick={() => onSelectPerson(p.otherUserId)}
                  >
                    <span style={{ fontWeight: 900, color: "#111827", maxWidth: 240, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {label}
                    </span>

                    {/* Hide (archive) */}
                    <button
                      onClick={async (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        await archiveConversation(p.conversationId);
                        // reload list; if we archived the active one, it will select the next available automatically
                        await loadAll();
                      }}
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: 999,
                        border: "1px solid #e5e7eb",
                        background: "white",
                        fontWeight: 900,
                        color: "#475569",
                        cursor: "pointer",
                        lineHeight: "22px",
                        textAlign: "center",
                      }}
                      title="Hide this conversation"
                    >
                      ×
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* MESSAGES */}
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
        {activeConversationId ? (
          messages.length ? (
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
          )
        ) : (
          <div style={{ color: "#475569", fontWeight: 700 }}>
            {isMine ? "No responder selected." : "Could not open conversation."}
          </div>
        )}
      </div>

      {/* COMPOSER */}
      <div style={{ marginTop: 12, display: "flex", gap: 10 }}>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={activeConversationId ? "Write a message…" : "Open a thread to message…"}
          disabled={!activeConversationId || sending}
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
          disabled={!activeConversationId || sending || !draft.trim()}
          style={{
            padding: "12px 16px",
            borderRadius: 14,
            border: "none",
            background: "#2563eb",
            color: "white",
            fontWeight: 900,
            cursor: "pointer",
            opacity: !activeConversationId || sending || !draft.trim() ? 0.5 : 1,
          }}
        >
          Send
        </button>
      </div>

      {err && <div style={{ marginTop: 12, color: "#ef4444" }}>{err}</div>}
    </div>
  );
}
