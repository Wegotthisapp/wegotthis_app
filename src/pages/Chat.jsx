import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

export default function Chat() {
  const { taskId, receiverId } = useParams(); // strings from URL
  const [me, setMe] = useState(null);        // { id, email, ... }
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [error, setError] = useState("");

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

  // 4) send a message
  const sendMessage = async () => {
    if (!me) {
      setError("Not logged in");
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

  return (
    <div
      style={{
        maxWidth: "700px",
        margin: "2rem auto",
        padding: "1rem",
        background: "#fff",
        borderRadius: "8px",
        boxShadow: "0 0 10px rgba(0,0,0,0.06)",
      }}
    >
      <h2 style={{ marginTop: 0 }}>Chat</h2>

      {!me && (
        <p style={{ color: "#ef4444" }}>
          {error || "Loading session…"}
        </p>
      )}

      <div
        ref={listRef}
        style={{
          margin: "1rem 0",
          maxHeight: "360px",
          overflowY: "auto",
          border: "1px solid #e5e7eb",
          borderRadius: 8,
          padding: "0.75rem",
          background: "#fafafa",
        }}
      >
        {messages.length === 0 && <p style={{ color: "#6b7280" }}>No messages yet.</p>}
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
                borderRadius: 10,
                background: isMine(msg) ? "#1d4ed8" : "#e5e7eb",
                color: isMine(msg) ? "#fff" : "#111827",
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
            background: "#1d4ed8",
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

      {error && <p style={{ color: "#ef4444", marginTop: "0.6rem" }}>{error}</p>}
    </div>
  );
}
