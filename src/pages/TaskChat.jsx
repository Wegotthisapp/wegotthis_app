import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";

// PEOPLE chips palette (distinct from Inbox blue/violet)
const PERSON_COLORS = [
  { bg: "#fce7f3", border: "#f9a8d4" }, // pink
  { bg: "#ffedd5", border: "#fdba74" }, // orange
  { bg: "#fef9c3", border: "#fde047" }, // yellow
  { bg: "#dcfce7", border: "#86efac" }, // green
  { bg: "#ccfbf1", border: "#5eead4" }, // teal
  { bg: "#f3f4f6", border: "#d1d5db" }, // gray
];

function safeName(profile, fallback) {
  if (!profile) return fallback;
  return profile.nickname || profile.full_name || profile.username || fallback;
}

function makePairKey(a, b) {
  const [x, y] = [a, b].sort();
  return `${x}_${y}`;
}

export default function TaskChat() {
  const { taskId, otherUserId } = useParams();
  const navigate = useNavigate();

  const [userId, setUserId] = useState(null);

  const [task, setTask] = useState(null);
  const [people, setPeople] = useState([]); // responders list: [{otherUserId, conversationId, lastMessageAt, profile}]
  const [activeOtherId, setActiveOtherId] = useState(otherUserId || null);
  const [activeConversationId, setActiveConversationId] = useState(null);

  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data?.user?.id || null));
  }, []);

  const personColorMap = useMemo(() => {
    const map = new Map();
    people.forEach((p, idx) => map.set(p.otherUserId, PERSON_COLORS[idx % PERSON_COLORS.length]));
    return map;
  }, [people]);

  async function loadMessages(convoId) {
    const { data, error } = await supabase
      .from("messages")
      .select("id,conversation_id,sender_id,body,created_at")
      .eq("conversation_id", convoId)
      .order("created_at", { ascending: true });

    if (error) console.error(error);
    setMessages(data || []);
  }

  async function getOrCreateConversation(taskId, me, other) {
    const pair_key = makePairKey(me, other);

    // 1) try select
    const { data: existing, error: selErr } = await supabase
      .from("conversations")
      .select("id")
      .eq("task_id", taskId)
      .eq("pair_key", pair_key)
      .maybeSingle();

    if (selErr) console.error(selErr);
    if (existing?.id) return existing.id;

    // 2) insert (race-safe due to unique constraint task_id+pair_key)
    const { data: inserted, error: insErr } = await supabase
      .from("conversations")
      .insert({
        task_id: taskId,
        user1_id: me,
        user2_id: other,
        pair_key,
        last_message_at: new Date().toISOString(),
      })
      .select("id")
      .maybeSingle();

    if (!insErr && inserted?.id) return inserted.id;

    // 3) if insert failed (likely race), re-select
    if (insErr) console.error(insErr);
    const { data: again } = await supabase
      .from("conversations")
      .select("id")
      .eq("task_id", taskId)
      .eq("pair_key", pair_key)
      .maybeSingle();

    return again?.id || null;
  }

  async function loadAll() {
    if (!userId || !taskId) return;
    setLoading(true);

    // 1) task
    const { data: taskRow, error: taskErr } = await supabase
      .from("tasks")
      .select("id,title,user_id,status,price,created_at,description")
      .eq("id", taskId)
      .maybeSingle();

    if (taskErr || !taskRow) {
      console.error(taskErr);
      setLoading(false);
      return;
    }
    setTask(taskRow);

    const isMine = taskRow.user_id === userId;

    // 2) If NOT my task: go straight to owner thread (no “select a person”)
    if (!isMine) {
      const ownerId = taskRow.user_id;
      const targetOther = otherUserId || ownerId;

      const convoId = await getOrCreateConversation(taskId, userId, targetOther);
      setActiveOtherId(targetOther);
      setActiveConversationId(convoId);

      if (convoId) await loadMessages(convoId);

      // no need to load responders chips for non-owner view (optional, but keep UI clean)
      setPeople([]);
      setLoading(false);
      return;
    }

    // 3) If my task: load responders (people who have conversations on this task)
    const { data: convs, error: convErr } = await supabase
      .from("conversations")
      .select("id,user1_id,user2_id,last_message_at")
      .eq("task_id", taskId)
      .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
      .order("last_message_at", { ascending: false });

    if (convErr) {
      console.error(convErr);
      setPeople([]);
      setLoading(false);
      return;
    }

    const convoRows = convs || [];
    const otherIds = convoRows.map((c) => (c.user1_id === userId ? c.user2_id : c.user1_id));

    // profiles (adjust table name/fields if yours differ)
    const { data: profs } = await supabase
      .from("profiles")
      .select("id,full_name,username,nickname,avatar_url")
      .in("id", otherIds);

    const profMap = new Map((profs || []).map((p) => [p.id, p]));

    const builtPeople = convoRows.map((c) => {
      const oid = c.user1_id === userId ? c.user2_id : c.user1_id;
      return {
        otherUserId: oid,
        conversationId: c.id,
        lastMessageAt: c.last_message_at || null,
        profile: profMap.get(oid) || null,
      };
    });

    setPeople(builtPeople);

    const initialOther = otherUserId || activeOtherId || builtPeople[0]?.otherUserId || null;
    setActiveOtherId(initialOther);

    const initialConvo = builtPeople.find((p) => p.otherUserId === initialOther)?.conversationId || null;
    setActiveConversationId(initialConvo);

    if (initialConvo) await loadMessages(initialConvo);
    else setMessages([]);

    setLoading(false);
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, taskId, otherUserId]);

  async function onSelectPerson(oid) {
    setActiveOtherId(oid);
    const convoId = people.find((p) => p.otherUserId === oid)?.conversationId || null;
    setActiveConversationId(convoId);
    navigate(`/chat/task/${taskId}/user/${oid}`, { replace: true });
    if (convoId) await loadMessages(convoId);
  }

  async function send() {
    if (!draft.trim() || !activeConversationId || !userId) return;
    setSending(true);

    const body = draft.trim();
    setDraft("");

    const { error: msgErr } = await supabase.from("messages").insert({
      conversation_id: activeConversationId,
      sender_id: userId,
      body,
    });

    if (msgErr) {
      console.error(msgErr);
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

  async function setStatus(newStatus) {
    if (!task) return;
    await supabase.from("tasks").update({ status: newStatus }).eq("id", task.id);
    setTask({ ...task, status: newStatus });
  }

  if (loading)
    return <div style={{ maxWidth: 900, margin: "0 auto", padding: 24, color: "#111827" }}>Loading…</div>;
  if (!task)
    return <div style={{ maxWidth: 900, margin: "0 auto", padding: 24, color: "#111827" }}>Task not found.</div>;

  const isMine = task.user_id === userId;

  const activeProfile = people.find((p) => p.otherUserId === activeOtherId)?.profile || null;
  const personLabel = safeName(activeProfile, "Someone");
  const headerTitle = isMine ? task.title : `${task.title} — ${personLabel}`;

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: 24, color: "#111827" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, color: "#111827" }}>Chat</h2>
          <div style={{ color: "#6b7280", marginTop: 6 }}>
            {isMine ? "Pick a person to open a 1:1 thread." : "Direct chat with the task owner."}
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
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Back
        </button>
      </div>

      {/* PEOPLE SELECTOR (only for my tasks) */}
      {isMine && (
        <div style={{ marginTop: 18 }}>
          <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 8 }}>
            PEOPLE WHO RESPONDED ({people.length})
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            {people.map((p) => {
              const c = personColorMap.get(p.otherUserId);
              const active = p.otherUserId === activeOtherId;
              const label = safeName(p.profile, `User ${p.otherUserId.slice(0, 6)}`);

              return (
                <button
                  key={p.otherUserId}
                  onClick={() => onSelectPerson(p.otherUserId)}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 999,
                    border: `2px solid ${active ? c.border : "transparent"}`,
                    background: c.bg,
                    color: "#111827",
                    fontWeight: 800,
                    cursor: "pointer",
                    maxWidth: "100%",
                  }}
                  title={label}
                >
                  <span
                    style={{
                      display: "inline-block",
                      maxWidth: 240,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {label}
                  </span>
                </button>
              );
            })}

            {people.length === 0 && (
              <div style={{ padding: 12, border: "1px solid #e5e7eb", borderRadius: 14, color: "#6b7280" }}>
                No one has messaged on this task yet.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TASK DETAILS WINDOW */}
      <div style={{ marginTop: 18, border: "1px solid #e5e7eb", borderRadius: 18, padding: 16, background: "white" }}>
        <div style={{ fontWeight: 900, fontSize: 16, color: "#111827" }}>{headerTitle}</div>

        <div style={{ display: "flex", gap: 18, marginTop: 12, alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 12, color: "#6b7280" }}>STATUS</div>
            <div style={{ fontWeight: 800, marginTop: 4, color: "#111827" }}>{task.status || "open"}</div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: "#6b7280" }}>PRICE</div>
            <div style={{ fontWeight: 800, marginTop: 4, color: "#111827" }}>{task.price ?? "—"}</div>
          </div>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 14 }}>
          <button style={btnSoft} disabled={!activeConversationId}>
            Counter
          </button>
          <button style={btnPrimary} disabled={!activeConversationId}>
            Accept offer
          </button>
          <button style={btnSoft} disabled={!activeConversationId}>
            Agree price
          </button>
          <button style={btnSoft} onClick={() => navigate(`/task/${task.id}`)}>
            Open task
          </button>
          {isMine && (
            <button
              style={btnSoft}
              onClick={() => setStatus("completed")}
              disabled={task.status === "completed"}
              title="Mark task completed"
            >
              Mark done
            </button>
          )}
        </div>

        {task.description ? (
          <div style={{ marginTop: 14, color: "#374151", lineHeight: 1.5 }}>{task.description}</div>
        ) : null}
      </div>

      {/* MESSAGES */}
      <div
        style={{
          marginTop: 18,
          border: "1px solid #e5e7eb",
          borderRadius: 18,
          padding: 16,
          background: "#fafafa",
          minHeight: 260,
          maxHeight: 420,
          overflowY: "auto",
        }}
      >
        {activeConversationId ? (
          messages.length ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {messages.map((m) => {
                const mine = m.sender_id === userId;
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
                    >
                      {m.body}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ color: "#6b7280" }}>No messages yet in this thread.</div>
          )
        ) : (
          <div style={{ color: "#6b7280" }}>Select a person above to open the thread.</div>
        )}
      </div>

      {/* COMPOSER */}
      <div style={{ marginTop: 12, display: "flex", gap: 10 }}>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={activeConversationId ? "Write a message…" : "Select a person to message…"}
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
            fontWeight: 800,
            cursor: "pointer",
            opacity: !activeConversationId || sending || !draft.trim() ? 0.5 : 1,
          }}
        >
          Send
        </button>
      </div>
    </div>
  );
}

const btnSoft = {
  padding: "10px 14px",
  borderRadius: 999,
  border: "1px solid #e5e7eb",
  background: "white",
  color: "#111827",
  fontWeight: 800,
  cursor: "pointer",
};

const btnPrimary = {
  padding: "10px 14px",
  borderRadius: 999,
  border: "none",
  background: "#34d399",
  color: "#064e3b",
  fontWeight: 900,
  cursor: "pointer",
};
