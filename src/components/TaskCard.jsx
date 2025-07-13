export default function TaskCard({ task, compact }) {
  return (
    <div style={{
      minWidth: compact ? "200px" : "100%",
      maxWidth: compact ? "200px" : "100%",
      border: "1px solid #ddd",
      borderRadius: "8px",
      padding: "1rem",
      background: "#fff",
      flex: "0 0 auto",
      boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
      position: "relative",
      cursor: "pointer"
    }}>
      <h3 style={{ margin: 0, fontSize: "1.1rem" }}>{task.title}</h3>
      <p style={{ fontSize: "0.9rem", color: "#555" }}>{task.description}</p>
      <p style={{ fontSize: "0.8rem", color: "#777" }}>
        <strong>{task.category}</strong>
      </p>
      <span style={{
        position: "absolute",
        right: "10px",
        bottom: "10px",
        fontSize: "1.5rem",
        color: "#2575fc"
      }}>→</span>
    </div>
  );
}
