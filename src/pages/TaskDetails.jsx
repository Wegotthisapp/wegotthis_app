import { useEffect, useRef, useState } from "react";
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
  const [currentUserId, setCurrentUserId] = useState(null);
  const [chatReceiverId, setChatReceiverId] = useState(null);
  const [chatHint, setChatHint] = useState("");
  const warnedMissingOwnerRef = useRef(false);
  const [offers, setOffers] = useState([]);
  const [offerMessage, setOfferMessage] = useState("");
  const [actionError, setActionError] = useState("");
  const [actionNotice, setActionNotice] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const [notAvailable, setNotAvailable] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setErr("");

        const { data: userData } = await supabase.auth.getUser();
        const userId = userData?.user?.id || null;
        setCurrentUserId(userId);

        // 1️⃣ Prendo il task
        const { data: taskData, error: taskError } = await supabase
          .from("tasks")
          .select(
            "id, user_id, title, description, category, price_min, price_max, currency, max_distance_km, tools_needed, created_at, location, status, assigned_helper_id, assigned_at, done_at, cancelled_at"
          )
          .eq("id", id)
          .single();

        if (taskError || !taskData) {
          console.error("Task error:", taskError);
          setErr("Task not found.");
          setLoading(false);
          return;
        }

        const taskOwnerId = taskData.user_id || null;
        const isOwner = userId && taskOwnerId === userId;
        const isAssignedHelper =
          userId && taskData.assigned_helper_id === userId;

        setTask(taskData);

        if (!taskOwnerId && !warnedMissingOwnerRef.current) {
          console.warn("Task is missing user_id, chat button disabled.", taskData);
          warnedMissingOwnerRef.current = true;
        }

        if (taskData.status !== "open" && !isOwner && !isAssignedHelper) {
          setNotAvailable(true);
          setLoading(false);
          return;
        }

        if (isOwner) {
          const { data: assignmentData, error: assignmentError } = await supabase
            .from("task_assignments")
            .select("user_id")
            .eq("task_id", taskData.id)
            .order("created_at", { ascending: true })
            .limit(1)
            .maybeSingle();

          if (assignmentError) {
            console.warn("Assignment error:", assignmentError);
          }

          const helperId = taskData.assigned_helper_id || assignmentData?.user_id || null;
          if (helperId) {
            setChatReceiverId(helperId);
            setChatHint("");
          } else {
            setChatReceiverId(null);
            setChatHint("No helper assigned yet.");
          }
        } else {
          setChatReceiverId(taskOwnerId);
          setChatHint("");
        }

        // 2️⃣ Prendo il profilo owner (se esiste tabella profiles)
        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select(
            "id, full_name, avatar_url, is_professional, rating_as_helper, num_helper_reviews"
          )
          .eq("id", taskOwnerId)
          .maybeSingle(); // 👈 più safe di single()

        if (profileError) {
          console.warn("Profile error:", profileError);
        }

        setOwner(profileData || null);

        if (isOwner) {
          const { data: offerData, error: offerError } = await supabase
            .from("task_offers")
            .select("id, helper_id, message, created_at, status")
            .eq("task_id", taskData.id)
            .order("created_at", { ascending: false });

          if (offerError) {
            console.warn("Offer error:", offerError);
          }

          setOffers(offerData || []);
        }

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
    if (!task || !chatReceiverId) return;
    navigate(`/chat/resolve/${task.id}/${chatReceiverId}`);
  };

  const isOwner = currentUserId && task?.user_id === currentUserId;
  const isAssignedHelper =
    currentUserId && task?.assigned_helper_id === currentUserId;

  const handleDelete = async () => {
    if (!task || !isOwner) return;
    if (!["open", "cancelled"].includes(task.status || "open")) {
      setActionError("Only open or cancelled tasks can be deleted.");
      return;
    }
    setActionLoading(true);
    setActionError("");
    setActionNotice("");

    const taskId = task.id;

    const { error: offersError } = await supabase
      .from("task_offers")
      .delete()
      .eq("task_id", taskId);

    if (offersError) {
      setActionError(offersError.message);
      setActionLoading(false);
      return;
    }

    const { data: convoRows, error: convoError } = await supabase
      .from("conversations")
      .select("id")
      .eq("task_id", taskId);

    if (convoError) {
      setActionError(convoError.message);
      setActionLoading(false);
      return;
    }

    const convoIds = (convoRows || []).map((row) => row.id);
    if (convoIds.length > 0) {
      const { error: messagesError } = await supabase
        .from("messages")
        .delete()
        .in("conversation_id", convoIds);

      if (messagesError) {
        setActionError(messagesError.message);
        setActionLoading(false);
        return;
      }

      const { error: convoDeleteError } = await supabase
        .from("conversations")
        .delete()
        .in("id", convoIds);

      if (convoDeleteError) {
        setActionError(convoDeleteError.message);
        setActionLoading(false);
        return;
      }
    }

    const { error: taskError } = await supabase
      .from("tasks")
      .delete()
      .eq("id", taskId)
      .eq("user_id", currentUserId);

    if (taskError) {
      setActionError(taskError.message);
      setActionLoading(false);
      return;
    }

    setDeleted(true);
    setActionLoading(false);
  };

  const handleCancel = async () => {
    if (!task || !isOwner) return;
    if (task.status === "done" || task.status === "cancelled") return;
    setActionLoading(true);
    setActionError("");
    setActionNotice("");

    const { data, error } = await supabase
      .from("tasks")
      .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
      .eq("id", task.id)
      .eq("user_id", currentUserId)
      .select()
      .single();

    if (error) {
      setActionError(error.message);
    } else {
      setTask(data);
      setActionNotice("Task cancelled.");
    }

    setActionLoading(false);
  };

  const handleMarkDone = async () => {
    if (!task || !isOwner) return;
    if (task.status === "done" || task.status === "cancelled") return;
    setActionLoading(true);
    setActionError("");
    setActionNotice("");

    const { data, error } = await supabase
      .from("tasks")
      .update({ status: "done", done_at: new Date().toISOString() })
      .eq("id", task.id)
      .eq("user_id", currentUserId)
      .select()
      .single();

    if (error) {
      setActionError(error.message);
    } else {
      setTask(data);
      setActionNotice("Task marked as done.");
    }

    setActionLoading(false);
  };

  const handleMakeOffer = async () => {
    if (!task || isOwner || task.status !== "open") return;
    if (!currentUserId) {
      setActionError("Please log in to make an offer.");
      return;
    }
    if (!offerMessage.trim()) {
      setActionError("Add a message to your offer.");
      return;
    }
    setActionLoading(true);
    setActionError("");
    setActionNotice("");

    const { error } = await supabase.from("task_offers").insert([
      {
        task_id: task.id,
        helper_id: currentUserId,
        message: offerMessage.trim(),
        status: "pending",
      },
    ]);

    if (error) {
      setActionError(error.message);
    } else {
      setOfferMessage("");
      setActionNotice("Offer sent.");
    }

    setActionLoading(false);
  };

  const handleAcceptOffer = async (offer) => {
    if (!task || !isOwner || task.status !== "open") return;
    setActionLoading(true);
    setActionError("");
    setActionNotice("");

    const now = new Date().toISOString();
    const { data: updatedTask, error: taskError } = await supabase
      .from("tasks")
      .update({
        status: "assigned",
        assigned_helper_id: offer.helper_id,
        assigned_at: now,
      })
      .eq("id", task.id)
      .eq("user_id", currentUserId)
      .select()
      .single();

    if (taskError) {
      setActionError(taskError.message);
      setActionLoading(false);
      return;
    }

    const { error: acceptError } = await supabase
      .from("task_offers")
      .update({ status: "accepted" })
      .eq("id", offer.id)
      .eq("task_id", task.id);

    if (acceptError) {
      setActionError(acceptError.message);
      setActionLoading(false);
      return;
    }

    const { error: rejectError } = await supabase
      .from("task_offers")
      .update({ status: "rejected" })
      .eq("task_id", task.id)
      .eq("status", "pending")
      .neq("id", offer.id);

    if (rejectError) {
      setActionError(rejectError.message);
      setActionLoading(false);
      return;
    }

    setTask(updatedTask);
    setOffers((prev) =>
      prev.map((item) => {
        if (item.id === offer.id) return { ...item, status: "accepted" };
        if (item.status === "pending") return { ...item, status: "rejected" };
        return item;
      })
    );
    setChatReceiverId(offer.helper_id);
    setActionNotice("Helper assigned.");
    setActionLoading(false);
  };

  if (deleted) {
    return (
      <div style={styles.page}>
        <p>This task was deleted.</p>
        <button style={styles.backBtn} onClick={() => navigate(-1)}>
          ← Back
        </button>
      </div>
    );
  }

  if (notAvailable) {
    return (
      <div style={styles.page}>
        <p>This task is no longer available.</p>
        <button style={styles.backBtn} onClick={() => navigate(-1)}>
          ← Back
        </button>
      </div>
    );
  }

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
          <div style={styles.titleRow}>
            <h1 style={styles.title}>{task.title}</h1>
            {task.status && (
              <span style={styles.statusBadge}>{task.status}</span>
            )}
          </div>

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
            {(!isOwner || chatReceiverId) && (
              <button
                style={{
                  ...styles.chatBtn,
                  opacity: chatReceiverId ? 1 : 0.6,
                  cursor: chatReceiverId ? "pointer" : "not-allowed",
                }}
                onClick={handleChat}
                disabled={!chatReceiverId}
              >
                {currentUserId && task.user_id === currentUserId
                  ? "Chat with helper"
                  : `Chat with ${owner?.full_name || "this person"}`}
              </button>
            )}
            {chatHint && (
              <p style={{ margin: "0 0 0.5rem 0", fontSize: "0.8rem", color: "#6b7280" }}>
                {chatHint}
              </p>
            )}

            {actionError && (
              <p style={{ margin: "0 0 0.5rem 0", fontSize: "0.8rem", color: "#dc2626" }}>
                {actionError}
              </p>
            )}
            {actionNotice && (
              <p style={{ margin: "0 0 0.5rem 0", fontSize: "0.8rem", color: "#0f766e" }}>
                {actionNotice}
              </p>
            )}

            {!isOwner && task.status === "open" && (
              <div style={{ marginTop: "0.8rem" }}>
                <h4 style={{ margin: "0 0 0.4rem 0" }}>Make an offer</h4>
                <textarea
                  rows={3}
                  value={offerMessage}
                  onChange={(e) => setOfferMessage(e.target.value)}
                  placeholder="Say hello and share your availability"
                  style={{
                    width: "100%",
                    padding: "0.6rem",
                    borderRadius: "8px",
                    border: "1px solid #d1d5db",
                    fontSize: "0.85rem",
                    marginBottom: "0.5rem",
                  }}
                />
                <button
                  style={styles.secondaryBtn}
                  onClick={handleMakeOffer}
                  disabled={actionLoading}
                >
                  {actionLoading ? "Sending…" : "Send offer"}
                </button>
              </div>
            )}

            {isOwner && (
              <div style={{ marginTop: "0.8rem" }}>
                <h4 style={{ margin: "0 0 0.4rem 0" }}>Offers</h4>
                {offers.length === 0 ? (
                  <p style={{ fontSize: "0.8rem", color: "#6b7280" }}>
                    No offers yet.
                  </p>
                ) : (
                  offers.map((offer) => (
                    <div key={offer.id} style={styles.offerRow}>
                      <div>
                        <div style={{ fontSize: "0.85rem", fontWeight: 600 }}>
                          Helper {String(offer.helper_id).slice(0, 8)}…
                        </div>
                        <div style={{ fontSize: "0.75rem", color: "#64748b" }}>
                          {offer.message}
                        </div>
                        <div style={{ fontSize: "0.7rem", color: "#94a3b8" }}>
                          {offer.status}
                        </div>
                      </div>
                      {task.status === "open" && offer.status === "pending" && (
                        <button
                          style={styles.secondaryBtn}
                          onClick={() => handleAcceptOffer(offer)}
                          disabled={actionLoading}
                        >
                          Accept
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}

            {isOwner && (
              <div style={{ marginTop: "0.8rem" }}>
                <h4 style={{ margin: "0 0 0.4rem 0" }}>Owner actions</h4>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                  <button
                    style={styles.secondaryBtn}
                    onClick={handleMarkDone}
                    disabled={actionLoading || task.status === "done"}
                  >
                    Mark done
                  </button>
                  <button
                    style={styles.secondaryBtn}
                    onClick={handleCancel}
                    disabled={actionLoading || task.status === "cancelled"}
                  >
                    Cancel task
                  </button>
                  <button
                    style={styles.dangerBtn}
                    onClick={handleDelete}
                    disabled={actionLoading}
                  >
                    Delete task
                  </button>
                </div>
              </div>
            )}
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
  titleRow: {
    display: "flex",
    alignItems: "center",
    gap: "0.75rem",
    flexWrap: "wrap",
  },
  title: {
    margin: "0 0 0.4rem 0",
    fontSize: "1.6rem",
  },
  statusBadge: {
    fontSize: "0.75rem",
    padding: "0.2rem 0.5rem",
    borderRadius: "999px",
    backgroundColor: "#e2e8f0",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
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
  secondaryBtn: {
    width: "100%",
    padding: "0.5rem 0.8rem",
    borderRadius: "999px",
    border: "1px solid #cbd5f5",
    background: "#eef2ff",
    color: "#3730a3",
    fontWeight: 600,
    cursor: "pointer",
  },
  dangerBtn: {
    width: "100%",
    padding: "0.5rem 0.8rem",
    borderRadius: "999px",
    border: "1px solid #fecaca",
    background: "#fee2e2",
    color: "#b91c1c",
    fontWeight: 600,
    cursor: "pointer",
  },
  offerRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: "0.75rem",
    alignItems: "center",
    padding: "0.6rem",
    border: "1px solid #e2e8f0",
    borderRadius: "10px",
    marginBottom: "0.5rem",
  },
  textSmall: {
    fontSize: "0.8rem",
    color: "#444",
    margin: "0 0 0.3rem 0",
  },
};
