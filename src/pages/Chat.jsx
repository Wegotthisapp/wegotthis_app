import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

const BLUE = "#1d4ed8";

const CHIP_COLORS = [
  "#60a5fa", // 1) blue
  "#a78bfa", // 2) violet
  "#fb7185", // 3) radish/rose
  "#fb923c", // 4) orange
  "#facc15", // 5) yellow
  "#34d399", // 6) green
];

function pickColor(colorIndex) {
  if (Number.isFinite(colorIndex)) return CHIP_COLORS[colorIndex % CHIP_COLORS.length];
  return CHIP_COLORS[0];
}

function hexToRgba(hex, alpha) {
  if (!hex) return `rgba(0, 0, 0, ${alpha})`;
  const normalized = hex.replace("#", "");
  if (normalized.length !== 6) return `rgba(0, 0, 0, ${alpha})`;
  const int = Number.parseInt(normalized, 16);
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function StatusPill({ status }) {
  const label = status || "—";
  const bg =
    label === "open"
      ? "#e0f2fe"
      : label === "agreed"
      ? "#dcfce7"
      : label === "closed"
      ? "#fee2e2"
      : "#f1f5f9";
  const fg =
    label === "open"
      ? "#075985"
      : label === "agreed"
      ? "#166534"
      : label === "closed"
      ? "#991b1b"
      : "#334155";

  return (
    <span
      style={{
        background: bg,
        color: fg,
        padding: "0.25rem 0.55rem",
        borderRadius: 999,
        fontSize: "0.8rem",
        fontWeight: 800,
        textTransform: "capitalize",
      }}
    >
      {label}
    </span>
  );
}

export default function Chat() {
  const { conversationId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const safeConversationId =
    conversationId && conversationId !== "null" && conversationId !== "undefined"
      ? conversationId
      : null;

  const [me, setMe] = useState(null);
  const [activeConversationId, setActiveConversationId] = useState(null);

  // legacy; keep for now
  const [activeTaskId, setActiveTaskId] = useState(null);

  // new context
  const [activeConversationTaskId, setActiveConversationTaskId] = useState(null);

  const [receiverId, setReceiverId] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [messages, setMessages] = useState([]);
  const [taskTitles, setTaskTitles] = useState({});
  const [newMessage, setNewMessage] = useState("");
  const [error, setError] = useState("");
  const [loadingInbox, setLoadingInbox] = useState(false);
  const [loadingThread, setLoadingThread] = useState(false);

  const [conversationTasks, setConversationTasks] = useState([]);
  const [loadingTasksBar, setLoadingTasksBar] = useState(false);

  const [showTaskPanel, setShowTaskPanel] = useState(true);
  const [activeTaskDetails, setActiveTaskDetails] = useState(null);
  const [loadingTaskDetails, setLoadingTaskDetails] = useState(false);

  const listRef = useRef(null);
  const isThread = Boolean(safeConversationId);

  const isMine = useMemo(
    () => (msg) => me && msg.sender_id === me.id,
    [me]
  );

  const ctById = useMemo(() => {
    const map = new Map();
    for (const ct of conversationTasks) map.set(ct.id, ct);
    return map;
  }, [conversationTasks]);

  const activeCT = useMemo(() => {
    if (!activeConversationTaskId) return null;
    return conversationTasks.find((ct) => ct.id === activeConversationTaskId) || null;
  }, [activeConversationTaskId, conversationTasks]);

  const activeColor = useMemo(() => pickColor(activeCT?.color_index), [activeCT?.color_index]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data, error } = await supabase.auth.getUser();
      if (!mounted) return;
      if (error || !data?.user) setError("Please log in");
      else setMe(data.user);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // pick up context from navigation state / query param
  useEffect(() => {
    const fromState = location?.state?.activeConversationTaskId || null;
    const fromQuery = new URLSearchParams(location.search).get("ct") || null;
    const next = fromState || fromQuery || null;
    if (next) setActiveConversationTaskId(next);
  }, [location?.state, location.search]);

  const fetchInbox = async () => {
    if (!me?.id) return;
    setLoadingInbox(true);
    setError("");

    const { data: convoData, error: convoError } = await supabase
      .from("conversations")
      .select("id, task_id, user_a, user_b, last_message_at")
      .or(`user_a.eq.${me.id},user_b.eq.${me.id}`)
      .order("last_message_at", { ascending: false, nullsFirst: false });

    if (convoError) {
      setError(convoError.message);
      setConversations([]);
      setLoadingInbox(false);
      return;
    }

    const conversationsList = convoData || [];
    const conversationIds = conversationsList.map((conv) => conv.id);
    const taskIds = [...new Set(conversationsList.map((conv) => conv.task_id).filter(Boolean))];

    let unreadByConversation = {};
    if (conversationIds.length > 0) {
      const { data: unreadRows, error: unreadError } = await supabase
        .from("messages")
        .select("id, conversation_id")
        .in("conversation_id", conversationIds)
        .is("read_at", null)
        .neq("sender_id", me.id);

      if (!unreadError) {
        unreadByConversation = (unreadRows || []).reduce((acc, row) => {
          acc[row.conversation_id] = (acc[row.conversation_id] || 0) + 1;
          return acc;
        }, {});
      }
    }

    let titles = {};
    if (taskIds.length > 0) {
      const { data: taskRows } = await supabase.from("tasks").select("id, title").in("id", taskIds);
      titles = (taskRows || []).reduce((acc, row) => {
        acc[row.id] = row.title || "Task";
        return acc;
      }, {});
    }

    setTaskTitles(titles);

    const mapped = conversationsList.map((conv) => {
      const otherId = conv.user_a === me.id ? conv.user_b : conv.user_a;
      return {
        ...conv,
        otherUserId: otherId,
        unreadCount: unreadByConversation[conv.id] || 0,
      };
    });

    setConversations(mapped);
    setLoadingInbox(false);
  };

  const loadConversationTasks = async (conversation_id) => {
    if (!conversation_id) return;

    setLoadingTasksBar(true);
    setError("");

    const { data, error } = await supabase
      .from("conversation_tasks")
      .select(
        `
        id,
        conversation_id,
        task_id,
        status,
        highlight_until,
        created_at,
        color_index,
        tasks:task_id ( id, title, status, price, is_negotiable )
      `
      )
      .eq("conversation_id", conversation_id)
      .order("created_at", { ascending: true });

    if (error) {
      setError(error.message);
      setConversationTasks([]);
      setLoadingTasksBar(false);
      return;
    }

    const rows = (data || []).map((ct) => ({
      ...ct,
      task_title: ct.tasks?.title || "Task",
      task_status: ct.tasks?.status || null,
      task_price: ct.tasks?.price ?? null,
      task_is_negotiable: ct.tasks?.is_negotiable ?? null,
    }));

    const filtered = rows.filter((ct) => {
      const s = (ct.task_status || "").toLowerCase();
      return !["completed", "closed", "done", "cancelled", "canceled"].includes(s);
    });

    setConversationTasks(filtered);

    setActiveConversationTaskId((prev) => {
      if (prev && filtered.some((x) => x.id === prev)) return prev;
      return filtered[0]?.id || null;
    });

    setLoadingTasksBar(false);
  };

  const loadTaskDetails = async (taskId) => {
    if (!taskId) {
      setActiveTaskDetails(null);
      return;
    }
    setLoadingTaskDetails(true);
    setError("");

    const { data, error } = await supabase
      .from("tasks")
      .select("id, title, status, price, is_negotiable, created_at, description")
      .eq("id", taskId)
      .maybeSingle();

    if (error) {
      setError(error.message);
      setActiveTaskDetails(null);
    } else {
      setActiveTaskDetails(data || null);
    }
    setLoadingTaskDetails(false);
  };

  // sync details whenever active chip changes
  useEffect(() => {
    if (!activeCT) return;
    setActiveTaskId(activeCT.task_id || null);
    loadTaskDetails(activeCT.task_id || null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeConversationTaskId]);

  const loadConversationById = async (id) => {
    if (!me?.id || !id) return;
    setLoadingThread(true);
    setError("");

    const { data: convoRow, error: convoError } = await supabase
      .from("conversations")
      .select("id, task_id, user_a, user_b")
      .eq("id", id)
      .single();

    if (convoError || !convoRow) {
      setError(convoError?.message || "Conversation not found");
      setLoadingThread(false);
      return;
    }

    const otherId = convoRow.user_a === me.id ? convoRow.user_b : convoRow.user_a;
    setActiveConversationId(convoRow.id);
    setActiveTaskId(convoRow.task_id);
    setReceiverId(otherId || null);

    await loadConversationTasks(convoRow.id);

    // ensure conversation_tasks row exists for legacy convo.task_id
    if (convoRow.task_id) {
      const { data: existingCT } = await supabase
        .from("conversation_tasks")
        .select("id")
        .eq("conversation_id", convoRow.id)
        .eq("task_id", convoRow.task_id)
        .maybeSingle();

      if (!existingCT?.id) {
        await supabase.from("conversation_tasks").insert({
          conversation_id: convoRow.id,
          task_id: convoRow.task_id,
          status: "requested",
        });
        await loadConversationTasks(convoRow.id);
      }
    }

    const { data: messageRows, error: messagesError } = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", convoRow.id)
      .order("created_at", { ascending: true });

    if (messagesError) {
      setError(messagesError.message);
      setMessages([]);
    } else {
      setMessages(messageRows || []);
      if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
    }

    setLoadingThread(false);
  };

  const markThreadRead = async () => {
    if (!me?.id || !activeConversationId) return;
    await supabase
      .from("messages")
      .update({ read_at: new Date().toISOString() })
      .eq("conversation_id", activeConversationId)
      .eq("receiver_id", me.id)
      .is("read_at", null);
  };

  useEffect(() => {
    if (!me?.id) return;
    if (isThread) loadConversationById(safeConversationId);
    else fetchInbox();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.id, isThread, safeConversationId]);

  useEffect(() => {
    if (!activeConversationId || !me?.id) return;
    markThreadRead();

    const channel = supabase
      .channel(`messages:conversation:${activeConversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${activeConversationId}`,
        },
        (payload) => {
          const msg = payload.new;
          setMessages((prev) => [...prev, msg]);
          if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
          if (msg.sender_id !== me.id) markThreadRead();
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeConversationId, me?.id]);

  const sendMessage = async () => {
    if (!me?.id) return setError("Please log in");
    if (!activeConversationId) return setError("Open a chat first");
    if (!receiverId) return setError("Cannot send: receiverId not resolved.");
    if (!newMessage.trim()) return;

    const payload = {
      conversation_id: activeConversationId,
      task_id: activeTaskId, // legacy
      sender_id: me.id,
      receiver_id: receiverId,
      body: newMessage.trim(),
      conversation_task_id: activeConversationTaskId,
    };

    const { error } = await supabase.from("messages").insert([payload]);
    if (error) return setError(error.message);

    setNewMessage("");
  };

  const onSelectChip = (ct) => {
    setActiveConversationTaskId(ct.id);
    setShowTaskPanel(true);
  };

  const getMsgAccent = (msg) => {
    const ct = msg.conversation_task_id ? ctById.get(msg.conversation_task_id) : null;
    return pickColor(ct?.color_index);
  };

  if (!me) {
    return (
      <div style={{ maxWidth: "760px", margin: "2rem auto", padding: "1.25rem" }}>
        <p style={{ color: "#ef4444" }}>{error || "Please log in"}</p>
      </div>
    );
  }

  return (
    <div
      style={{
        maxWidth: "760px",
        margin: "2rem auto",
        padding: "1.25rem",
        background: "#fff",
        borderRadius: "10px",
        boxShadow: "0 0 12px rgba(0,0,0,0.08)",
      }}
    >
      <h2 style={{ marginTop: 0 }}>{isThread ? "Chat" : "Inbox"}</h2>

      {!isThread && (
        <>
          <p style={{ color: "#475569" }}>Your conversations are listed below.</p>
          {loadingInbox && <p>Loading inbox…</p>}
          {!loadingInbox && conversations.length === 0 && (
            <p style={{ color: "#6b7280" }}>No conversations yet.</p>
          )}
          {!loadingInbox &&
            conversations.map((conv) => (
              <div
                key={conv.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "0.75rem",
                  padding: "0.6rem 0.8rem",
                  border: "1px solid #e2e8f0",
                  borderRadius: "10px",
                  marginBottom: "0.6rem",
                }}
              >
                <div>
                  <div style={{ fontWeight: 600 }}>
                    {taskTitles[conv.task_id] || "Conversation"}
                  </div>
                  <div style={{ fontSize: "0.8rem", color: "#64748b" }}>
                    {conv.last_message_at
                      ? new Date(conv.last_message_at).toLocaleString()
                      : "—"}
                  </div>
                </div>
                <Link
                  to={`/chat/${conv.id}`}
                  style={{
                    background: BLUE,
                    color: "#fff",
                    padding: "0.35rem 0.7rem",
                    borderRadius: "999px",
                    textDecoration: "none",
                    fontSize: "0.8rem",
                    fontWeight: 600,
                  }}
                >
                  Open chat
                </Link>
              </div>
            ))}
        </>
      )}

      {isThread && (
        <>
          {/* CHIPS */}
          <div style={{ marginTop: "0.75rem" }}>
            <div
              style={{
                fontSize: "0.75rem",
                letterSpacing: "0.12em",
                fontWeight: 800,
                color: "#94a3b8",
                marginBottom: "0.5rem",
              }}
            >
              TASKS WITH THIS PERSON ({conversationTasks.length})
            </div>

            {loadingTasksBar && <div style={{ color: "#64748b" }}>Loading tasks…</div>}

            {!loadingTasksBar && conversationTasks.length > 0 && (
              <div style={{ display: "flex", gap: "0.5rem", overflowX: "auto" }}>
                {conversationTasks.map((ct) => {
                  const isActive = ct.id === activeConversationTaskId;
                  const color = pickColor(ct.color_index);

                  return (
                    <button
                      key={ct.id}
                      onClick={() => onSelectChip(ct)}
                      style={{
                        border: isActive
                          ? "2px solid rgba(15,23,42,0.18)"
                          : "1px solid rgba(15,23,42,0.06)",
                        background: color,
                        color: "#0b1220",
                        padding: "0.55rem 0.9rem",
                        borderRadius: "18px",
                        fontWeight: 900,
                        fontSize: "0.9rem",
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                        boxShadow: isActive ? "0 0 0 4px rgba(15, 23, 42, 0.10)" : "none",
                        opacity: isActive ? 1 : 0.82,
                      }}
                      title={ct.task_title}
                    >
                      {ct.task_title}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* TASK DETAILS ABOVE (collapsible) */}
          <div
            style={{
              marginTop: "0.9rem",
              border: "1px solid #e5e7eb",
              borderRadius: 12,
              padding: "0.85rem",
              background: "#fff",
            }}
          >
            <div
              style={{
                background: hexToRgba(activeColor, 0.2),
                border: `1px solid ${hexToRgba(activeColor, 0.22)}`,
                borderRadius: 14,
                padding: "0.7rem 0.85rem",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "0.75rem",
              }}
            >
              <div style={{ fontWeight: 950, color: "#0f172a" }}>
                {activeCT?.task_title || "General"}
              </div>

              <button
                onClick={() => setShowTaskPanel((s) => !s)}
                style={{
                  border: "none",
                  background: "rgba(255,255,255,0.7)",
                  borderRadius: 999,
                  padding: "0.25rem 0.6rem",
                  cursor: "pointer",
                  fontWeight: 900,
                  fontSize: "0.8rem",
                  color: "#0f172a",
                }}
              >
                {showTaskPanel ? "Hide" : "Show"}
              </button>
            </div>

            {showTaskPanel && (
              <>
                <div style={{ marginTop: "0.65rem", display: "flex", gap: "0.75rem" }}>
                  <div>
                    <div style={{ color: "#64748b", fontWeight: 800, fontSize: "0.8rem" }}>
                      STATUS
                    </div>
                    <div style={{ marginTop: "0.25rem" }}>
                      <StatusPill status={activeTaskDetails?.status || activeCT?.task_status} />
                    </div>
                  </div>

                  <div>
                    <div style={{ color: "#64748b", fontWeight: 800, fontSize: "0.8rem" }}>
                      PRICE
                    </div>
                    <div style={{ marginTop: "0.25rem", fontWeight: 900, color: "#0f172a" }}>
                      {activeTaskDetails?.price ?? activeCT?.task_price ?? "—"}{" "}
                      {(activeTaskDetails?.is_negotiable ?? activeCT?.task_is_negotiable)
                        ? "(negotiable)"
                        : ""}
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: "0.75rem", display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                  {/* These buttons remain placeholders until you implement offers state */}
                  <button
                    disabled
                    style={{
                      background: "#111827",
                      color: "#fff",
                      border: "none",
                      borderRadius: 10,
                      padding: "0.5rem 0.8rem",
                      fontWeight: 900,
                      opacity: 0.5,
                      cursor: "not-allowed",
                    }}
                    title="Enable once offers/negotiation state exists"
                  >
                    Counter
                  </button>

                  <button
                    disabled
                    style={{
                      background: "#10b981",
                      color: "#fff",
                      border: "none",
                      borderRadius: 10,
                      padding: "0.5rem 0.8rem",
                      fontWeight: 900,
                      opacity: 0.5,
                      cursor: "not-allowed",
                    }}
                    title="Enable once offers/negotiation state exists"
                  >
                    Accept offer
                  </button>

                  <button
                    disabled
                    style={{
                      background: "#fff",
                      color: "#111827",
                      border: "2px solid #e5e7eb",
                      borderRadius: 10,
                      padding: "0.5rem 0.8rem",
                      fontWeight: 900,
                      opacity: 0.5,
                      cursor: "not-allowed",
                    }}
                    title="Enable once offers/negotiation state exists"
                  >
                    Agree price
                  </button>

                  <button
                    onClick={() => activeCT?.task_id && navigate(`/task/${activeCT.task_id}`)}
                    disabled={!activeCT?.task_id}
                    style={{
                      background: "#fff",
                      color: "#111827",
                      border: "2px solid #e5e7eb",
                      borderRadius: 10,
                      padding: "0.5rem 0.8rem",
                      fontWeight: 900,
                      cursor: activeCT?.task_id ? "pointer" : "not-allowed",
                      opacity: activeCT?.task_id ? 1 : 0.5,
                    }}
                    title="Open full task page"
                  >
                    Open task
                  </button>
                </div>

                {loadingTaskDetails ? (
                  <div style={{ marginTop: "0.6rem", color: "#64748b" }}>Loading task details…</div>
                ) : activeTaskDetails?.description ? (
                  <div style={{ marginTop: "0.6rem", color: "#475569" }}>
                    {activeTaskDetails.description}
                  </div>
                ) : null}
              </>
            )}
          </div>

          {/* MESSAGES */}
          <div
            ref={listRef}
            style={{
              margin: "1rem 0",
              maxHeight: "420px",
              overflowY: "auto",
              border: "1px solid #e5e7eb",
              borderRadius: 10,
              padding: "0.75rem",
              background: "#f8fafc",
            }}
          >
            {messages.length === 0 && <p style={{ color: "#6b7280" }}>No messages yet.</p>}

            {messages.map((msg) => {
              const accent = getMsgAccent(msg);
              const mine = isMine(msg);
              const bubbleStyle = {
                background: hexToRgba(accent, 0.28),
                border: `1px solid ${hexToRgba(accent, 0.35)}`,
                color: "#0f172a",
              };

              return (
                <div
                  key={msg.id}
                  style={{
                    display: "flex",
                    justifyContent: mine ? "flex-end" : "flex-start",
                    margin: "0.45rem 0",
                  }}
                >
                  <div
                    style={{
                      maxWidth: "78%",
                      padding: "0.65rem 0.85rem",
                      borderRadius: 18,
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                      fontSize: "0.95rem",
                      fontWeight: 700,
                      ...bubbleStyle,
                    }}
                    title={new Date(msg.created_at).toLocaleString()}
                  >
                    {msg.body ?? msg.content}
                  </div>
                </div>
              );
            })}
          </div>

          {/* INPUT */}
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
              placeholder="Write a message…"
              style={{
                flexGrow: 1,
                padding: "0.6rem 0.7rem",
                borderRadius: "8px",
                border: `2px solid ${hexToRgba(activeColor, 0.55)}`,
                outline: "none",
              }}
            />
            <button
              onClick={sendMessage}
              style={{
                background: activeColor,
                color: "#fff",
                border: "none",
                borderRadius: "8px",
                padding: "0.6rem 1rem",
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              Send
            </button>
          </div>
        </>
      )}

      {error && <p style={{ color: "#ef4444", marginTop: "0.6rem" }}>{error}</p>}
    </div>
  );
}
