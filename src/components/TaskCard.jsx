import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";

function formatDate(dateString) {
  if (!dateString) return "";
  const d = new Date(dateString);
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

function formatDistance(max_distance_km) {
  if (max_distance_km == null) return "Distance not specified";
  const km = Number(max_distance_km);
  if (Number.isNaN(km)) return "Distance not specified";
  if (km < 1) return "< 1 km away";
  return `${km.toFixed(1)} km away`;
}

function formatPrice(price_min, price_max, currency = "EUR") {
  if (price_min == null && price_max == null) return "Price to be discussed";
  const cur = currency || "EUR";
  if (price_min != null && price_max != null) return `${price_min}-${price_max} ${cur}`;
  if (price_min != null) return `From ${price_min} ${cur}`;
  return `Up to ${price_max} ${cur}`;
}

export default function TaskCard({ task, isOwn }) {
  const navigate = useNavigate();
  const warnedMissingOwner = useRef(false);
  const isOpen = task?.status ? task.status === "open" : true;

  useEffect(() => {
    if (!task?.user_id && !warnedMissingOwner.current) {
      console.warn("Task is missing user_id, chat button disabled.", task);
      warnedMissingOwner.current = true;
    }
  }, [task]);

  const handleCardNavigate = () => {
    if (!isOpen) return;
    navigate(`/task/${task.id}`);
  };

  const priceLabel = formatPrice(task.price_min, task.price_max, task.currency);
  const distanceLabel = formatDistance(task.max_distance_km);
  const postedLabel = task.created_at ? `Posted on ${formatDate(task.created_at)}` : "";

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleCardNavigate}
      onKeyDown={(e) => {
        if (e.key === "Enter") handleCardNavigate();
      }}
      style={{
        ...styles.card,
        opacity: isOpen ? 1 : 0.6,
        cursor: isOpen ? "pointer" : "not-allowed",
      }}
    >
      <div style={styles.topRow}>
        <div style={styles.leftTop}>
          {task.category && <span style={styles.category}>{task.category}</span>}
          {isOwn && <span style={styles.badge}>My task</span>}
        </div>
      </div>

      <h3 style={styles.title}>{task.title}</h3>

      {task.description && (
        <p style={styles.description}>
          {task.description.length > 80 ? task.description.slice(0, 77) + "..." : task.description}
        </p>
      )}

      <div style={styles.bottomRow}>
        <div style={styles.infoCol}>
          <span style={styles.price}>{priceLabel}</span>
          <span style={styles.meta}>{distanceLabel}</span>
          {postedLabel && <span style={styles.meta}>{postedLabel}</span>}
          {!isOpen && <span style={styles.statusTag}>{task.status || "unavailable"}</span>}
        </div>

        <div style={styles.actionCol}>
          {!isOwn && (
            <button
              type="button"
              style={{
                ...styles.chatBtn,
                opacity: task.user_id && isOpen ? 1 : 0.6,
                cursor: task.user_id && isOpen ? "pointer" : "not-allowed",
              }}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (!isOpen) return;
                if (!task?.user_id) return;
                navigate(`/chat/resolve/${task.id}/${task.user_id}`);
              }}
              disabled={!task.user_id || !isOpen}
            >
              Chat with this person
            </button>
          )}
          <div style={styles.arrow}>&rarr;</div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  card: {
    borderRadius: "12px",
    border: "1px solid #f0f0f0",
    padding: "0.75rem 1rem",
    marginBottom: "0.75rem",
    background: "#fff",
    cursor: "pointer",
    boxShadow: "0 2px 6px rgba(0,0,0,0.04)",
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    height: "100%",
    transition: "transform 0.15s ease, boxShadow 0.15s ease",
  },
  topRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "0.3rem",
  },
  leftTop: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
  },
  category: {
    fontSize: "0.75rem",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    color: "#777",
  },
  badge: {
    fontSize: "0.75rem",
    padding: "0.15rem 0.4rem",
    borderRadius: "999px",
    background: "#e6f4ff",
    color: "#007bff",
    fontWeight: 600,
  },
  title: {
    margin: "0 0 0.3rem 0",
    fontSize: "1rem",
    fontWeight: 600,
  },
  description: {
    margin: "0 0 0.6rem 0",
    color: "#555",
    fontSize: "0.85rem",
    flexGrow: 1,
  },
  bottomRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginTop: "0.25rem",
  },
  actionCol: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end",
    gap: "0.4rem",
  },
  infoCol: {
    display: "flex",
    flexDirection: "column",
    gap: "0.15rem",
  },
  chatBtn: {
    border: "none",
    borderRadius: "999px",
    padding: "0.35rem 0.7rem",
    background: "#7c3aed",
    color: "#fff",
    fontWeight: 600,
    fontSize: "0.75rem",
    cursor: "pointer",
  },
  price: {
    fontSize: "0.9rem",
    fontWeight: 600,
  },
  meta: {
    fontSize: "0.75rem",
    color: "#777",
  },
  statusTag: {
    alignSelf: "flex-start",
    fontSize: "0.7rem",
    color: "#475569",
    background: "#e2e8f0",
    padding: "0.15rem 0.45rem",
    borderRadius: "999px",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  },
  arrow: {
    fontSize: "1.2rem",
  },
};
