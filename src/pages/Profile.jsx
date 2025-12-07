import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { categoryOptions, toolsOptions } from "../lib/constants";

export default function Profile() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [fullName, setFullName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [helperCategories, setHelperCategories] = useState([]);
  const [helperTools, setHelperTools] = useState([]);
  const [maxRadiusKm, setMaxRadiusKm] = useState(5);
  const [availabilityText, setAvailabilityText] = useState("{}");
  const [isProfessional, setIsProfessional] = useState(false);

  const [rating, setRating] = useState(0);
  const [numReviews, setNumReviews] = useState(0);

  const [createdTasks, setCreatedTasks] = useState([]);
  const [helpedTasks, setHelpedTasks] = useState([]);
  const [tasksError, setTasksError] = useState("");
  const [userId, setUserId] = useState(null);
  const [userEmail, setUserEmail] = useState("");

  useEffect(() => {
    const fetchProfile = async () => {
      setLoading(true);
      setError("");

      const { data: userData, error: userError } = await supabase.auth.getUser();
      const user = userData?.user;
      if (userError || !user) {
        setError("Not logged in");
        setLoading(false);
        return;
      }
      setUserId(user.id);
      setUserEmail(user.email || "");

      const { data, error } = await supabase
        .from("profiles")
        .select(
          "full_name, avatar_url, helper_categories, helper_tools, max_radius_km, availability, is_professional, rating_as_helper, num_helper_reviews"
        )
        .eq("id", user.id)
        .maybeSingle();

      if (error) {
        setError(error.message);
      } else if (data) {
        setFullName(data.full_name || "");
        setAvatarUrl(data.avatar_url || "");
        setHelperCategories(data.helper_categories || []);
        setHelperTools(data.helper_tools || []);
        if (data.max_radius_km != null) setMaxRadiusKm(data.max_radius_km);
        setAvailabilityText(
          data.availability ? JSON.stringify(data.availability, null, 2) : "{}"
        );
        setIsProfessional(Boolean(data.is_professional));
        setRating(data.rating_as_helper || 0);
        setNumReviews(data.num_helper_reviews || 0);
      }

      // fetch related tasks even if profile row is missing but user exists
      await fetchTaskLists(user.id);

      setLoading(false);
    };

    fetchProfile();
  }, []);

  const fetchTaskLists = async (userId) => {
    setTasksError("");

    // Tasks created by the user
    const { data: created, error: createdErr } = await supabase
      .from("tasks")
      .select("id, title, category, created_at, status")
      .eq("owner_id", userId)
      .order("created_at", { ascending: false });

    if (createdErr) {
      setTasksError(createdErr.message);
      setCreatedTasks([]);
    } else {
      setCreatedTasks(created || []);
    }

    // Tasks the user helped with (from task_assignments)
    const { data: helped, error: helpedErr } = await supabase
      .from("task_assignments")
      .select("assigned_at, tasks:task_id(id, title, category, created_at, status)")
      .eq("helper_id", userId)
      .order("assigned_at", { ascending: false });

    if (helpedErr) {
      // don't overwrite created tasks if only helped fails
      setTasksError((prev) =>
        prev ? `${prev} | ${helpedErr.message}` : helpedErr.message
      );
      setHelpedTasks([]);
    } else {
      const flattened = (helped || [])
        .map((row) => ({
          ...(row.tasks || {}),
          assigned_at: row.assigned_at,
        }))
        .filter((t) => t.id);
      setHelpedTasks(flattened);
    }
  };

  const toggleChip = (value, listSetter, list) => {
    listSetter(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");

    const { data: userData, error: userError } = await supabase.auth.getUser();
    const user = userData?.user;
    if (userError || !user) {
      setError("Not logged in");
      setSaving(false);
      return;
    }

    let parsedAvailability = null;
    if (availabilityText.trim()) {
      try {
        parsedAvailability = JSON.parse(availabilityText);
      } catch (err) {
        setError("Availability must be valid JSON (e.g. {\"mon\":[\"18-21\"]}).");
        setSaving(false);
        return;
      }
    }

    const updates = {
      id: user.id,
      full_name: fullName,
      avatar_url: avatarUrl || null,
      helper_categories: helperCategories,
      helper_tools: helperTools,
      max_radius_km: maxRadiusKm ? Number(maxRadiusKm) : null,
      availability: parsedAvailability,
      is_professional: isProfessional,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from("profiles")
      .upsert(updates, { onConflict: "id" });

    if (error) {
      setError(error.message);
    } else {
      alert("✅ Profile saved!");
    }

    setSaving(false);
  };

  if (loading) return <p>Loading profile…</p>;
  if (error) return <p style={{ color: "red" }}>{error}</p>;

  return (
    <div style={{ maxWidth: "700px", margin: "2rem auto", padding: "1rem" }}>
      <h2>My Profile</h2>

      <div style={{ marginBottom: "1rem", color: "#555" }}>
        {userEmail && (
          <p style={{ margin: 0 }}>
            <strong>Email:</strong> {userEmail}
          </p>
        )}
        <p style={{ margin: "0.25rem 0 0 0" }}>
          <strong>Helper rating:</strong>{" "}
          {rating ? `${rating.toFixed(2)} (${numReviews} reviews)` : "No reviews yet"}
        </p>
      </div>

      <div style={summaryCard}>
        <h3 style={{ margin: "0 0 0.4rem 0" }}>Your helper profile</h3>
        <p style={{ margin: 0 }}>
          <strong>Name:</strong> {fullName || "Not set"}
        </p>
        <p style={{ margin: "0.2rem 0" }}>
          <strong>Professional:</strong> {isProfessional ? "Yes" : "No"}
        </p>
        <p style={{ margin: "0.2rem 0" }}>
          <strong>Categories:</strong>{" "}
          {helperCategories.length ? helperCategories.join(", ") : "None yet"}
        </p>
        <p style={{ margin: "0.2rem 0" }}>
          <strong>Tools:</strong>{" "}
          {helperTools.length ? helperTools.join(", ") : "None yet"}
        </p>
        <p style={{ margin: "0.2rem 0" }}>
          <strong>Max radius:</strong>{" "}
          {maxRadiusKm != null ? `${maxRadiusKm} km` : "Not set"}
        </p>
      </div>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        <label>
          Full name:
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            style={inputStyle}
            required
          />
        </label>

        <label>
          Avatar URL:
          <input
            value={avatarUrl}
            onChange={(e) => setAvatarUrl(e.target.value)}
            style={inputStyle}
            placeholder="https://…"
          />
        </label>

        <div>
          <p style={labelStyle}>Helper categories</p>
          <div style={chipContainer}>
            {categoryOptions.map((cat) => {
              const selected = helperCategories.includes(cat);
              return (
                <button
                  type="button"
                  key={cat}
                  onClick={() => toggleChip(cat, setHelperCategories, helperCategories)}
                  style={{ ...chipStyle, ...(selected ? chipSelected : {}) }}
                >
                  {cat}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <p style={labelStyle}>Tools you have</p>
          <div style={chipContainer}>
            {toolsOptions.map((tool) => {
              const selected = helperTools.includes(tool);
              return (
                <button
                  type="button"
                  key={tool}
                  onClick={() => toggleChip(tool, setHelperTools, helperTools)}
                  style={{ ...chipStyle, ...(selected ? chipSelected : {}) }}
                >
                  {tool}
                </button>
              );
            })}
          </div>
        </div>

        <label>
          Max radius you can travel (km):
          <input
            type="number"
            min="0"
            step="1"
            value={maxRadiusKm}
            onChange={(e) => setMaxRadiusKm(e.target.value)}
            style={inputStyle}
          />
        </label>

        <label>
          Availability (JSON, e.g. {"{\"mon\":[\"18-21\"],\"sat\":[\"10-16\"]}"})
          <textarea
            value={availabilityText}
            onChange={(e) => setAvailabilityText(e.target.value)}
            rows={4}
            style={textareaStyle}
          />
        </label>

        <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <input
            type="checkbox"
            checked={isProfessional}
            onChange={(e) => setIsProfessional(e.target.checked)}
          />
          I am a professional (can provide certificates)
        </label>

        <button type="submit" disabled={saving} style={saveButton}>
          {saving ? "Saving…" : "Save Profile"}
        </button>
      </form>

      <TasksSection
        title="Tasks you created"
        color="#7c3aed"
        tasks={createdTasks}
        emptyText="You haven't created any tasks yet."
      />

      <TasksSection
        title="Tasks you helped with"
        color="#1d4ed8"
        tasks={helpedTasks}
        emptyText="You haven't been assigned to tasks yet."
      />

      {tasksError && <p style={{ color: "red" }}>{tasksError}</p>}
    </div>
  );
}

function TasksSection({ title, color, tasks, emptyText }) {
  return (
    <div style={{ marginTop: "2rem" }}>
      <h3 style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <span
          style={{
            display: "inline-block",
            width: "12px",
            height: "12px",
            borderRadius: "999px",
            backgroundColor: color,
          }}
        />
        {title}
      </h3>
      {(!tasks || tasks.length === 0) && <p style={{ color: "#475569" }}>{emptyText}</p>}
      {tasks &&
        tasks.map((task) => (
          <div key={task.id} style={{ ...taskCard, borderColor: color }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <div>
                <p style={{ margin: "0 0 0.2rem 0", fontWeight: 600 }}>{task.title}</p>
                <p style={{ margin: 0, color: "#475569" }}>
                  {task.category || "No category"} ·{" "}
                  {task.created_at
                    ? new Date(task.created_at).toLocaleDateString()
                    : "Date unknown"}
                </p>
              </div>
              <span
                style={{
                  backgroundColor: color,
                  color: "#fff",
                  padding: "0.2rem 0.5rem",
                  borderRadius: "999px",
                  fontSize: "0.8rem",
                  alignSelf: "flex-start",
                  textTransform: "capitalize",
                }}
              >
                {task.status || "open"}
              </span>
            </div>
          </div>
        ))}
    </div>
  );
}

const inputStyle = {
  width: "100%",
  padding: "0.65rem",
  borderRadius: "8px",
  border: "1px solid #d0d7de",
  marginTop: "0.35rem",
};

const textareaStyle = {
  ...inputStyle,
  minHeight: "120px",
};

const labelStyle = {
  margin: "0 0 0.25rem 0",
  fontWeight: 600,
};

const chipContainer = {
  display: "flex",
  flexWrap: "wrap",
  gap: "0.5rem",
};

const chipStyle = {
  borderRadius: "999px",
  border: "1px solid #d0d7ff",
  padding: "0.4rem 0.9rem",
  backgroundColor: "#f5f7ff",
  cursor: "pointer",
};

const chipSelected = {
  backgroundColor: "#1d4ed8",
  color: "#fff",
  borderColor: "#1d4ed8",
};

const saveButton = {
  padding: "0.75rem",
  border: "none",
  borderRadius: "8px",
  backgroundColor: "#1d4ed8",
  color: "#fff",
  fontWeight: 600,
  cursor: "pointer",
};

const summaryCard = {
  border: "1px solid #e2e8f0",
  borderRadius: "10px",
  padding: "0.9rem",
  backgroundColor: "#f8fafc",
};

const taskCard = {
  border: "1px solid #e2e8f0",
  borderRadius: "10px",
  padding: "0.75rem",
  marginTop: "0.6rem",
  backgroundColor: "#fff",
};
