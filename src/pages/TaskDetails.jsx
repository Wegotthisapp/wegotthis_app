import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

const formatDistance = (maxDistanceKm) => {
  if (maxDistanceKm == null) return "Distance not specified";
  if (maxDistanceKm < 1) return "< 1 km away";
  return `${Number(maxDistanceKm).toFixed(1)} km away`;
};

export default function TaskDetails() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [task, setTask] = useState(null);
  const [poster, setPoster] = useState(null);
  const [user, setUser] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    (async () => {
      const { data: authData } = await supabase.auth.getUser();
      setUser(authData?.user || null);
    })();
  }, []);

  useEffect(() => {
    (async () => {
      setErrorMsg("");
      setTask(null);
      setPoster(null);

      // 1) Load task (MVP-aligned fields)
      const { data: taskData, error: taskErr } = await supabase
        .from("tasks")
        .select(
          [
            "id",
            "user_id",
            "title",
            "description",
            "status",
            "category",
            "created_at",
            "barter",
            "is_negotiable",
            "price_min",
            "price_max",
            "currency",
            "location_text",
            "location_lat",
            "location_lng",
            "max_distance_km",
          ].join(", ")
        )
        .eq("id", id)
        .maybeSingle();

      if (taskErr) {
        console.error("TaskDetails fetch error:", taskErr);
        setErrorMsg(taskErr.message);
        return;
      }
      if (!taskData) {
        setErrorMsg("Task not found (no row returned)");
        return;
      }

      setTask(taskData);

      // 2) Load poster from public view
      const { data: profileData, error: profileErr } = await supabase
        .from("public_profiles")
        .select("id, full_name, avatar_url")
        .eq("id", taskData.user_id)
        .maybeSingle();

      if (profileErr) {
        console.error("Poster profile fetch error:", profileErr);
      } else {
        setPoster(profileData || null);
      }
    })();
  }, [id]);

  const isMyTask = useMemo(() => {
    return !!user?.id && !!task?.user_id && user.id === task.user_id;
  }, [user?.id, task?.user_id]);

  const isOwner = user?.id && task?.user_id === user.id;

  const goToChat = () => {
    if (!user?.id) return;
    if (!task?.id || !task?.user_id) return;

    if (isOwner) {
      navigate(`/chat/task/${task.id}`);
      return;
    }

    navigate(`/chat/task/${task.id}/user/${task.user_id}`);
  };


  if (errorMsg) return <div style={{ padding: 16 }}>Error: {errorMsg}</div>;
  if (!task) return <div style={{ padding: 16 }}>Loading…</div>;

  return (
    <div style={{ padding: 16, maxWidth: 900, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
        <div>
          <h2 style={{ marginBottom: 8 }}>{task.title}</h2>
          <div style={{ opacity: 0.8, marginBottom: 8 }}>
            <span>Status: {task.status}</span> · <span>Category: {task.category}</span>
          </div>
          {task.created_at && (
            <div style={{ opacity: 0.7, fontSize: 14 }}>
              Posted: {new Date(task.created_at).toLocaleString()}
            </div>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <button
            type="button"
            onClick={goToChat}
            style={{ padding: "10px 14px", cursor: "pointer" }}
          >
            {isOwner ? "Open chat" : "Chat with this person"}
          </button>
          {isMyTask && <div style={{ fontSize: 14, opacity: 0.8 }}>This is your task.</div>}

          <button
            type="button"
            onClick={() => navigate(-1)}
            style={{ padding: "10px 14px", cursor: "pointer" }}
          >
            Back
          </button>
        </div>
      </div>

      <hr style={{ margin: "16px 0" }} />

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16 }}>
        {/* Left: Task */}
        <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 16 }}>
          <h3 style={{ marginTop: 0 }}>Details</h3>

          <p style={{ whiteSpace: "pre-wrap" }}>
            {task.description || "No description provided."}
          </p>

          <div style={{ marginTop: 12 }}>
            <strong>Compensation: </strong>
            <span>
              {formatCompensation(task)} {task.is_negotiable ? "(negotiable)" : ""}
            </span>
          </div>

          <div style={{ marginTop: 12 }}>
            <strong>Location: </strong>
            {task.location_text ? <span>{task.location_text}</span> : <span>Not specified</span>}
          </div>

          <div style={{ marginTop: 12 }}>
            <strong>Distance: </strong>
            <span>{distanceLabel}</span>
          </div>

          <div
            style={{
              marginTop: 12,
              border: "1px dashed #ccc",
              borderRadius: 12,
              padding: 12,
              opacity: 0.9,
            }}
          >
            <strong>Map preview</strong>
            <div style={{ fontSize: 14, marginTop: 6, opacity: 0.8 }}>
              {task.location_lat && task.location_lng
                ? `Coordinates: ${task.location_lat}, ${task.location_lng} (render map here)`
                : "No coordinates saved yet."}
            </div>
          </div>
        </div>

        {/* Right: Poster */}
        <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 16 }}>
          <h3 style={{ marginTop: 0 }}>Posted by</h3>

          {poster ? (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: "50%",
                    background: "#f2f2f2",
                    overflow: "hidden",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 700,
                  }}
                >
                  {poster.avatar_url ? (
                    <img
                      src={poster.avatar_url}
                      alt="avatar"
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  ) : (
                    avatarInitial
                  )}
                </div>

                <div>
                  <div style={{ fontWeight: 700 }}>{displayName}</div>
                </div>
              </div>

              <div style={{ marginTop: 12 }}>
                <button
                  type="button"
                  onClick={() => navigate(`/profile/${poster.id}`)}
                  style={{ padding: "10px 14px", cursor: "pointer", width: "100%" }}
                >
                  View profile
                </button>
              </div>
            </>
          ) : (
            <div style={{ fontSize: 14, opacity: 0.8 }}>Poster info not available yet.</div>
          )}
        </div>
      </div>
    </div>
  );
}
