import React, { useEffect, useMemo, useState } from "react";
import { fetchInbox, type InboxRow } from "../data/inbox";
import { taskColors } from "../ui/taskColors";
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
    <div className="mx-auto max-w-3xl p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900">Inbox</h1>

        <div className="flex rounded-lg border border-slate-200 bg-white p-1">
          <button
            className={[
              "px-3 py-1.5 text-sm rounded-md",
              tab === "mine"
                ? "bg-slate-900 text-white"
                : "text-slate-700 hover:bg-slate-100",
            ].join(" ")}
            onClick={() => setTab("mine")}
          >
            My tasks
          </button>
          <button
            className={[
              "px-3 py-1.5 text-sm rounded-md",
              tab === "responded"
                ? "bg-slate-900 text-white"
                : "text-slate-700 hover:bg-slate-100",
            ].join(" ")}
            onClick={() => setTab("responded")}
          >
            Tasks I responded to
          </button>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {loading ? (
          <div className="text-slate-600">Loading…</div>
        ) : active.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-4 text-slate-600">
            No chats yet.
          </div>
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
  const c = taskColors({ isMine, taskType: row.task_type });

  return (
    <button
      onClick={onOpen}
      className={[
        "w-full text-left rounded-xl border p-4 transition",
        "hover:shadow-sm",
        c.rowBg,
        c.rowBorder,
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className={["font-semibold truncate", c.titleText].join(" ")}>
            {row.task_title}
          </div>

          <div className={["mt-1 truncate text-sm", c.previewText].join(" ")}>
            {row.last_message_text ?? "No messages yet"}
          </div>

          <div className={["mt-2 text-xs", c.metaText].join(" ")}>
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
  const c = taskColors({ isMine, taskType });
  const label =
    taskType === "offer" ? (isMine ? "My offer" : "Offer") : isMine ? "My ask" : "Ask";

  return (
    <span
      className={[
        "shrink-0 inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium",
        c.chipBg,
        c.accentText,
      ].join(" ")}
    >
      {label}
    </span>
  );
}
