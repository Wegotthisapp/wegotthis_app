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
  const [maxRadiusKm, setMaxRadiusKm] = useState(5); // UI state; DB column will be wired later
  const [availabilityText, setAvailabilityText] = useState("{}");
  const [isProfessional, setIsProfessional] = useState(false);

  const [rating, setRating] = useState(0);
  const [numReviews, setNumReviews] = useState(0);

  const [createdTasks, setCreatedTasks] = useState([]);
  const [helpedTasks, setHelpedTasks] = useState([]);
  const [tasksError, setTasksError] = useState("");
  const [taskActionError, setTaskActionError] = useState("");
  const [taskActionNotice, setTaskActionNotice] = useState("");
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

      // Do NOT select max_distance_km for now to avoid schema errors
      const { data, error } = await supabase
        .from("profiles")
        .select(
          "full_name, avatar_url, helper_categories, helper_tools, availability, is_professional, rating_as_helper, num_helper_reviews"
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
        // Try to read either max_distance_km or max_radius_km if present
        const maybeMax = data.max_distance_km ?? data.max_radius_km ?? null;
        if (maybeMax != null) setMaxRadiusKm(Number(maybeMax));
        setAvailabilityText(
          data.availability ? JSON.stringify(data.availability, null, 2) : "{}"
        );
        setIsProfessional(Boolean(data.is_professional));
        setRating(data.rating_as_helper || 0);
        setNumReviews(data.num_helper_reviews || 0);
      }

      await fetchTaskLists(user.id);
      setLoading(false);
    };

    fetchProfile();
  }, []);

  const fetchTaskLists = async (uid) => {
    setTasksError("");

    // Tasks created by the user
    const { data: created, error: createdErr } = await supabase
      .from("tasks")
      .select("id, user_id, title, category, created_at, status, assigned_helper_id")
      .eq("user_id", uid)
      .order("created_at", { ascending: false });

    if (createdErr) {
      setTasksError(createdErr.message);
      setCreatedTasks([]);
    } else {
      setCreatedTasks(created || []);
    }

    // Tasks the user helped with — alias created_at -> assigned_at, and use user_id
    const { data: helped, error: helpedErr } = await supabase
      .from("task_assignments")
      .select(`
        id,
        assigned_at:created_at,
        tasks:task_id ( id, user_id, title, category, created_at, status, assigned_helper_id )
      `)
      .eq("user_id", uid)
      .order("created_at", { ascending: false });

    if (helpedErr) {
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

  const refreshTasks = async () => {
    if (!userId) return;
    await fetchTaskLists(userId);
  };

  const handleTaskDelete = async (taskId) => {
    if (!userId) return;
    setTaskActionError("");
    setTaskActionNotice("");

    const { error: offersError } = await supabase
      .from("task_offers")
      .delete()
      .eq("task_id", taskId);

    if (offersError) {
      setTaskActionError(offersError.message);
      return;
    }

    const { error: messagesError } = await supabase
      .from("messages")
      .delete()
      .eq("task_id", taskId);

    if (messagesError) {
      setTaskActionError(messagesError.message);
      return;
    }

    const { error: taskError } = await supabase
      .from("tasks")
      .delete()
      .eq("id", taskId)
      .eq("user_id", userId);

    if (taskError) {
      setTaskActionError(taskError.message);
      return;
    }

    setTaskActionNotice("Task deleted.");
    refreshTasks();
  };

  const handleTaskCancel = async (taskId) => {
    if (!userId) return;
    setTaskActionError("");
    setTaskActionNotice("");

    const { error } = await supabase
      .from("tasks")
      .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
      .eq("id", taskId)
      .eq("user_id", userId);

    if (error) {
      setTaskActionError(error.message);
      return;
    }

    setTaskActionNotice("Task cancelled.");
    refreshTasks();
  };

  const handleTaskDone = async (taskId) => {
    if (!userId) return;
    setTaskActionError("");
    setTaskActionNotice("");

    const { error } = await supabase
      .from("tasks")
      .update({ status: "done", done_at: new Date().toISOString() })
      .eq("id", taskId)
      .eq("user_id", userId);

    if (error) {
      setTaskActionError(error.message);
      return;
    }

    setTaskActionNotice("Task marked as done.");
    refreshTasks();
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
        setError('Availability must be valid JSON (e.g. {"mon":["18-21"]}).');
        setSaving(false);
        return;
      }
    }

    // Build updates WITHOUT updated_at
    const updates = {
      id: user.id,
      full_name: fullName,
      avatar_url: avatarUrl || null,
      helper_categories: helperCategories,
      helper_tools: helperTools,
      // When DB column is ready, add: max_distance_km: Number(maxRadiusKm)
      availability: parsedAvailability,
      is_professional: isProfessional,
    };

    const { error } = await supabase.from("profiles").upsert(updates, { onConflict: "id" });

    if (error) {
      setError(error.message);
    } else {
      alert("✅ Profile saved!");
    }

    setSaving(false);
  };

  if (loading) return <p>Loading profile…</p>;
  if (error) return <p style={{ color: "red" }}>{error}</p>;

  const openTasks = (createdTasks || []).filter(
    (task) => (task.status || "open") === "open"
  );
  const assignedTasks = (createdTasks || []).filter(
    (task) => task.status === "assigned"
  );
  const doneTasks = (createdTasks || []).filter(
    (task) => task.status === "done"
  );
  const cancelledTasks = (createdTasks || []).filter(
    (task) => task.status === "cancelled"
  );

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

      <OwnerTasksSection
        title="Open tasks"
        color="#7c3aed"
        tasks={openTasks}
        emptyText="You have no open tasks."
        onDelete={handleTaskDelete}
        onCancel={handleTaskCancel}
        onDone={handleTaskDone}
      />
      <OwnerTasksSection
        title="Assigned tasks"
        color="#2563eb"
        tasks={assignedTasks}
        emptyText="No tasks are assigned yet."
        onDelete={handleTaskDelete}
        onCancel={handleTaskCancel}
        onDone={handleTaskDone}
      />
      <OwnerTasksSection
        title="Done tasks"
        color="#16a34a"
        tasks={doneTasks}
        emptyText="No tasks are marked done yet."
        onDelete={handleTaskDelete}
        onCancel={handleTaskCancel}
        onDone={handleTaskDone}
      />
      <OwnerTasksSection
        title="Cancelled tasks"
        color="#f97316"
        tasks={cancelledTasks}
        emptyText="No tasks are cancelled."
        onDelete={handleTaskDelete}
        onCancel={handleTaskCancel}
        onDone={handleTaskDone}
      />

      <TasksSection
        title="Tasks you helped with"
        color="#1d4ed8"
        tasks={helpedTasks}
        emptyText="You haven't been assigned to tasks yet."
      />

      {(taskActionError || taskActionNotice) && (
        <p style={{ color: taskActionError ? "red" : "#0f766e" }}>
          {taskActionError || taskActionNotice}
        </p>
      )}
      {tasksError && <p style={{ color: "red" }}>{tasksError}</p>}
    </div>
  );
}

