import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import TaskCard from "../components/TaskCard";

export default function Tasks() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [user, setUser] = useState(null);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      setError("");

      const { data: userData } = await supabase.auth.getUser();
      const user = userData?.user;
      setUser(user || null);

      const { data, error } = await supabase
        .from("tasks")
        .select(
          [
            "id",
            "user_id",
            "title",
            "description",
            "category",
            "status",
            "created_at",
            "price_min",
            "price_max",
            "currency",
            "barter",
            "is_negotiable",
            "max_distance_km",
            "location_text",
            "location_lat",
            "location_lng",
          ].join(", ")
        )
        .eq("status", "open")
        .order("created_at", { ascending: false });

      if (error) {
        setError(error.message);
        setTasks([]);
      } else {
        setTasks(data || []);
      }

      setLoading(false);
    };

    init();
  }, []);

  if (loading) return <div className="container">Loading tasks...</div>;

  if (error) {
    return (
      <div className="container">
        <h2>Tasks</h2>
        <p style={{ color: "red" }}>Error loading tasks: {error}</p>
      </div>
    );
  }

  return (
    <div className="container">
      <h2>Tasks</h2>
      {tasks.length === 0 ? (
        <p>No tasks found yet. Try creating one from “Add Task”.</p>
      ) : (
        tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            isOwn={user?.id && task.user_id === user.id}
            user={user}
          />
        ))
      )}
    </div>
  );
}
