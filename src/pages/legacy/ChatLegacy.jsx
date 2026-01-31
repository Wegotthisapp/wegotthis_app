// LEGACY - do not use.
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";

const TYPE_COLORS = {
  ask: { bg: "#dbeafe", fg: "#1e40af", border: "#bfdbfe" },   // blue
  offer: { bg: "#ede9fe", fg: "#5b21b6", border: "#ddd6fe" }, // violet
};

function typeMeta(task_type) {
  const t = (task_type || "ask").toLowerCase();
  return TYPE_COLORS[t] || TYPE_COLORS.ask;
}

export default function ChatLegacy() {
  const navigate = useNavigate();

  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  // Task-inbox rows: one row per task_id
  const [rows, setRows] = useState([]);

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

  const fetchInbox = async () => {
    if (!me?.id) return;
    setLoading(true);
    setErr("");

    // 1) conversations where I am user_a or user_b
    const { data: convos, error: convoErr } = await supabase
      .from("conversations")
      .select("id, task_id, user_a, user_b, last_message_at")
      .or(`user_a.eq.${me.id},user_b.eq.${me.id}`)
      .order("last_message_at", { ascending: false, nullsFirst: false });

    if (convoErr) {
      setErr(convoErr.message);
      setRows([]);
      setLoading(false);
      return;
    }

    const conversations = (convos || []).filter((c) => c.task_id);

    if (conversations.length === 0) {
      setRows([]);
      setLoading(false);
      return;
    }

    // 2) get archived conversation ids for me (to hide ridiculous offers)
    const convoIds = conversations.map((c) => c.id);
    const { data: archives } = await supabase
      .from("conversation_archives")
      .select("conversation_id")
      .eq("user_id", me.id)
      .in("conversation_id", convoIds);

    const archivedSet = new Set((archives || []).map((a) => a.conversation_id));

    const visibleConversations = conversations.filter((c) => !archivedSet.has(c.id));
    if (visibleConversations.length === 0) {
      setRows([]);
      setLoading(false);
      return;
    }

    // 3) group by task_id (task-centric inbox)
    const grouped = new Map();
    for (const c of visibleConversations) {
      const key = c.task_id;
      const prev = grouped.get(key);
      const last = c.last_message_at ? new Date(c.last_message_at).getTime() : 0;
      if (!prev) {
        grouped.set(key, {
          task_id: key,
          last_message_at: c.last_message_at || null,
          convo_count: 1,
          last_ts: last,
        });
      } else {
        prev.convo_count += 1;
        if (last > prev.last_ts) {
          prev.last_ts = last;
          prev.last_message_at = c.last_message_at || prev.last_message_at;
        }
      }
    }

    const taskIds = [...grouped.keys()];

    // 4) fetch tasks metadata (title, owner, type)
    const { data: tasks, error: taskErr } = await supabase
      .from("tasks")
      .select("id, title, user_id, task_type")
      .in("id", taskIds);

    if (taskErr) {
      setErr(taskErr.message);
      setRows([]);
      setLoading(false);
      return;
    }

    const taskMap = new Map((tasks || []).map((t) => [t.id, t]));

    const built = taskIds
      .map((id) => {
        const g = grouped.get(id);
        const t = taskMap.get(id);
        if (!t) return null;
        return {
          task_id: id,
          title: t.title || "Task",
          owner_id: t.user_id,
          task_type: t.task_type || "ask",
          convo_count: g.convo_count,
          last_message_at: g.last_message_at,
          is_owner: t.user_id === me.id,
        };
      })
      .filter(Boolean)
      .sort((a, b) => {
        const at = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
        const bt = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
        return bt - at;
      });

    setRows(built);
    setLoading(false);
  };

  useEffect(() => {
    if (!me?.id) return;
    fetchInbox();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.id]);

  const myTasks = useMemo(() => rows.filter((r) => r.is_owner), [rows]);
  const responded = useMemo(() => rows.filter((r) => !r.is_owner), [rows]);

  if (!me) {
    return (
      <div style={{ maxWidth: 820, margin: "2rem auto", padding: 18 }}>
        <p style={{ color: "#ef4444" }}>{err || "Please log in"}</p>
      </div>
    );
  }

  const Section = ({ title, items }) => (
    <div style={{ marginTop: 14 }}>
      <div
        style={{
          fontSize: 12,
          letterSpacing: "0.12em",
          fontWeight: 900,
          color: "#64748b",
          marginBottom: 10,
          textTransform: "uppercase",
        }}
      >
        {title} ({items.length})
      </div>

      {items.length === 0 ? (
        <div style={{ padding: 12, border: "1px solid #e5e7eb", borderRadius: 14, color: "#64748b" }}>
          No chats here yet.
        </div>
      ) : (
        items.map((t) => {
          const m = typeMeta(t.task_type);
          return (
            <div
              key={t.task_id}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                padding: "0.8rem 0.9rem",
                border: "1px solid #e5e7eb",
                borderRadius: 14,
                marginBottom: 10,
                background: "white",
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <span
                    style={{
                      background: m.bg,
                      color: m.fg,
                      border: `1px solid ${m.border}`,
                      padding: "0.18rem 0.55rem",
                      borderRadius: 999,
                      fontWeight: 900,
                      fontSize: 12,
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                    }}
                    title={t.task_type === "offer" ? "Offer" : "Ask"}
                  >
                    {t.task_type === "offer" ? "OFFER" : "ASK"}
                  </span>

                  <span style={{ fontWeight: 900, color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {t.title}
                  </span>
                </div>

                <div style={{ fontSize: 13, color: "#475569", marginTop: 6 }}>
                  {t.is_owner ? `${t.convo_count} responder${t.convo_count === 1 ? "" : "s"}` : "You responded"}
                  {" · "}
                  {t.last_message_at ? new Date(t.last_message_at).toLocaleString() : "—"}
                </div>
              </div>

              <button
                onClick={() => navigate(`/chat/task/${t.task_id}`)}
                style={{
                  background: "#1d4ed8",
                  color: "white",
                  border: "none",
                  borderRadius: 999,
                  padding: "0.45rem 0.85rem",
                  fontWeight: 900,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                Open
              </button>
            </div>
          );
        })
      )}
    </div>
  );

  return (
    <div
      style={{
        maxWidth: 820,
        margin: "2rem auto",
        padding: 18,
        background: "#fff",
        borderRadius: 14,
        boxShadow: "0 0 12px rgba(0,0,0,0.08)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, color: "#0f172a" }}>Chat</h2>
          <div style={{ color: "#475569", marginTop: 6 }}>
            Chats are grouped by task. Open a task to manage responders.
          </div>
        </div>

        <Link to="/" style={{ color: "#1d4ed8", fontWeight: 800, textDecoration: "none" }}>
          Home
        </Link>
      </div>

      {loading && <p style={{ color: "#475569", marginTop: 12 }}>Loading…</p>}

      {!loading && rows.length === 0 && (
        <div style={{ marginTop: 14, padding: 12, border: "1px solid #e5e7eb", borderRadius: 14, color: "#475569" }}>
          No chats yet. Messages appear when someone contacts you about a task.
        </div>
      )}

      {!loading && rows.length > 0 && (
        <>
          <Section title="My tasks" items={myTasks} />
          <Section title="Tasks I responded to" items={responded} />
        </>
      )}

      {err && <p style={{ color: "#ef4444", marginTop: 12 }}>{err}</p>}
    </div>
  );
}
