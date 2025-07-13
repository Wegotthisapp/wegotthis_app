import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import { categoryOptions } from "../lib/constants";

export default function Profile() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [websites, setWebsites] = useState([""]);
  const [categories, setCategories] = useState([]);
  const [tools, setTools] = useState([]);
  const [skillsGood, setSkillsGood] = useState([]);
  const [skillsMaybe, setSkillsMaybe] = useState([]);
  const [skillsConsidering, setSkillsConsidering] = useState([]);
  const [isProfessional, setIsProfessional] = useState(false);
  const [professionalField, setProfessionalField] = useState("");
  const [certificateUrl, setCertificateUrl] = useState("");

  const toolOptions = ["Hammer", "Drill", "Ladder", "Screwdriver", "Gloves", "Other"];

  useEffect(() => {
    const fetchProfile = async () => {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError("Not logged in");
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (error && error.code !== "PGRST116") {
        setError(error.message);
      } else if (data) {
        setName(data.name || "");
        setBio(data.bio || "");
        setWebsites(data.websites || [""]);
        setCategories(data.categories || []);
        setTools(data.tools || []);
        setSkillsGood(data.skills_good || []);
        setSkillsMaybe(data.skills_maybe || []);
        setSkillsConsidering(data.skills_considering || []);
        setIsProfessional(data.is_professional || false);
        setProfessionalField(data.professional_field || "");
        setCertificateUrl(data.certificate_url || "");
      }

      setLoading(false);
    };

    fetchProfile();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();

    const updates = {
      id: user.id,
      name,
      bio,
      websites,
      categories,
      tools,
      skills_good: skillsGood,
      skills_maybe: skillsMaybe,
      skills_considering: skillsConsidering,
      is_professional: isProfessional,
      professional_field: professionalField,
      certificate_url: certificateUrl
    };

    const { error } = await supabase
      .from("profiles")
      .upsert(updates, { onConflict: "id" });

    if (error) setError(error.message);
    else alert("✅ Profile saved!");

    setLoading(false);
  };

  const handleArrayChange = (setter, index, value) => {
    setter(prev => {
      const updated = [...prev];
      updated[index] = value;
      return updated;
    });
  };

  const handleAddWebsite = () => setWebsites([...websites, ""]);

  if (loading) return <p>Loading...</p>;
  if (error) return <p style={{ color: "red" }}>{error}</p>;

  const tagStyle = (bg, color = "#fff") => ({
    background: bg,
    color,
    padding: "0.25rem 0.5rem",
    borderRadius: "4px",
    cursor: "pointer"
  });

  const btnStyle = (color) => ({
    background: "#f8f9fa",
    border: `1px solid ${color}`,
    color,
    borderRadius: "4px",
    padding: "0.25rem 0.5rem",
    cursor: "pointer"
  });

  return (
    <div style={{ maxWidth: "600px", margin: "2rem auto" }}>
      <h2>My Profile</h2>
      <form onSubmit={handleSubmit}>
        <label>Name:</label>
        <input value={name} onChange={e => setName(e.target.value)} />

        <label>Bio:</label>
        <textarea value={bio} onChange={e => setBio(e.target.value)} />

        <label>Websites / Social Links:</label>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginBottom: "0.5rem" }}>
          {websites.map((site, idx) => (
            <input
              key={idx}
              value={site}
              onChange={e => handleArrayChange(setWebsites, idx, e.target.value)}
            />
          ))}
        </div>
        <button type="button" onClick={handleAddWebsite} style={{ marginBottom: "1rem" }}>
          + Add Website
        </button>

        <label>Categories:</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "0.5rem" }}>
          {categories.map(cat => (
            <span
              key={cat}
              style={tagStyle("#007BFF")}
              onClick={() => setCategories(categories.filter(c => c !== cat))}
            >
              {cat} ✖
            </span>
          ))}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
          {categoryOptions
            .filter(opt => !categories.includes(opt))
            .map(opt => (
              <button
                type="button"
                key={opt}
                onClick={() => setCategories([...categories, opt])}
                style={btnStyle("#007BFF")}
              >
                {opt}
              </button>
            ))}
        </div>

        <label style={{ marginTop: "1rem" }}>Tools:</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "0.5rem" }}>
          {tools.map(tool => (
            <span
              key={tool}
              style={tagStyle("#6f42c1")}
              onClick={() => setTools(tools.filter(t => t !== tool))}
            >
              {tool} ✖
            </span>
          ))}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
          {toolOptions
            .filter(opt => !tools.includes(opt))
            .map(opt => (
              <button
                type="button"
                key={opt}
                onClick={() => setTools([...tools, opt])}
                style={btnStyle("#6f42c1")}
              >
                {opt}
              </button>
            ))}
        </div>

        {/* Skills */}
        <label>Skills - Good at:</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "0.5rem" }}>
          {skillsGood.map(skill => (
            <span
              key={skill}
              style={tagStyle("#28a745")}
              onClick={() => setSkillsGood(skillsGood.filter(s => s !== skill))}
            >
              {skill} ✖
            </span>
          ))}
        </div>
        <input
          placeholder="Add skill & press Enter"
          onKeyDown={e => {
            if (e.key === 'Enter' && e.target.value.trim() !== "") {
              setSkillsGood([...skillsGood, e.target.value.trim()]);
              e.target.value = "";
            }
          }}
        />

        <label>Skills - Maybe:</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "0.5rem" }}>
          {skillsMaybe.map(skill => (
            <span
              key={skill}
              style={tagStyle("#ffc107", "#000")}
              onClick={() => setSkillsMaybe(skillsMaybe.filter(s => s !== skill))}
            >
              {skill} ✖
            </span>
          ))}
        </div>
        <input
          placeholder="Add skill & press Enter"
          onKeyDown={e => {
            if (e.key === 'Enter' && e.target.value.trim() !== "") {
              setSkillsMaybe([...skillsMaybe, e.target.value.trim()]);
              e.target.value = "";
            }
          }}
        />

        <label>Skills - Considering:</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "0.5rem" }}>
          {skillsConsidering.map(skill => (
            <span
              key={skill}
              style={tagStyle("#17a2b8")}
              onClick={() => setSkillsConsidering(skillsConsidering.filter(s => s !== skill))}
            >
              {skill} ✖
            </span>
          ))}
        </div>
        <input
          placeholder="Add skill & press Enter"
          onKeyDown={e => {
            if (e.key === 'Enter' && e.target.value.trim() !== "") {
              setSkillsConsidering([...skillsConsidering, e.target.value.trim()]);
              e.target.value = "";
            }
          }}
        />

        <label>
          <input
            type="checkbox"
            checked={isProfessional}
            onChange={e => setIsProfessional(e.target.checked)}
          />
          I am a professional
        </label>

        <label>Professional Field:</label>
        <input
          value={professionalField}
          onChange={e => setProfessionalField(e.target.value)}
        />

        <label>Certificate URL:</label>
        <input
          value={certificateUrl}
          onChange={e => setCertificateUrl(e.target.value)}
        />

        <button type="submit" disabled={loading} style={{ marginTop: "1rem" }}>
          {loading ? "Saving..." : "Save Profile"}
        </button>
      </form>

      <hr style={{ margin: "2rem 0" }} />

      <h3>⭐ Reviews</h3>

      <ReviewsSection />
    </div>
  );
}

function ReviewsSection() {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchReviews = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("reviews")
        .select("*, reviewer:reviewer_id(name)")
        .eq("reviewee_id", user.id)
        .order("created_at", { ascending: false });

      setReviews(data || []);
      setLoading(false);
    };

    fetchReviews();
  }, []);

  if (loading) return <p>Loading reviews...</p>;

  const average =
    reviews.length > 0
      ? (
          reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
        ).toFixed(1)
      : null;

  return (
    <div style={{ marginTop: "1rem" }}>
      {average ? (
        <p><strong>Average rating:</strong> {average} / 5 ⭐</p>
      ) : (
        <p>No reviews yet.</p>
      )}

      {reviews.map((r) => (
        <div
          key={r.id}
          style={{
            border: "1px solid #ddd",
            borderRadius: "8px",
            padding: "0.5rem",
            marginBottom: "0.5rem",
            background: "#f9f9f9",
          }}
        >
          <p style={{ margin: "0.25rem 0" }}>
            <strong>{r.reviewer?.name || "Anonymous"}</strong> — {r.rating} ⭐
          </p>
          <p style={{ margin: "0.25rem 0" }}>{r.comment}</p>
        </div>
      ))}
    </div>
  );
}
