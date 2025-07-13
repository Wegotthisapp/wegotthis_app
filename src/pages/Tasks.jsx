import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import TaskCard from "../components/TaskCard";

export default function Tasks() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTasks = async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .order("created_at", { ascending: false });

      if (!error) {
        setTasks(data);
      }

      setLoading(false);
    };

    fetchTasks();
  }, []);

  if (loading) return <div className="container">Loading tasks...</div>;

  return (
    <div className="container">
      <h2>Tasks</h2>
      {tasks.length === 0 ? <p>No tasks found.</p> : tasks.map((task) => <TaskCard key={task.id} task={task} />)}
    </div>
  );
}
