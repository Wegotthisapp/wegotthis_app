import { useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { categoryOptions, toolsOptions } from "../lib/constants";

export default function AddTask() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [tools, setTools] = useState([]);
  const [priceRange, setPriceRange] = useState("");
  const [distance, setDistance] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase.from("tasks").insert([
      {
        title,
        description,
        category,
        tools,
        price_range: priceRange,
        distance_km: distance,
        lat: 51.505, // Replace with real location
        lng: -0.09,
      },
    ]);

    setLoading(false);

    if (error) {
      alert("Error creating task: " + error.message);
    } else {
      alert("Task created!");
      setTitle("");
      setDescription("");
      setCategory("");
      setTools([]);
      setPriceRange("");
      setDistance("");
    }
  };

  const toggleTool = (tool) => {
    setTools((prev) =>
      prev.includes(tool) ? prev.filter((t) => t !== tool) : [...prev, tool]
    );
  };

  return (
    <div style={containerStyle}>
      <h2 style={{ textAlign: "center", marginBottom: "1rem" }}>Add a New Task</h2>

      <form onSubmit={handleSubmit} style={formStyle}>
        <input
          type="text"
          placeholder="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          style={inputStyle}
        />

        <textarea
          placeholder="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          style={inputStyle}
        />

        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          required
          style={inputStyle}
        >
          <option value="">-- Select Category --</option>
          {categoryOptions.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>

        <div>
          <label>Tools (click to select):</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
            {toolsOptions.map((tool) => (
              <div
                key={tool}
                onClick={() => toggleTool(tool)}
                style={{
                  padding: "0.5rem 1rem",
                  borderRadius: "20px",
                  border: tools.includes(tool) ? "1px solid #007BFF" : "1px solid #ccc",
                  background: tools.includes(tool) ? "#007BFF" : "#f9f9f9",
                  color: tools.includes(tool) ? "#fff" : "#000",
                  cursor: "pointer",
                }}
              >
                {tool}
              </div>
            ))}
          </div>
        </div>

        <input
          type="text"
          placeholder="Price Range"
          value={priceRange}
          onChange={(e) => setPriceRange(e.target.value)}
          style={inputStyle}
        />

        <input
          type="number"
          placeholder="Distance (km)"
          value={distance}
          onChange={(e) => setDistance(e.target.value)}
          style={inputStyle}
        />

        <button
          type="submit"
          disabled={loading}
          style={buttonStyle}
        >
          {loading ? "Creating..." : "Create Task"}
        </button>
      </form>
    </div>
  );
}

const containerStyle = {
  maxWidth: "600px",
  margin: "2rem auto",
  padding: "2rem",
  background: "#fff",
  borderRadius: "12px",
  boxShadow: "0 0 20px rgba(0,0,0,0.1)",
};

const formStyle = {
  display: "flex",
  flexDirection: "column",
  gap: "1rem",
};

const inputStyle = {
  padding: "0.5rem",
  fontSize: "1rem",
  borderRadius: "6px",
  border: "1px solid #ccc",
};

const buttonStyle = {
  background: "#007BFF",
  color: "#fff",
  padding: "0.75rem",
  border: "none",
  borderRadius: "6px",
  cursor: "pointer",
  fontSize: "1rem",
};
