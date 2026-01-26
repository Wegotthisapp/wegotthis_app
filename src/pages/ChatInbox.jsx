import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

function formatDate(dt) {
  if (!dt) return "";
  try {
    return new Date(dt).toLocaleString();
  } catch {
    return "";
  }
}

export default function ChatInbox() {
  const [userId, setUserId] = useState(null);
  const [tab, setTab] = useState("active");
  const [rows, setRows] = useState([]);
  const [pins, setPins] = useState(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data?.user?.id || null));
  }, []);

  async function load() {
    if (!userId) return;
    setLoading(true);

    const { data: pinRows } = await supabase
      .from("task_pins")
      .select("task_id")
      .eq("user_id", userId);

    const pinSet = new Set((pinRows || []).map((p) => p.task_id));
    setPins(pinSet);

    const { data: convs, error: convErr } = await supabase
      .from("conversations")
      .select("task_id,last_message_at,user_a,user_b")
      .or(`user_a.eq.${userId},user_b.eq.${userId}`)
      .not("task_id", "is", null);

    if (convErr) {
      console.error(convErr);
      setRows([]);
      setLoading(false);
      return;
    }

    const taskIds = Array.from(new Set((convs || []).map((c) => c.task_id)));
    if (taskIds.length === 0) {
      setRows([]);
      setLoading(false);
      return;
    }

    const lastByTask = {};
    for (const c of convs || []) {
      const t = c.task_id;
      const v = c.last_message_at || null;
      if (!lastByTask[t] || (v && new Date(v) > new Date(lastByTask[t]))) lastByTask[t] = v;
    }

    const { data: tasks, error: taskErr } = await supabase
      .from("tasks")
      .select("id,title,user_id,status,price,created_at")
      .in("id", taskIds);

    if (taskErr) {
      console.error(taskErr);
      setRows([]);
      setLoading(false);
      return;
    }

    const filtered = (tasks || []).filter((t) =>
      tab === "completed" ? t.status === "completed" : t.status !== "completed"
    );

    const built = filtered.map((t) => {
      const isMine = t.user_id === userId;
      const last = lastByTask[t.id] || t.created_at;
      const displayTitle = t.title;

      return {
        task: t,
        isMine,
        lastActivity: last,
        isPinned: pinSet.has(t.id),
        displayTitle,
      };
    });

    built.sort((a, b) => {
      if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
      return new Date(b.lastActivity) - new Date(a.lastActivity);
    });

    setRows(built);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, tab]);

  async function togglePin(taskId) {
    if (!userId) return;
    const isPinned = pins.has(taskId);

    if (isPinned) {
      await supabase.from("task_pins").delete().eq("user_id", userId).eq("task_id", taskId);
    } else {
      await supabase.from("task_pins").insert({ user_id: userId, task_id: taskId });
    }
    await load();
  }

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: 24 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <h2 style={{ margin: 0 }}>Chat</h2>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => setTab("active")}
            style={{
              padding: "8px 12px",
              borderRadius: 999,
              border: "1px solid #e5e7eb",
              background: tab === "active" ? "#eef2ff" : "white",
              cursor: "pointer",
            }}
          >
            Active
          </button>
          <button
            onClick={() => setTab("completed")}
            style={{
              padding: "8px 12px",
              borderRadius: 999,
              border: "1px solid #e5e7eb",
              background: tab === "completed" ? "#eef2ff" : "white",
              cursor: "pointer",
            }}
          >
            Completed
          </button>
        </div>
      </div>

      <div style={{ marginTop: 12, color: "#6b7280" }}>
        Your chats are grouped by task. Open a task to see people who responded.
      </div>

      {loading ? (
        <div style={{ marginTop: 18 }}>Loading…</div>
      ) : rows.length === 0 ? (
        <div style={{ marginTop: 18 }}>No chats yet.</div>
      ) : (
        <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 12 }}>
          {rows.map((r) => {
            const bg = r.isMine ? "#ede9fe" : "#dbeafe";
            const border = r.isMine ? "#c4b5fd" : "#93c5fd";

            return (
              <div
                key={r.task.id}
                style={{
                  border: `1px solid ${border}`,
                  background: bg,
                  borderRadius: 14,
                  padding: 14,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {r.displayTitle}
                  </div>
                  <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>
                    Last activity: {formatDate(r.lastActivity)}
                  </div>
                </div>

                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <button
                    onClick={() => togglePin(r.task.id)}
                    style={{
                      padding: "8px 10px",
                      borderRadius: 999,
                      border: "1px solid #e5e7eb",
                      background: "white",
                      cursor: "pointer",
                      fontWeight: 600,
                    }}
                    title={r.isPinned ? "Unpin" : "Pin to top"}
                  >
                    {r.isPinned ? "Pinned" : "Pin"}
                  </button>

                  <Link
                    to={`/chat/task/${r.task.id}`}
                    style={{
                      padding: "10px 14px",
                      borderRadius: 999,
                      background: "#2563eb",
                      color: "white",
                      textDecoration: "none",
                      fontWeight: 700,
                      whiteSpace: "nowrap",
                    }}
                  >
                    Open
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
