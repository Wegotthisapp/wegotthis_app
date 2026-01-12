import { Link } from "react-router-dom";

export default function ChatButton({ taskId, otherUserId }) {
  return (
    <Link
      to={`/chat/resolve/${taskId}/${otherUserId}`}
      style={{
        display: "inline-block",
        background: "#007BFF",
        color: "#fff",
        padding: "0.5rem 1rem",
        borderRadius: "6px",
        textDecoration: "none",
      }}
    >
      Chat
    </Link>
  );
}
