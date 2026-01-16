import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

const VIOLET = "#7c3aed";
const BLUE = "#1d4ed8";
export default function Chat() {
  const { conversationId } = useParams();

  const safeConversationId =
    conversationId && conversationId !== "null" && conversationId !== "undefined"
      ? conversationId
      : null;

  const [me, setMe] = useState(null);
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [activeTaskId, setActiveTaskId] = useState(null);
  const [receiverId, setReceiverId] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [messages, setMessages] = useState([]);
  const [taskTitles, setTaskTitles] = useState({});
  const [newMessage, setNewMessage] = useState("");
  const [error, setError] = useState("");
  const [loadingInbox, setLoadingInbox] = useState(false);
  const [loadingThread, setLoadingThread] = useState(false);

  const listRef = useRef(null);

  const isThread = Boolean(safeConversationId);

  const isMine = useMemo(
    () => (msg) => me && msg.sender_id === me.id,
    [me]
  );

  if (String(conversationId).toLowerCase() === "null") {
    return (
      <div style={{ maxWidth: "760px", margin: "2rem auto", padding: "1.25rem" }}>
        <p style={{ color: "#ef4444" }}>
          Invalid chat URL (conversationId is null)
        </p>
      </div>
    );
  }

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
      if (listRef.current) {
        listRef.current.scrollTop = listRef.current.scrollHeight;
      }
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
    if (isThread) {
      loadConversationById(safeConversationId);
      return;
    }
    fetchInbox();
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
  }, [activeConversationId, me?.id]);

  const sendMessage = async () => {
    if (!me?.id) {
      setError("Please log in");
      return;
    }
    if (!activeConversationId) {
      setError("Open a chat first");
      return;
    }
    if (!receiverId) {
      setError("Cannot send: receiverId not resolved.");
      return;
    }
    if (!newMessage.trim()) return;

    const { error } = await supabase.from("messages").insert([
      {
        conversation_id: activeConversationId,
        task_id: activeTaskId,
        sender_id: me.id,
        receiver_id: receiverId,
        body: newMessage.trim(),
      },
    ]);

    if (error) {
      setError(error.message);
      return;
    }

    setNewMessage("");
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
          <p style={{ color: "#475569" }}>
            Your conversations are listed below.
          </p>
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
              </div>
            ))}
        </>
      )}

      {isThread && (
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
                  {msg.body ?? msg.content}
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
