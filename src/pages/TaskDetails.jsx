import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

// 👉 format price: numeri nudi diventano "… EUR"
function formatPrice(price_min, price_max, currency = "EUR") {
  if (price_min == null && price_max == null) return "Price to be discussed";
  const cur = currency || "EUR";
  if (price_min != null && price_max != null) {
    return `${price_min}-${price_max} ${cur}`;
  }
  if (price_min != null) return `From ${price_min} ${cur}`;
  return `Up to ${price_max} ${cur}`;
}

// 👉 format distance: testo consistente
function formatDistance(max_distance_km) {
  if (max_distance_km == null) return "Distance not specified";
  if (max_distance_km < 1) return "< 1 km away";
  return `${max_distance_km.toFixed(1)} km away`;
}

export default function TaskDetails() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [task, setTask] = useState(null);
  const [owner, setOwner] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setErr("");

        // 1️⃣ Prendo il task
        const { data: taskData, error: taskError } = await supabase
          .from("tasks")
          .select("*")
          .eq("id", id)
          .single();

        if (taskError || !taskData) {
          console.error("Task error:", taskError);
          setErr("Task not found.");
          setLoading(false);
          return;
        }

        setTask(taskData);

        // 2️⃣ Prendo il profilo owner (se esiste tabella profiles)
        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select(
            "id, full_name, avatar_url, is_professional, rating_as_helper, num_helper_reviews"
          )
          .eq("id", taskData.owner_id)
          .maybeSingle(); // 👈 più safe di single()

        if (profileError) {
          console.warn("Profile error:", profileError);
        }

        setOwner(profileData || null);
        setLoading(false);
      } catch (e) {
        console.error("Unexpected error in TaskDetails:", e);
        setErr("Something went wrong.");
        setLoading(false);
      }
    };

    fetchData();
  }, [id]);

  const handleChat = () => {
    if (!task) return;
    navigate(`/chat/${task.id}/${task.owner_id}`);
  };

  if (loading) {
    return (
      <div style={styles.page}>
        <p>Loading task…</p>
      </div>
    );
  }

  if (err) {
    return (
      <div style={styles.page}>
        <button style={styles.backBtn} onClick={() => navigate(-1)}>
          ← Back
        </button>
        <p>{err}</p>
      </div>
    );
  }

  // 👉 qui usiamo i formatter
  const priceLabel = formatPrice(task.price_min, task.price_max, task.currency);
  const distanceLabel = formatDistance(task.max_distance_km);

  const postedLabel = task.created_at
    ? new Date(task.created_at).toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "";

  const toolsArray = Array.isArray(task.tools_needed) ? task.tools_needed : [];

  return (
    <div style={styles.page}>
      <button style={styles.backBtn} onClick={() => navigate(-1)}>
        ← Back
      </button>

      <div style={styles.layout}>
        {/* Colonna sinistra: info task */}
        <div style={styles.main}>
          <h1 style={styles.title}>{task.title}</h1>

          <div style={styles.subrow}>
            {task.category && (
              <span style={styles.category}>{task.category}</span>
            )}
            {postedLabel && (
              <span style={styles.meta}>Posted on {postedLabel}</span>
            )}
          </div>

          <div style={styles.metaRow}>
            <span style={styles.price}>{priceLabel}</span>
            <span style={styles.meta}>{distanceLabel}</span>
          </div>

          <h2 style={styles.sectionTitle}>Description</h2>
          <p style={styles.text}>{task.description}</p>

          {toolsArray.length > 0 && (
            <>
              <h2 style={styles.sectionTitle}>Tools / Requirements</h2>
              <ul>
                {toolsArray.map((tool) => (
                  <li key={tool} style={styles.text}>
                    {tool}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        {/* Colonna destra: box azioni + info persona */}
        <div style={styles.sideBox}>
          <div style={styles.sideInner}>
            <h3 style={{ marginTop: 0, marginBottom: "0.5rem" }}>
              Interested in this task?
            </h3>
            <button style={styles.chatBtn} onClick={handleChat}>
              Chat with {owner?.full_name || "this person"}
            </button>
            <p style={styles.sideNote}>
              Send a message to discuss details, timing and payment.
            </p>

            <hr style={{ margin: "1rem 0" }} />

            <h4 style={{ margin: "0 0 0.4rem 0" }}>About this person</h4>
            <p style={styles.textSmall}>
              {owner?.full_name ? owner.full_name : "WeGotThis user"}
            </p>
            {owner?.is_professional && (
              <p style={styles.textSmall}>
                <strong>Professional</strong>
              </p>
            )}
            {owner?.rating_as_helper ? (
              <p style={styles.textSmall}>
                Rating as helper: {Number(owner.rating_as_helper).toFixed(2)} (
                {owner.num_helper_reviews || 0} reviews)
              </p>
            ) : (
              <p style={styles.textSmall}>No helper reviews yet</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: {
    maxWidth: "1100px",
    margin: "0 auto",
    padding: "1.5rem 1rem 2.5rem",
    fontFamily: "'Poppins', sans-serif",
  },
  backBtn: {
    border: "none",
    background: "none",
    cursor: "pointer",
    marginBottom: "0.75rem",
    fontSize: "0.9rem",
  },
  layout: {
    display: "grid",
    gridTemplateColumns: "2fr 1fr",
    gap: "1.5rem",
  },
  main: {
    backgroundColor: "#fff",
    borderRadius: "12px",
    padding: "1.25rem 1.4rem",
    boxShadow: "0 2px 6px rgba(0,0,0,0.06)",
  },
  title: {
    margin: "0 0 0.4rem 0",
    fontSize: "1.6rem",
  },
  subrow: {
    display: "flex",
    gap: "0.75rem",
    alignItems: "center",
    marginBottom: "0.6rem",
    flexWrap: "wrap",
  },
  category: {
    fontSize: "0.8rem",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    color: "#666",
  },
  meta: {
    fontSize: "0.8rem",
    color: "#777",
  },
  metaRow: {
    display: "flex",
    gap: "1.5rem",
    alignItems: "center",
    marginBottom: "1.2rem",
    flexWrap: "wrap",
  },
  price: {
    fontSize: "1rem",
    fontWeight: 600,
  },
  sectionTitle: {
    fontSize: "1rem",
    marginTop: "0.5rem",
    marginBottom: "0.4rem",
  },
  text: {
    fontSize: "0.9rem",
    color: "#444",
    lineHeight: 1.5,
  },
  sideBox: {
    alignSelf: "flex-start",
  },
  sideInner: {
    backgroundColor: "#fff",
    borderRadius: "12px",
    padding: "1rem 1.1rem",
    boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
    border: "1px solid #f0f0f0",
  },
  chatBtn: {
    width: "100%",
    padding: "0.6rem 0.8rem",
    borderRadius: "999px",
    border: "none",
    background: "linear-gradient(135deg, #6a11cb, #2575fc)",
    color: "#fff",
    fontWeight: 600,
    cursor: "pointer",
    marginBottom: "0.4rem",
  },
  sideNote: {
    fontSize: "0.8rem",
    color: "#666",
  },
  textSmall: {
    fontSize: "0.8rem",
    color: "#444",
    margin: "0 0 0.3rem 0",
  },
};
