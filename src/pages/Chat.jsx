import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

const VIOLET = "#7c3aed";
const BLUE = "#1d4ed8";

export default function Chat() {
  const { taskId, receiverId } = useParams(); // strings from URL
  const safeTaskId =
    taskId && taskId !== "null" && taskId !== "undefined" ? taskId : null;
  const safeReceiverId =
    receiverId && receiverId !== "null" && receiverId !== "undefined" ? receiverId : null;
  const [me, setMe] = useState(null);        // { id, email, ... }
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [error, setError] = useState("");
  const [helpedTasks, setHelpedTasks] = useState([]);
  const [assignedTasks, setAssignedTasks] = useState([]);
  const [allTasks, setAllTasks] = useState([]);
  const [taskQuery, setTaskQuery] = useState("");
  const [searchResults, setSearchResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const [loadingList, setLoadingList] = useState(false);

  const listRef = useRef(null);

  // quick stable filter function
  const isMine = useMemo(
    () => (msg) => me && msg.sender_id === me.id,
    [me]
  );

  const filteredTasks = useMemo(() => {
    if (!me) return [];
    const query = taskQuery.trim().toLowerCase();
    const source = searchResults ?? allTasks;
    return (source || [])
      .filter((task) => {
        if (!task?.owner_id) return false;
        if (task.owner_id === "null" || task.owner_id === "undefined") return false;
        if (task.owner_id === me.id) return false;
        if (!query) return true;
        return (
          task.title?.toLowerCase().includes(query) ||
          task.category?.toLowerCase().includes(query)
        );
      })
      .slice(0, 20);
  }, [allTasks, searchResults, taskQuery, me]);

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

    const { data: tasks, error: tasksErr } = await supabase
      .from("tasks")
      .select("id, title, owner_id, category, created_at")
      .order("created_at", { ascending: false });

    if (tasksErr) {
      setError((prev) => (prev ? `${prev} | ${tasksErr.message}` : tasksErr.message));
      setAllTasks([]);
    } else {
      setAllTasks(tasks || []);
    }

    setLoadingList(false);
  };

  // 2) fetch messages for this task
  const fetchMessages = async () => {
    if (!safeTaskId) return;
    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .eq("task_id", safeTaskId)
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
    if (!safeTaskId) return;
    fetchMessages();

    // 3) realtime: subscribe to new messages
    const channel = supabase
      .channel(`messages:task:${safeTaskId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `task_id=eq.${safeTaskId}`,
        },
        (payload) => {
          setMessages((prev) => [...prev, payload.new]);
          if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [safeTaskId]);

  useEffect(() => {
    if (!me || safeTaskId) return;
    fetchChatLists();
  }, [me, safeTaskId]);

  useEffect(() => {
    const runSearch = async () => {
      if (!me) return;
      const query = taskQuery.trim();
      if (!query) {
        setSearchResults(null);
        return;
      }

      setSearching(true);
      setError("");

      const { data, error } = await supabase
        .from("tasks")
        .select("id, title, owner_id, category, created_at")
        .or(`title.ilike.%${query}%,category.ilike.%${query}%`)
        .order("created_at", { ascending: false });

      if (error) {
        setError((prev) => (prev ? `${prev} | ${error.message}` : error.message));
        setSearchResults([]);
      } else {
        setSearchResults(data || []);
      }

      setSearching(false);
    };

    runSearch();
  }, [taskQuery, me]);

  // 4) send a message
  const sendMessage = async () => {
    if (!me) {
      setError("Not logged in");
      return;
    }
    if (!safeReceiverId || !safeTaskId) {
      setError("Select a task chat first");
      return;
    }
    if (!newMessage.trim()) return;

    const { error } = await supabase.from("messages").insert([
      {
        task_id: safeTaskId,
        sender_id: me.id,
        receiver_id: safeReceiverId, // comes from URL
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

  const needsPicker = !safeTaskId || !safeReceiverId;

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

              <div style={{ marginTop: "1.2rem" }}>
                <h3 style={{ marginBottom: "0.4rem" }}>Browse tasks to start a chat</h3>
                <input
                  type="text"
                  value={taskQuery}
                  onChange={(e) => setTaskQuery(e.target.value)}
                  placeholder="Search by title or category"
                  style={{
                    width: "100%",
                    padding: "0.6rem 0.7rem",
                    borderRadius: "8px",
                    border: "1px solid #d1d5db",
                    marginBottom: "0.6rem",
                  }}
                />
                {searching && <p>Searching…</p>}
                {!searching && filteredTasks.length === 0 ? (
                  <p style={{ color: "#6b7280" }}>No tasks found.</p>
                ) : (
                  filteredTasks.map((task) => (
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
