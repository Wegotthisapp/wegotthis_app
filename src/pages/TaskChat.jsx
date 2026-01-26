import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

const PERSON_COLORS = [
  { name: "blue", bg: "#dbeafe", border: "#93c5fd" },
  { name: "violet", bg: "#ede9fe", border: "#c4b5fd" },
  { name: "pink", bg: "#fce7f3", border: "#f9a8d4" },
  { name: "orange", bg: "#ffedd5", border: "#fdba74" },
  { name: "yellow", bg: "#fef9c3", border: "#fde047" },
  { name: "green", bg: "#dcfce7", border: "#86efac" },
];

function safeName(profile, fallback) {
  if (!profile) return fallback;
  return profile.nickname || profile.full_name || profile.username || fallback;
}

export default function TaskChat() {
  const { taskId, otherUserId } = useParams();
  const navigate = useNavigate();

  const [userId, setUserId] = useState(null);

  const [task, setTask] = useState(null);
  const [people, setPeople] = useState([]);
  const [activeOtherId, setActiveOtherId] = useState(otherUserId || null);
  const [activeConversationId, setActiveConversationId] = useState(null);

  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data?.user?.id || null));
  }, []);

  useEffect(() => {
    if (otherUserId) setActiveOtherId(otherUserId);
  }, [otherUserId]);

  async function ensureConversation(targetUserId) {
    if (!userId || !taskId || !targetUserId) return null;
    const a = [userId, targetUserId].sort()[0];
    const b = [userId, targetUserId].sort()[1];
    const pairKey = `${a}:${b}`;

    const { data: existingConv, error: findErr } = await supabase
      .from("conversations")
      .select("id")
      .eq("pair_key", pairKey)
      .eq("task_id", taskId)
      .maybeSingle();

    if (findErr) {
      console.error(findErr);
      return null;
    }

    if (existingConv?.id) return existingConv.id;

    const { data: createdConv, error: createErr } = await supabase
      .from("conversations")
      .insert([{ user_a: a, user_b: b, task_id: taskId }])
      .select("id")
      .single();

    if (createErr) {
      console.error(createErr);
      return null;
    }

    return createdConv?.id || null;
  }

  async function loadAll() {
    if (!userId || !taskId) return;
    setLoading(true);

    if (otherUserId) {
      await ensureConversation(otherUserId);
    }

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

    const { data: convs, error: convErr } = await supabase
      .from("conversations")
      .select("id,task_id,user_a,user_b,last_message_at")
      .eq("task_id", taskId)
      .or(`user_a.eq.${userId},user_b.eq.${userId}`)
      .order("last_message_at", { ascending: false });

    if (convErr) {
      console.error(convErr);
      setPeople([]);
      setLoading(false);
      return;
    }

    const convoRows = convs || [];
    const otherIds = convoRows.map((c) => (c.user_a === userId ? c.user_b : c.user_a));

    const { data: profs } = await supabase
      .from("profiles")
      .select("id,full_name,username,nickname,avatar_url")
      .in("id", otherIds);

    const profMap = new Map((profs || []).map((p) => [p.id, p]));

    const builtPeople = convoRows.map((c) => {
      const oid = c.user_a === userId ? c.user_b : c.user_a;
      return {
        otherUserId: oid,
        conversationId: c.id,
        lastMessageAt: c.last_message_at || null,
        profile: profMap.get(oid) || null,
      };
    });

    setPeople(builtPeople);

    const initialOther = otherUserId || activeOtherId || (builtPeople[0]?.otherUserId ?? null);
    setActiveOtherId(initialOther);

    const initialConvo = builtPeople.find((p) => p.otherUserId === initialOther)?.conversationId || null;
    setActiveConversationId(initialConvo);

    if (initialConvo) {
      await loadMessages(initialConvo);
    } else {
      setMessages([]);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, taskId]);

  const personColorMap = useMemo(() => {
    const map = new Map();
    people.forEach((p, idx) => map.set(p.otherUserId, PERSON_COLORS[idx % PERSON_COLORS.length]));
    return map;
  }, [people]);

  function onSelectPerson(oid) {
    setActiveOtherId(oid);
    const convoId = people.find((p) => p.otherUserId === oid)?.conversationId || null;
    setActiveConversationId(convoId);
    navigate(`/chat/task/${taskId}/user/${oid}`, { replace: true });
    if (convoId) loadMessages(convoId);
  }

  async function loadMessages(convoId) {
    const { data: msgs, error } = await supabase
      .from("messages")
      .select("id,conversation_id,sender_id,body,created_at")
      .eq("conversation_id", convoId)
      .order("created_at", { ascending: true });

    if (error) console.error(error);
    setMessages(msgs || []);
  }

  async function send() {
    if (!draft.trim() || !activeConversationId || !userId) return;
    setSending(true);

    const body = draft.trim();
    setDraft("");

    const { error: msgErr } = await supabase.from("messages").insert([
      {
        conversation_id: activeConversationId,
        task_id: taskId,
        sender_id: userId,
        receiver_id: activeOtherId,
        body,
      },
    ]);

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

  if (loading) return <div style={{ maxWidth: 900, margin: "0 auto", padding: 24 }}>Loading…</div>;
  if (!task) return <div style={{ maxWidth: 900, margin: "0 auto", padding: 24 }}>Task not found.</div>;

  const isMine = task.user_id === userId;
  const activeProfile = people.find((p) => p.otherUserId === activeOtherId)?.profile || null;
  const personLabel = safeName(activeProfile, "Someone");
  const headerTitle = isMine ? task.title : `${task.title} — ${personLabel}`;

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: 24 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div>
          <h2 style={{ margin: 0 }}>Chat</h2>
          <div style={{ color: "#6b7280", marginTop: 6 }}>
            Task hub — pick a person to see your 1:1 thread.
          </div>
        </div>
        <button
          onClick={() => navigate("/chat")}
          style={{ padding: "10px 14px", borderRadius: 999, border: "1px solid #e5e7eb", background: "white" }}
        >
          Back
        </button>
      </div>

      <div style={{ marginTop: 18 }}>
        <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 8 }}>
          PEOPLE WHO RESPONDED ({people.length})
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {people.map((p) => {
            const c = personColorMap.get(p.otherUserId);
            const active = p.otherUserId === activeOtherId;
            const label = safeName(p.profile, `User ${p.otherUserId.slice(0, 6)}`);

            return (
              <button
                key={p.otherUserId}
                onClick={() => onSelectPerson(p.otherUserId)}
                style={{
                  width: "100%",
                  textAlign: "left",
                  padding: "12px 14px",
                  borderRadius: 16,
                  border: `2px solid ${active ? c.border : "transparent"}`,
                  background: c.bg,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                }}
              >
                <div style={{ fontWeight: 800, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {label}
                </div>
                <div style={{ fontSize: 12, color: "#6b7280", whiteSpace: "nowrap" }}>
                  {p.lastMessageAt ? new Date(p.lastMessageAt).toLocaleString() : ""}
                </div>
              </button>
            );
          })}
          {people.length === 0 && (
            <div style={{ padding: 14, border: "1px solid #e5e7eb", borderRadius: 14, color: "#6b7280" }}>
              No one has messaged on this task yet.
            </div>
          )}
        </div>
      </div>

      <div
        style={{
          marginTop: 18,
          border: "1px solid #e5e7eb",
          borderRadius: 18,
          padding: 16,
          background: "white",
        }}
      >
        <div style={{ fontWeight: 900, fontSize: 16 }}>{headerTitle}</div>

        <div style={{ display: "flex", gap: 18, marginTop: 12, alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 12, color: "#6b7280" }}>STATUS</div>
            <div style={{ fontWeight: 800, marginTop: 4 }}>{task.status || "open"}</div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: "#6b7280" }}>PRICE</div>
            <div style={{ fontWeight: 800, marginTop: 4 }}>{task.price ?? "—"}</div>
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
          <button
            style={btnSoft}
            onClick={() => setStatus("completed")}
            disabled={task.status === "completed"}
            title="Mark task completed"
          >
            Mark done
          </button>
        </div>

        {task.description ? (
          <div style={{ marginTop: 14, color: "#374151", lineHeight: 1.5 }}>{task.description}</div>
        ) : null}
      </div>

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
                        background: mine ? "#dbeafe" : "white",
                        border: "1px solid #e5e7eb",
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
  fontWeight: 800,
  cursor: "pointer",
};

const btnPrimary = {
  padding: "10px 14px",
  borderRadius: 999,
  border: "none",
  background: "#34d399",
  color: "white",
  fontWeight: 900,
  cursor: "pointer",
};
