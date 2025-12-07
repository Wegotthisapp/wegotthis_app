import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { categoryOptions, toolsOptions } from "../lib/constants";

// Simple formatter to show price range consistently
const formatSuggestedPrice = (min, max, currency) => {
  const cur = currency || "EUR";
  if (min && max) return `${min}–${max} ${cur}`;
  if (min) return `From ${min} ${cur}`;
  if (max) return `Up to ${max} ${cur}`;
  return "";
};

export default function AddTask() {
  const navigate = useNavigate();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [toolsNeeded, setToolsNeeded] = useState([]);
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [currency, setCurrency] = useState("EUR");
  const [distanceValue, setDistanceValue] = useState("");
  const [distanceUnit, setDistanceUnit] = useState("km");
  const [locationLat, setLocationLat] = useState("");
  const [locationLng, setLocationLng] = useState("");
  const [locationLabel, setLocationLabel] = useState("");
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState("");
  const [showManualCoords, setShowManualCoords] = useState(false);
  const [loading, setLoading] = useState(false);

  // ---------------------------------------
  // ✨ AI REAL: SUGGEST DESCRIPTION
  // ---------------------------------------
  const handleAiDescription = async () => {
    if (!title && !category) {
      setDescription(
        "This task requires general assistance. More details can be discussed with the helper."
      );
      return;
    }

    try {
      const response = await fetch("/api/generateDescription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, category }),
      });

      const data = await response.json();

      if (data.description) {
        setDescription(data.description);
        return;
      }

      // fallback se AI non restituisce nulla
      setDescription(
        `I need help with: ${title || "this task"}. We can discuss specifics such as what needs to be done, timing, and compensation.`
      );
    } catch (err) {
      console.error("AI description error", err);
      // fallback locale
      setDescription(
        `I'm looking for someone to help with ${title || "this task"}${
          category ? ` (${category})` : ""
        }. We can discuss details such as timing, tools, and compensation.`
      );
    }
  };

  // ---------------------------------------
  // ✨ AI REAL: SUGGEST PRICE
  // ---------------------------------------
  const handleAiPrice = async () => {
    if (!category && !title) {
      setPriceMin("30");
      setPriceMax("50");
      setCurrency("EUR");
      return;
    }

    try {
      const response = await fetch("/api/suggestPrice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          category,
          city: "Milan", // per ora fisso, in futuro useremo geolocalizzazione
        }),
      });

      const data = await response.json();

      if (data.price_min || data.price_max) {
        if (data.price_min) setPriceMin(String(data.price_min));
        if (data.price_max) setPriceMax(String(data.price_max));
        if (data.currency) setCurrency(data.currency);
        return;
      }

      // fallback se AI non restituisce nulla
      setPriceMin("30");
      setPriceMax("50");
      setCurrency("EUR");
    } catch (err) {
      console.error("AI price error", err);

      // fallback basato su categoria (come prima)
      let min = "30";
      let max = "50";
      if (category === "Cleaning") {
        min = "15";
        max = "25";
      } else if (category === "Gardening") {
        min = "25";
        max = "45";
      } else if (category === "Moving") {
        min = "40";
        max = "80";
      } else if (category === "Tutoring") {
        min = "20";
        max = "35";
      } else if (category === "Handyman") {
        min = "50";
        max = "100";
      }

      setPriceMin(min);
      setPriceMax(max);
      setCurrency("EUR");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const { data: userData } = await supabase.auth.getUser();
    const user = userData?.user;

    if (!user) {
      alert("You must be logged in to create a task.");
      setLoading(false);
      return;
    }

    const priceMinNumber = priceMin !== "" ? Number(priceMin) : null;
    const priceMaxNumber = priceMax !== "" ? Number(priceMax) : null;
    const distanceNumber = distanceValue !== "" ? Number(distanceValue) : null;
    const maxDistanceNumber =
      distanceNumber != null && !Number.isNaN(distanceNumber)
        ? Math.max(
            0,
            Math.round(
              distanceUnit === "m" ? distanceNumber / 1000 : distanceNumber
            )
          )
        : null;
    const locationLatNumber = locationLat !== "" ? Number(locationLat) : null;
    const locationLngNumber = locationLng !== "" ? Number(locationLng) : null;

    const task = {
      owner_id: user.id,
      title,
      description,
      category,
      tools_needed: toolsNeeded,
      price_min: priceMinNumber,
      price_max: priceMaxNumber,
      currency: "EUR",
      max_distance_km: maxDistanceNumber,
      location_lat: locationLatNumber,
      location_lng: locationLngNumber,
      status: "open",
      created_at: new Date().toISOString(),
    };

    const { error } = await supabase.from("tasks").insert([task]);

    setLoading(false);

    if (error) {
      alert("Error creating task: " + error.message);
    } else {
      alert("Task created!");
      // Clear form after successful submit
      setTitle("");
      setDescription("");
      setCategory("");
      setToolsNeeded([]);
      setPriceMin("");
      setPriceMax("");
      setCurrency("EUR");
      setMaxDistanceKm("");
      setLocationLat("");
      setLocationLng("");
      navigate("/tasks");
      setTitle("");
      setDescription("");
      setCategory("");
      setToolsNeeded([]);
      setPriceMin("");
      setPriceMax("");
      setCurrency("EUR");
      setDistanceValue("");
      setDistanceUnit("km");
      setLocationLat("");
      setLocationLng("");
      setLocationLabel("");
      setLocationError("");
      setShowManualCoords(false);
    }
  };

  const toggleTool = (tool) => {
    setToolsNeeded((prev) =>
      prev.includes(tool) ? prev.filter((t) => t !== tool) : [...prev, tool]
    );
  };

  return (
    <div style={containerStyle}>
      <h2 style={{ textAlign: "center", marginBottom: "1rem" }}>Add a New Task</h2>

      <form onSubmit={handleSubmit} style={formStyle}>
        {/* TITLE */}
        <input
          type="text"
          placeholder="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          style={inputStyle}
        />

        {/* DESCRIPTION + AI BUTTON */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <textarea
            placeholder="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            style={inputStyle}
          />
          <button type="button" onClick={handleAiDescription} style={aiButtonStyle}>
            ✨ Suggest Description
          </button>
        </div>

        {/* CATEGORY */}
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

        {/* TOOLS */}
        <div>
          <label>Tools (click to select):</label>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "0.5rem",
              marginTop: "0.5rem",
            }}
          >
            {toolsOptions.map((tool) => (
              <div
                key={tool}
                onClick={() => toggleTool(tool)}
                style={{
                  padding: "0.5rem 1rem",
                  borderRadius: "20px",
                  border: toolsNeeded.includes(tool)
                    ? "1px solid #007BFF"
                    : "1px solid #ccc",
                  background: toolsNeeded.includes(tool) ? "#007BFF" : "#f9f9f9",
                  color: toolsNeeded.includes(tool) ? "#fff" : "#000",
                  cursor: "pointer",
                }}
              >
                {tool}
              </div>
            ))}
          </div>
        </div>

        {/* PRICE RANGE + AI BUTTON */}
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <input
            type="number"
            min="0"
            step="0.5"
            placeholder="Min price"
            value={priceMin}
            onChange={(e) => setPriceMin(e.target.value)}
            style={{ ...inputStyle, flex: 1 }}
          />
          <input
            type="number"
            min="0"
            step="0.5"
            placeholder="Max price"
            value={priceMax}
            onChange={(e) => setPriceMax(e.target.value)}
            style={{ ...inputStyle, flex: 1 }}
          />
          <input
            type="text"
            placeholder="Currency"
            value={currency}
            readOnly
            style={{ ...inputStyle, width: "120px", backgroundColor: "#f8fafc" }}
          />
        </div>
        <button type="button" onClick={handleAiPrice} style={aiButtonStyle}>
          ✨ Suggest Price
        </button>
        {formatSuggestedPrice(priceMin, priceMax, currency) && (
          <p style={{ margin: 0, color: "#555" }}>
            Suggested: {formatSuggestedPrice(priceMin, priceMax, currency)}
          </p>
        )}

        {/* LOCATION */}
        <div style={sectionStyle}>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={async () => {
                if (!navigator.geolocation) {
                  setLocationError("Geolocation not supported on this device.");
                  return;
                }
                setLocating(true);
                setLocationError("");
                navigator.geolocation.getCurrentPosition(
                  (pos) => {
                    setLocating(false);
                    const { latitude, longitude } = pos.coords;
                    setLocationLat(latitude.toFixed(6));
                    setLocationLng(longitude.toFixed(6));
                    setShowManualCoords(false);
                  },
                  (err) => {
                    setLocating(false);
                    setLocationError(err.message || "Could not get location.");
                  }
                );
              }}
              style={primaryGhostButton}
              disabled={locating}
            >
              {locating ? "Getting location…" : "Use my current location"}
            </button>
            <button
              type="button"
              onClick={() => setShowManualCoords((prev) => !prev)}
              style={secondaryGhostButton}
            >
              {showManualCoords ? "Hide manual coordinates" : "Enter coords manually"}
            </button>
          </div>

          {locationError && (
            <p style={{ color: "#b91c1c", margin: "0.25rem 0 0 0" }}>{locationError}</p>
          )}
          {(locationLat && locationLng) && (
            <p style={{ margin: "0.35rem 0 0 0", color: "#0f172a" }}>
              Using coordinates: {locationLat}, {locationLng}
            </p>
          )}

          <label style={{ marginTop: "0.5rem", display: "block" }}>
            Location (city/area, optional):
            <input
              type="text"
              placeholder="e.g. Milan city center"
              value={locationLabel}
              onChange={(e) => setLocationLabel(e.target.value)}
              style={{ ...inputStyle, marginTop: "0.35rem" }}
            />
          </label>

          {showManualCoords && (
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginTop: "0.5rem" }}>
              <input
                type="number"
                step="0.000001"
                placeholder="Latitude"
                value={locationLat}
                onChange={(e) => setLocationLat(e.target.value)}
                style={{ ...inputStyle, flex: 1 }}
              />
              <input
                type="number"
                step="0.000001"
                placeholder="Longitude"
                value={locationLng}
                onChange={(e) => setLocationLng(e.target.value)}
                style={{ ...inputStyle, flex: 1 }}
              />
            </div>
          )}
        </div>

        {/* DISTANCE */}
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <input
            type="number"
            min="0"
            step="1"
            placeholder="Search radius"
            value={distanceValue}
            onChange={(e) => setDistanceValue(e.target.value)}
            style={{ ...inputStyle, flex: 1 }}
          />
          <select
            value={distanceUnit}
            onChange={(e) => setDistanceUnit(e.target.value)}
            style={{ ...inputStyle, width: "140px" }}
          >
            <option value="km">Kilometers</option>
            <option value="m">Meters</option>
          </select>
        </div>
        <p style={{ margin: "0", color: "#555", fontSize: "0.9rem" }}>
          We store this in km; meters will be converted and rounded.
        </p>

        {/* SUBMIT */}
        <button type="submit" disabled={loading} style={buttonStyle}>
          {loading ? "Creating..." : "Create Task"}
        </button>
      </form>
    </div>
  );
}

