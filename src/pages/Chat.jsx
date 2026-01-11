import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

const VIOLET = "#7c3aed";
const BLUE = "#1d4ed8";
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default function Chat() {
  const { taskId, otherUserId } = useParams();
  const safeTaskId =
    taskId && taskId !== "null" && taskId !== "undefined" ? taskId : null;
  const safeOtherUserId =
    otherUserId && otherUserId !== "null" && otherUserId !== "undefined"
      ? otherUserId
      : null;
  const effectiveOtherUserId =
    safeOtherUserId && UUID_RE.test(safeOtherUserId) ? safeOtherUserId : null;

  const [me, setMe] = useState(null);
  const [conversationId, setConversationId] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [messages, setMessages] = useState([]);
  const [taskTitles, setTaskTitles] = useState({});
  const [newMessage, setNewMessage] = useState("");
  const [error, setError] = useState("");
  const [loadingInbox, setLoadingInbox] = useState(false);
  const [loadingThread, setLoadingThread] = useState(false);

  const listRef = useRef(null);

  const isThread = Boolean(safeTaskId && effectiveOtherUserId);

  const isMine = useMemo(
    () => (msg) => me && msg.sender_id === me.id,
    [me]
  );

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data, error } = await supabase.auth.getUser();
      if (!mounted) return;
      if (error || !data?.user) setError("Not logged in");
      else setMe(data.user);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (safeOtherUserId && !effectiveOtherUserId) {
      setError("Invalid chat recipient");
    }
  }, [safeOtherUserId, effectiveOtherUserId]);

  const fetchInbox = async () => {
    if (!me?.id) return;
    setLoadingInbox(true);
    setError("");

    const { data: convoData, error: convoError } = await supabase
      .from("conversations")
      .select("id, task_id, user_a, user_b, last_message_at, updated_at")
      .or(`user_a.eq.${me.id},user_b.eq.${me.id}`)
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .order("updated_at", { ascending: false });

    if (convoError) {
      setError(convoError.message);
      setConversations([]);
      setLoadingInbox(false);
      return;
    }

    const conversationsList = convoData || [];
    const conversationIds = conversationsList.map((conv) => conv.id);
    const taskIds = [...new Set(conversationsList.map((conv) => conv.task_id))];

    let unreadByConversation = {};
    if (conversationIds.length > 0) {
      const { data: unreadRows, error: unreadError } = await supabase
        .from("messages")
        .select("id, conversation_id")
        .in("conversation_id", conversationIds)
        .is("read_at", null)
        .neq("sender_id", me.id);

      if (unreadError) {
        setError(unreadError.message);
      } else {
        unreadByConversation = (unreadRows || []).reduce((acc, row) => {
          acc[row.conversation_id] = (acc[row.conversation_id] || 0) + 1;
          return acc;
        }, {});
      }
    }

    let titles = {};
    if (taskIds.length > 0) {
      const { data: taskRows, error: taskError } = await supabase
        .from("tasks")
        .select("id, title")
        .in("id", taskIds);

      if (taskError) {
        setError(taskError.message);
      } else {
        titles = (taskRows || []).reduce((acc, row) => {
          acc[row.id] = row.title || "Task";
          return acc;
        }, {});
      }
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

  const fetchConversation = async () => {
    if (!me?.id || !safeTaskId || !effectiveOtherUserId) return;
    setLoadingThread(true);
    setError("");

    const { data, error } = await supabase.rpc("get_or_create_conversation", {
      task_id: safeTaskId,
      other_user_id: effectiveOtherUserId,
    });

    if (error) {
      setError(error.message);
      setLoadingThread(false);
      return;
    }

    const convoId = data?.id || data;
    setConversationId(convoId);

    const { data: messageRows, error: messagesError } = await supabase
      .from("messages")
      .select("id, conversation_id, sender_id, body, created_at, read_at")
      .eq("conversation_id", convoId)
      .order("created_at", { ascending: true });

    if (messagesError) {
      setError(messagesError.message);
      setMessages([]);
    } else {
      setMessages(messageRows || []);
      if (listRef.current) {
        listRef.current.scrollTop = listRef.current.scrollHeight;
      }
    }

    setLoadingThread(false);
  };

  const markThreadRead = async () => {
    if (!me?.id || !conversationId) return;
    await supabase
      .from("messages")
      .update({ read_at: new Date().toISOString() })
      .eq("conversation_id", conversationId)
      .neq("sender_id", me.id)
      .is("read_at", null);
  };

  useEffect(() => {
    if (!me?.id) return;
    if (!isThread) {
      fetchInbox();
      return;
    }

    fetchConversation();
  }, [me?.id, isThread, safeTaskId, effectiveOtherUserId]);

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
          if (listRef.current) {
            listRef.current.scrollTop = listRef.current.scrollHeight;
          }
          if (msg.sender_id !== me.id) {
            markThreadRead();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, me?.id]);

  const sendMessage = async () => {
    if (!me?.id) {
      setError("Not logged in");
      return;
    }
    if (!conversationId) {
      setError("Open a chat first");
      return;
    }
    if (!newMessage.trim()) return;

    const { error } = await supabase.from("messages").insert([
      {
        conversation_id: conversationId,
        sender_id: me.id,
        body: newMessage.trim(),
      },
    ]);

    if (error) {
      setError(error.message);
      return;
    }

    setNewMessage("");
  };

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

      {!me && (
        <p style={{ color: "#ef4444" }}>{error || "Loading session…"}</p>
      )}

      {me && !isThread && (
        <>
          <p style={{ color: "#475569" }}>
            Your conversations are listed below.
          </p>
          {loadingInbox && <p>Loading inbox…</p>}
          {!loadingInbox && conversations.length === 0 && (
            <p style={{ color: "#6b7280" }}>No conversations yet.</p>
          )}
          {!loadingInbox &&
            conversations.map((conv) => (
              <Link
                key={conv.id}
                to={`/chat/${conv.task_id}/${conv.otherUserId}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "0.75rem",
                  padding: "0.6rem 0.8rem",
                  border: "1px solid #e2e8f0",
                  borderRadius: "10px",
                  marginBottom: "0.6rem",
                  textDecoration: "none",
                  color: "#0f172a",
                }}
              >
                <div>
                  <div style={{ fontWeight: 600 }}>
                    {taskTitles[conv.task_id] || "Task"}
                  </div>
                  <div style={{ fontSize: "0.8rem", color: "#64748b" }}>
                    Last updated{" "}
                    {conv.last_message_at
                      ? new Date(conv.last_message_at).toLocaleString()
                      : "—"}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  {conv.unreadCount > 0 && (
                    <span
                      style={{
                        background: VIOLET,
                        color: "#fff",
                        padding: "0.2rem 0.5rem",
                        borderRadius: "999px",
                        fontSize: "0.75rem",
                        fontWeight: 600,
                      }}
                    >
                      {conv.unreadCount}
                    </span>
                  )}
                  <span style={{ color: "#94a3b8" }}>&rarr;</span>
                </div>
              </Link>
            ))}
        </>
      )}

      {me && isThread && (
        <>
          {loadingThread && <p>Loading chat…</p>}
          <div
            ref={listRef}
            style={{
              margin: "1rem 0",
              maxHeight: "360px",
              overflowY: "auto",
              border: "1px solid #e5e7eb",
              borderRadius: 10,
              padding: "0.75rem",
              background: "#f8fafc",
            }}
          >
            {messages.length === 0 && (
              <p style={{ color: "#6b7280" }}>No messages yet.</p>
            )}
            {messages.map((msg) => (
              <div
                key={msg.id}
                style={{
                  display: "flex",
                  justifyContent: isMine(msg) ? "flex-end" : "flex-start",
                  margin: "0.35rem 0",
                }}
              >
                <div
                  style={{
                    maxWidth: "75%",
                    padding: "0.45rem 0.7rem",
                    borderRadius: 12,
                    background: isMine(msg) ? VIOLET : BLUE,
                    color: "#fff",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                    fontSize: "0.95rem",
                  }}
                  title={new Date(msg.created_at).toLocaleString()}
                >
                  {msg.body}
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", gap: "0.5rem" }}>
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
              placeholder="Type your message"
              style={{
                flexGrow: 1,
                padding: "0.6rem 0.7rem",
                borderRadius: "8px",
                border: "1px solid #d1d5db",
              }}
            />
            <button
              onClick={sendMessage}
              style={{
                background: VIOLET,
                color: "#fff",
                border: "none",
                borderRadius: "8px",
                padding: "0.6rem 1rem",
                fontWeight: 600,
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
