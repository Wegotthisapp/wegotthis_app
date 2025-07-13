import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

export default function Chat() {
  const { taskId, receiverId } = useParams(); // read from URL
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");

  const user = supabase.auth.getUser(); // get current user

  useEffect(() => {
    fetchMessages();
    const interval = setInterval(fetchMessages, 2000); // poll every 2s
    return () => clearInterval(interval);
  }, []);

  const fetchMessages = async () => {
    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .eq("task_id", taskId)
      .order("created_at", { ascending: true });

    if (!error) setMessages(data);
  };

  const sendMessage = async () => {
    if (!newMessage.trim()) return;

    const { data: currentUser } = await user;

    const { error } = await supabase.from("messages").insert([
      {
        task_id: taskId,
        sender_id: currentUser.user.id,
        receiver_id: receiverId,
        content: newMessage,
      },
    ]);

    if (!error) {
      setNewMessage("");
      fetchMessages();
    }
  };

  return (
    <div style={{ maxWidth: "600px", margin: "2rem auto", padding: "1rem", background: "#fff", borderRadius: "8px", boxShadow: "0 0 10px rgba(0,0,0,0.1)" }}>
      <h2>Chat</h2>
      <div style={{ marginBottom: "1rem", maxHeight: "300px", overflowY: "auto", border: "1px solid #ddd", padding: "0.5rem" }}>
        {messages.map((msg) => (
          <div key={msg.id} style={{ textAlign: msg.sender_id === user?.id ? "right" : "left", margin: "0.5rem 0" }}>
            <span>{msg.content}</span>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: "0.5rem" }}>
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Type your message"
          style={{ flexGrow: 1, padding: "0.5rem", borderRadius: "4px", border: "1px solid #ccc" }}
        />
        <button
          onClick={sendMessage}
          style={{ background: "#007BFF", color: "#fff", border: "none", borderRadius: "4px", padding: "0.5rem 1rem" }}
        >
          Send
        </button>
      </div>
    </div>
  );
}