const containerStyle = {
  maxWidth: "600px",
  margin: "2rem auto",
  padding: "1rem",
};

const formStyle = {
  display: "flex",
  flexDirection: "column",
  gap: "0.75rem",
};

const inputStyle = {
  width: "100%",
  padding: "0.75rem",
  borderRadius: "8px",
  border: "1px solid #ddd",
  fontSize: "1rem",
};

const buttonStyle = {
  padding: "0.75rem",
  background: "#007BFF",
  color: "white",
  border: "none",
  borderRadius: "8px",
  cursor: "pointer",
};

const aiButtonStyle = {
  alignSelf: "flex-start",
  padding: "0.5rem 0.75rem",
  background: "#e2e8f0",
  color: "#0f172a",
  border: "1px solid #94a3b8",
  borderRadius: "8px",
  cursor: "pointer",
  fontSize: "0.95rem",
  fontWeight: 600,
};

const sectionStyle = {
  border: "1px solid #e2e8f0",
  borderRadius: "10px",
  padding: "0.75rem",
  backgroundColor: "#f8fafc",
  display: "flex",
  flexDirection: "column",
  gap: "0.35rem",
};

const primaryGhostButton = {
  padding: "0.6rem 0.9rem",
  borderRadius: "8px",
  border: "1px solid #1d4ed8",
  backgroundColor: "white",
  color: "#1d4ed8",
  cursor: "pointer",
  fontWeight: 600,
};

const secondaryGhostButton = {
  padding: "0.6rem 0.9rem",
  borderRadius: "8px",
  border: "1px solid #cbd5e1",
  backgroundColor: "white",
  color: "#0f172a",
  cursor: "pointer",
  fontWeight: 500,
};
