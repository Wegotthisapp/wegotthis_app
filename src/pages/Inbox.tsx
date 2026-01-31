import React, { useEffect, useMemo, useState } from "react";
import { fetchInbox, type InboxRow } from "../data/inbox";
import { useAuth } from "../auth/useAuth";
import { useNavigate } from "react-router-dom";

type Tab = "mine" | "responded";

export default function Inbox() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [rows, setRows] = useState<InboxRow[]>([]);
  const [tab, setTab] = useState<Tab>("mine");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    async function run() {
      if (!user?.id) return;
      setLoading(true);
      try {
        const r = await fetchInbox(user.id);
        if (alive) setRows(r);
      } finally {
        if (alive) setLoading(false);
      }
    }
    run();
    return () => {
      alive = false;
    };
  }, [user?.id]);

  const { myTasks, respondedTasks } = useMemo(() => {
    const mine: InboxRow[] = [];
    const responded: InboxRow[] = [];
    for (const r of rows) {
      if (r.task_owner_id === user?.id) mine.push(r);
      else responded.push(r);
    }
    return { myTasks: mine, respondedTasks: responded };
  }, [rows, user?.id]);

  const active = tab === "mine" ? myTasks : respondedTasks;

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <h1 style={styles.title}>Inbox</h1>

        <div style={styles.tabs}>
          <button
            style={tab === "mine" ? styles.tabActive : styles.tab}
            onClick={() => setTab("mine")}
          >
            My tasks
          </button>
          <button
            style={tab === "responded" ? styles.tabActive : styles.tab}
            onClick={() => setTab("responded")}
          >
            Tasks I responded to
          </button>
        </div>
      </div>

      <div style={styles.subhead}>
        {tab === "mine" ? "Chats on tasks you posted" : "Chats on tasks you responded to"}
      </div>

      <div style={styles.list}>
        {loading ? (
          <div style={styles.empty}>Loading…</div>
        ) : active.length === 0 ? (
          <div style={styles.empty}>No chats yet.</div>
        ) : (
          active.map((r) => (
            <InboxRowItem
              key={`${r.task_id}:${r.conversation_id}`}
              row={r}
              isMine={r.task_owner_id === user?.id}
              onOpen={() =>
                navigate(`/chat/task/${r.task_id}/user/${r.other_user_id}`)
              }
            />
          ))
        )}
      </div>
    </div>
  );
}

function InboxRowItem({
  row,
  isMine,
  onOpen,
}: {
  row: InboxRow;
  isMine: boolean;
  onOpen: () => void;
}) {
  const tone = getTone(isMine, row.task_type);

  return (
    <button
      onClick={onOpen}
      style={{
        ...styles.card,
        borderColor: tone.cardBorder,
        boxShadow: `inset 4px 0 0 ${tone.strip}`,
      }}
    >
      <div style={styles.cardTop}>
        <div style={styles.cardBody}>
          <div style={styles.cardTitle}>{row.task_title}</div>

          <div style={styles.cardPreview}>
            {row.last_message_text ?? "No messages yet"}
          </div>

          <div style={styles.cardMeta}>
            {row.last_message_at
              ? new Date(row.last_message_at).toLocaleString()
              : "—"}
          </div>
        </div>

        <TaskChip isMine={isMine} taskType={row.task_type} />
      </div>
    </button>
  );
}

function TaskChip({
  isMine,
  taskType,
}: {
  isMine: boolean;
  taskType: "ask" | "offer";
}) {
  const label =
    taskType === "offer"
      ? isMine
        ? "My offer"
        : "Offer"
      : isMine
        ? "My request"
        : "Request";
  const tone = getTone(isMine, taskType);

  return (
    <span
      style={{
        ...styles.chip,
        background: tone.chipBg,
        borderColor: tone.chipBorder,
        color: tone.chipText,
      }}
    >
      {label}
    </span>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    maxWidth: 900,
    margin: "0 auto",
    padding: 24,
    backgroundImage: "linear-gradient(180deg, #f8fafc 0%, #ffffff 60%)",
    borderRadius: 24,
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    flexWrap: "wrap",
  },
  title: {
    margin: 0,
    fontSize: 24,
    fontWeight: 900,
    letterSpacing: "-0.02em",
    color: "#0f172a",
  },
  subhead: {
    marginTop: 8,
    color: "#64748b",
    fontSize: 13,
    fontWeight: 600,
  },
  tabs: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    background: "rgba(255,255,255,0.9)",
    border: "1px solid #e2e8f0",
    borderRadius: 999,
    padding: 4,
    boxShadow: "0 2px 6px rgba(15, 23, 42, 0.06)",
  },
  tab: {
    padding: "8px 12px",
    borderRadius: 999,
    border: "none",
    background: "transparent",
    color: "#334155",
    fontWeight: 700,
    cursor: "pointer",
  },
  tabActive: {
    padding: "8px 12px",
    borderRadius: 999,
    border: "none",
    background: "#0f172a",
    color: "white",
    fontWeight: 700,
    cursor: "pointer",
  },
  list: {
    marginTop: 16,
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  empty: {
    padding: 16,
    borderRadius: 14,
    border: "1px solid #e2e8f0",
    background: "white",
    color: "#64748b",
  },
  card: {
    width: "100%",
    textAlign: "left",
    borderRadius: 16,
    border: "1px solid #e2e8f0",
    background: "white",
    padding: 16,
    boxShadow: "0 10px 20px rgba(15, 23, 42, 0.06)",
    cursor: "pointer",
    transition: "transform 150ms ease, box-shadow 150ms ease",
  },
  cardTop: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  cardBody: {
    minWidth: 0,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 800,
    color: "#0f172a",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  cardPreview: {
    marginTop: 6,
    color: "#475569",
    fontSize: 14,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  cardMeta: {
    marginTop: 8,
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: 600,
  },
  chip: {
    borderRadius: 999,
    border: "1px solid #cbd5f5",
    background: "#eef2ff",
    color: "#4338ca",
    fontSize: 12,
    fontWeight: 800,
    padding: "6px 10px",
    whiteSpace: "nowrap",
  },
};

function getTone(isMine: boolean, taskType: "ask" | "offer") {
  if (isMine) {
    if (taskType === "offer") {
      return {
        cardBg: "#ffffff",
        cardBorder: "#ede9fe",
        chipBg: "#ede9fe",
        chipBorder: "#c4b5fd",
        chipText: "#6d28d9",
        strip: "#a78bfa",
      };
    }
    return {
      cardBg: "#ffffff",
      cardBorder: "#ede9fe",
      chipBg: "#ede9fe",
      chipBorder: "#ddd6fe",
      chipText: "#6d28d9",
      strip: "#c4b5fd",
    };
  }
  if (taskType === "offer") {
    return {
      cardBg: "#ffffff",
      cardBorder: "#bfdbfe",
      chipBg: "#dbeafe",
      chipBorder: "#93c5fd",
      chipText: "#1d4ed8",
      strip: "#60a5fa",
    };
  }
  return {
    cardBg: "#ffffff",
    cardBorder: "#bfdbfe",
    chipBg: "#dbeafe",
    chipBorder: "#93c5fd",
    chipText: "#1d4ed8",
    strip: "#38bdf8",
  };
}
