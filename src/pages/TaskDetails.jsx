import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

export default function TaskDetails() {
  const { id } = useParams();
  const [task, setTask] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    (async () => {
      setErrorMsg("");
      setTask(null);

      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (error) {
        console.error("TaskDetails fetch error:", error);
        setErrorMsg(error.message);
        return;
      }

      if (!data) {
        setErrorMsg("Task not found (no row returned)");
        return;
      }

      setTask(data);
    })();
  }, [id]);

  if (errorMsg) return <div style={{ padding: 16 }}>Error: {errorMsg}</div>;
  if (!task) return <div style={{ padding: 16 }}>Loading…</div>;

  return (
    <div style={{ padding: 16 }}>
      <h2>{task.title}</h2>
      <p>{task.description}</p>
      <div>Status: {task.status}</div>
      <div>Category: {task.category}</div>
    </div>
  );
}