function OwnerTasksSection({
  title,
  color,
  tasks,
  emptyText,
  onDelete,
  onCancel,
  onDone,
}) {
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
                {task.assigned_helper_id && (
                  <p style={{ margin: "0.2rem 0 0 0", color: "#64748b" }}>
                    Assigned to {String(task.assigned_helper_id).slice(0, 8)}…
                  </p>
                )}
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
            <div style={{ marginTop: "0.6rem", display: "flex", gap: "0.5rem" }}>
              {["open", "assigned"].includes(task.status || "open") && (
                <button
                  style={smallButton}
                  onClick={() => onDone(task.id)}
                >
                  Mark done
                </button>
              )}
              {task.status !== "cancelled" && task.status !== "done" && (
                <button
                  style={smallButton}
                  onClick={() => onCancel(task.id)}
                >
                  Cancel
                </button>
              )}
              {["open", "cancelled"].includes(task.status || "open") && (
                <button
                  style={smallDangerButton}
                  onClick={() => onDelete(task.id)}
                >
                  Delete
                </button>
              )}
            </div>
          </div>
        ))}
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

const smallButton = {
  border: "1px solid #c7d2fe",
  background: "#eef2ff",
  color: "#3730a3",
  padding: "0.3rem 0.6rem",
  borderRadius: "999px",
  fontSize: "0.75rem",
  cursor: "pointer",
};

const smallDangerButton = {
  border: "1px solid #fecaca",
  background: "#fee2e2",
  color: "#b91c1c",
  padding: "0.3rem 0.6rem",
  borderRadius: "999px",
  fontSize: "0.75rem",
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
