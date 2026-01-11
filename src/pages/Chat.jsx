import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

const VIOLET = "#7c3aed";
const BLUE = "#1d4ed8";

export default function Chat() {
  const { taskId, receiverId } = useParams(); // strings from URL
  const [me, setMe] = useState(null);        // { id, email, ... }
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [error, setError] = useState("");
  const [helpedTasks, setHelpedTasks] = useState([]);
  const [assignedTasks, setAssignedTasks] = useState([]);
  const [loadingList, setLoadingList] = useState(false);

  const listRef = useRef(null);

  // quick stable filter function
  const isMine = useMemo(
    () => (msg) => me && msg.sender_id === me.id,
    [me]
  );

  // 1) get current user once
  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data, error } = await supabase.auth.getUser();
      if (mounted) {
        if (error || !data?.user) setError("Not logged in");
        else setMe(data.user);
      }
    })();
    return () => (mounted = false);
  }, []);

  // 1b) fetch task lists for chat picker
  const fetchChatLists = async () => {
    if (!me) return;
    setLoadingList(true);
    setError("");

    const { data: helped, error: helpedErr } = await supabase
      .from("task_assignments")
      .select("id, tasks:task_id ( id, title, owner_id, category, created_at )")
      .eq("user_id", me.id)
      .order("created_at", { ascending: false });

    if (helpedErr) {
      setError((prev) => (prev ? `${prev} | ${helpedErr.message}` : helpedErr.message));
      setHelpedTasks([]);
    } else {
      const flattened = (helped || [])
        .map((row) => row.tasks)
        .filter((task) => task && task.id && task.owner_id);
      setHelpedTasks(flattened);
    }

    const { data: assigned, error: assignedErr } = await supabase
      .from("task_assignments")
      .select("id, user_id, tasks:task_id ( id, title, owner_id, category, created_at )")
      .eq("tasks.owner_id", me.id)
      .order("created_at", { ascending: false });

    if (assignedErr) {
      setError((prev) => (prev ? `${prev} | ${assignedErr.message}` : assignedErr.message));
      setAssignedTasks([]);
    } else {
      const flattened = (assigned || [])
        .map((row) => ({
          task: row.tasks,
          helperId: row.user_id,
        }))
        .filter((row) => row.task && row.task.id && row.helperId);
      setAssignedTasks(flattened);
    }

    setLoadingList(false);
  };

  // 2) fetch messages for this task
  const fetchMessages = async () => {
    if (!taskId) return;
    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .eq("task_id", taskId)
      .order("created_at", { ascending: true });

    if (error) {
      setError(error.message);
      setMessages([]);
    } else {
      setMessages(data || []);
      // scroll to bottom
      if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  };

  useEffect(() => {
    if (!taskId) return;
    fetchMessages();

    // 3) realtime: subscribe to new messages
    const channel = supabase
      .channel(`messages:task:${taskId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `task_id=eq.${taskId}` },
        (payload) => {
          setMessages((prev) => [...prev, payload.new]);
          if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [taskId]);

  useEffect(() => {
    if (!me || taskId) return;
    fetchChatLists();
  }, [me, taskId]);

  // 4) send a message
  const sendMessage = async () => {
    if (!me) {
      setError("Not logged in");
      return;
    }
    if (!receiverId) {
      setError("Select a task chat first");
      return;
    }
    if (!newMessage.trim()) return;

    const { error } = await supabase.from("messages").insert([
      {
        task_id: taskId,
        sender_id: me.id,
        receiver_id: receiverId, // comes from URL
        content: newMessage.trim(),
      },
    ]);

    if (error) {
      setError(error.message);
      return;
    }

    setNewMessage("");
    // fetch as a fallback (realtime should also push it)
    fetchMessages();
  };

  const needsPicker = !taskId || !receiverId;

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
      <h2 style={{ marginTop: 0 }}>Chat</h2>

      {!me && (
        <p style={{ color: "#ef4444" }}>
          {error || "Loading session…"}
        </p>
      )}

      {me && needsPicker && (
        <>
          <p style={{ color: "#475569" }}>
            Pick a task to start chatting with the other person.
          </p>

          {loadingList && <p>Loading chats…</p>}

          {!loadingList && (
            <>
              <div style={{ marginTop: "1rem" }}>
                <h3 style={{ marginBottom: "0.4rem" }}>Tasks you helped with</h3>
                {helpedTasks.length === 0 ? (
                  <p style={{ color: "#6b7280" }}>No chats yet.</p>
                ) : (
                  helpedTasks.map((task) => (
                    <div
                      key={task.id}
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
                        <div style={{ fontWeight: 600 }}>{task.title}</div>
                        <div style={{ fontSize: "0.8rem", color: "#64748b" }}>
                          {task.category || "No category"}
                        </div>
                      </div>
                      <Link
                        to={`/chat/${task.id}/${task.owner_id}`}
                        style={{
                          background: BLUE,
                          color: "#fff",
                          padding: "0.45rem 0.9rem",
                          borderRadius: "999px",
                          textDecoration: "none",
                          fontWeight: 600,
                          fontSize: "0.85rem",
                        }}
                      >
                        Open chat
                      </Link>
                    </div>
                  ))
                )}
              </div>

              <div style={{ marginTop: "1.2rem" }}>
                <h3 style={{ marginBottom: "0.4rem" }}>Your tasks with helpers</h3>
                {assignedTasks.length === 0 ? (
                  <p style={{ color: "#6b7280" }}>No helpers assigned yet.</p>
                ) : (
                  assignedTasks.map((row) => (
                    <div
                      key={`${row.task.id}-${row.helperId}`}
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
                        <div style={{ fontWeight: 600 }}>{row.task.title}</div>
                        <div style={{ fontSize: "0.8rem", color: "#64748b" }}>
                          {row.task.category || "No category"}
                        </div>
                      </div>
                      <Link
                        to={`/chat/${row.task.id}/${row.helperId}`}
                        style={{
                          background: VIOLET,
                          color: "#fff",
                          padding: "0.45rem 0.9rem",
                          borderRadius: "999px",
                          textDecoration: "none",
                          fontWeight: 600,
                          fontSize: "0.85rem",
                        }}
                      >
                        Chat with helper
                      </Link>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </>
      )}

      {me && !needsPicker && (
        <>
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
                  {msg.content}
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
