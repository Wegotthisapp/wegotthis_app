import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { categoryOptions } from "../lib/constants";
import TaskCard from "../components/TaskCard";
import { useAuth } from "../auth/useAuth";

export default function Tasks() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedType, setSelectedType] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError("");

      let query = supabase
        .from("tasks")
        .select(
          "id, user_id, title, description, category, status, task_type, price_min, price_max, currency, max_distance_km, created_at"
        )
        .eq("status", "open")
        .order("created_at", { ascending: false })
        .limit(100);

      if (selectedCategory) query = query.eq("category", selectedCategory);
      if (selectedType) query = query.eq("task_type", selectedType);

      const { data, error } = await query;

      if (error) {
        setError(error.message);
        setTasks([]);
      } else {
        setTasks(data || []);
      }

      setLoading(false);
    })();
  }, [selectedCategory, selectedType]);

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "1.5rem 1rem" }}>
      <h2 style={{ marginBottom: "1rem" }}>Browse Tasks</h2>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "1rem" }}>
        <button
          onClick={() => setSelectedCategory("")}
          style={chip(selectedCategory === "")}
        >
          All categories
        </button>
        {categoryOptions.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(selectedCategory === cat ? "" : cat)}
            style={chip(selectedCategory === cat)}
          >
            {cat}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.25rem" }}>
        {[
          { label: "All types", value: "" },
          { label: "Requests (Ask)", value: "ask" },
          { label: "Offers", value: "offer" },
        ].map(({ label, value }) => (
          <button
            key={value}
            onClick={() => setSelectedType(value)}
            style={chip(selectedType === value)}
          >
            {label}
          </button>
        ))}
      </div>

      {error && <p style={{ color: "red" }}>{error}</p>}

      {loading ? (
        <p>Loading tasks…</p>
      ) : tasks.length === 0 ? (
        <p style={{ color: "#475569" }}>No tasks found. Try adjusting the filters.</p>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
            gap: "1rem",
          }}
        >
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              isOwn={!!user?.id && task.user_id === user.id}
              user={user}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function chip(active) {
  return {
    padding: "0.4rem 0.85rem",
    borderRadius: "999px",
    border: active ? "1.5px solid #1d4ed8" : "1px solid #d1d5db",
    background: active ? "#eff6ff" : "white",
    color: active ? "#1d4ed8" : "#374151",
    fontWeight: active ? 700 : 500,
    cursor: "pointer",
    fontSize: "0.85rem",
  };
}
