// src/pages/HelperSetup.jsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

// Opzioni base – poi possiamo affinarle
const HELPER_CATEGORIES = [
  "Cleaning",
  "Moving",
  "Gardening",
  "Tutoring",
  "Pet care",
  "Handyman",
  "IT help",
  "Cooking / Meal prep",
];

const TOOL_OPTIONS = [
  "Car",
  "Bike",
  "Drill",
  "Ladder",
  "Basic toolbox",
  "Professional tools",
];

const AVAILABILITY_FIELDS = [
  { key: "mornings", label: "Mornings" },
  { key: "weekdays_evenings", label: "Weekdays evenings" },
  { key: "weekends", label: "Weekends" },
];

export default function HelperSetup() {
  const navigate = useNavigate();

  const [userId, setUserId] = useState(null);

  const [categories, setCategories] = useState([]);
  const [tools, setTools] = useState([]);
  const [customTool, setCustomTool] = useState("");
  const [maxRadiusKm, setMaxRadiusKm] = useState(5);
  const [availability, setAvailability] = useState({
    mornings: false,
    weekdays_evenings: false,
    weekends: false,
  });
  const [isProfessional, setIsProfessional] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // 1️⃣ Recuperiamo l'utente loggato
  useEffect(() => {
    const loadUser = async () => {
      const { data } = await supabase.auth.getUser();
      const user = data?.user;
      if (!user) {
        navigate("/login");
        return;
      }
      setUserId(user.id);

      // Proviamo a caricare eventuali dati già salvati nel profilo
      const { data: profile, error } = await supabase
        .from("profiles")
        .select(
          "helper_categories, helper_tools, max_radius_km, availability, is_professional"
        )
        .eq("id", user.id)
        .maybeSingle();

      if (!error && profile) {
        setCategories(profile.helper_categories || []);
        setTools(profile.helper_tools || []);
        if (profile.max_radius_km != null) {
          setMaxRadiusKm(profile.max_radius_km);
        }
        if (profile.availability) {
          setAvailability({
            ...availability,
            ...profile.availability,
          });
        }
        if (profile.is_professional != null) {
          setIsProfessional(profile.is_professional);
        }
      }

      setLoading(false);
    };

    loadUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleCategory = (cat) => {
    setCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  };

  const toggleTool = (tool) => {
    setTools((prev) =>
      prev.includes(tool) ? prev.filter((t) => t !== tool) : [...prev, tool]
    );
  };

  const handleAvailabilityChange = (key) => {
    setAvailability((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleAddCustomTool = () => {
    const trimmed = customTool.trim();
    if (!trimmed) return;
    if (!tools.includes(trimmed)) {
      setTools((prev) => [...prev, trimmed]);
    }
    setCustomTool("");
  };

  const handleSave = async () => {
    if (!userId) return;

    setSaving(true);
    setErrorMsg("");

    const payload = {
      categories,
      helper_tools: tools,
      helper_categories: categories,
      max_radius_km: maxRadiusKm,
      availability,
      is_professional: isProfessional,
    };

    const { error } = await supabase
      .from("profiles")
      .update(payload)
      .eq("id", userId);

    if (error) {
      console.error(error);
      setErrorMsg("Could not save your helper profile. Please try again.");
      setSaving(false);
      return;
    }

    setSaving(false);
    // Dopo il setup, portiamo l'utente alla Home o ad Add Task
    navigate("/");
  };

  if (loading) {
    return (
      <div style={styles.page}>
        <p>Loading your helper settings…</p>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <h1 style={styles.title}>In cosa puoi aiutare gli altri?</h1>
        <p style={styles.subtitle}>
          Queste info aiutano gli altri a capire quando e come puoi dare una mano.
          Puoi cambiarle in qualsiasi momento dal tuo profilo.
        </p>

        {errorMsg && <p style={styles.error}>{errorMsg}</p>}

        {/* Categorie */}
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Categorie in cui puoi aiutare</h2>
          <div style={styles.chipContainer}>
            {HELPER_CATEGORIES.map((cat) => {
              const selected = categories.includes(cat);
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => toggleCategory(cat)}
                  style={{
                    ...styles.chip,
                    ...(selected ? styles.chipSelected : {}),
                  }}
                >
                  {cat}
                </button>
              );
            })}
          </div>
        </section>

        {/* Tools */}
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Tools che possiedi</h2>
          <div style={styles.chipContainer}>
            {TOOL_OPTIONS.map((tool) => {
              const selected = tools.includes(tool);
              return (
                <button
                  key={tool}
                  type="button"
                  onClick={() => toggleTool(tool)}
                  style={{
                    ...styles.chip,
                    ...(selected ? styles.chipSelected : {}),
                  }}
                >
                  {tool}
                </button>
              );
            })}
          </div>

          <div style={styles.customToolRow}>
            <input
              type="text"
              placeholder="Altro tool (es. idraulica, attrezzi speciali)"
              value={customTool}
              onChange={(e) => setCustomTool(e.target.value)}
              style={styles.input}
            />
            <button
              type="button"
              onClick={handleAddCustomTool}
              style={styles.addToolBtn}
            >
              +
            </button>
          </div>
        </section>

        {/* Distanza massima */}
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>
            Fino a che distanza puoi spostarti?
          </h2>
          <p style={styles.helperText}>
            Ad esempio, senza macchina puoi tenerti vicino casa; con la macchina
            puoi accettare task più lontani.
          </p>
          <div style={styles.rangeRow}>
            <input
              type="range"
              min={1}
              max={40}
              step={1}
              value={maxRadiusKm}
              onChange={(e) => setMaxRadiusKm(Number(e.target.value))}
              style={styles.range}
            />
            <span style={styles.rangeLabel}>{maxRadiusKm} km</span>
          </div>
        </section>

        {/* Disponibilità */}
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Quando sei generalmente disponibile?</h2>
          <div style={styles.checkboxContainer}>
            {AVAILABILITY_FIELDS.map((field) => (
              <label key={field.key} style={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={availability[field.key]}
                  onChange={() => handleAvailabilityChange(field.key)}
                />
                <span>{field.label}</span>
              </label>
            ))}
          </div>
        </section>

        {/* Professional toggle */}
        <section style={styles.section}>
          <label style={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={isProfessional}
              onChange={(e) => setIsProfessional(e.target.checked)}
            />
            <span>Sei un professionista (puoi mostrare certificazioni)?</span>
          </label>
        </section>

        <div style={styles.actions}>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            style={styles.saveBtn}
          >
            {saving ? "Saving…" : "Save and continue"}
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: {
    maxWidth: "900px",
    margin: "0 auto",
    padding: "1.5rem 1rem 2.5rem",
    fontFamily: "'Poppins', sans-serif",
  },
  card: {
    background: "linear-gradient(135deg, #1d4ed8, #6a11cb)",
    borderRadius: "16px",
    padding: "1px",
  },
  inner: {
    backgroundColor: "#fff",
    borderRadius: "15px",
    padding: "1.5rem",
  },
  title: {
    color: "#fff",
    margin: "1.2rem 1.5rem 0.5rem",
    fontSize: "1.6rem",
  },
  subtitle: {
    color: "#e0e7ff",
    margin: "0 1.5rem 1.5rem",
    fontSize: "0.95rem",
    maxWidth: "600px",
  },
  error: {
    color: "#ffdddd",
    backgroundColor: "#660000",
    padding: "0.5rem 1rem",
    borderRadius: "8px",
    margin: "0 1.5rem 1rem",
    fontSize: "0.85rem",
  },
  section: {
    backgroundColor: "#fff",
    margin: "0 1.5rem 1rem",
    padding: "1rem 1.1rem",
    borderRadius: "12px",
  },
  sectionTitle: {
    margin: "0 0 0.5rem 0",
    fontSize: "1rem",
  },
  chipContainer: {
    display: "flex",
    flexWrap: "wrap",
    gap: "0.5rem",
  },
  chip: {
    borderRadius: "999px",
    border: "1px solid #d0d7ff",
    padding: "0.35rem 0.9rem",
    fontSize: "0.85rem",
    backgroundColor: "#f5f7ff",
    cursor: "pointer",
  },
  chipSelected: {
    backgroundColor: "#1d4ed8",
    color: "#fff",
    borderColor: "#1d4ed8",
  },
  customToolRow: {
    marginTop: "0.75rem",
    display: "flex",
    gap: "0.5rem",
  },
  input: {
    flex: 1,
    padding: "0.4rem 0.6rem",
    borderRadius: "8px",
    border: "1px solid #d0d7ff",
    fontSize: "0.9rem",
  },
  addToolBtn: {
    width: "2.2rem",
    borderRadius: "999px",
    border: "none",
    backgroundColor: "#1d4ed8",
    color: "#fff",
    fontSize: "1.1rem",
    cursor: "pointer",
  },
  helperText: {
    fontSize: "0.85rem",
    color: "#555",
    marginBottom: "0.4rem",
  },
  rangeRow: {
    display: "flex",
    alignItems: "center",
    gap: "0.75rem",
  },
  range: {
    flex: 1,
  },
  rangeLabel: {
    minWidth: "60px",
    textAlign: "right",
    fontSize: "0.9rem",
    fontWeight: 500,
  },
  checkboxContainer: {
    display: "flex",
    flexDirection: "column",
    gap: "0.4rem",
  },
  checkboxLabel: {
    display: "flex",
    alignItems: "center",
    gap: "0.4rem",
    fontSize: "0.9rem",
  },
  actions: {
    margin: "1rem 1.5rem 1.5rem",
    display: "flex",
    justifyContent: "flex-end",
  },
  saveBtn: {
    border: "none",
    borderRadius: "999px",
    padding: "0.6rem 1.4rem",
    backgroundColor: "#fff",
    color: "#1d4ed8",
    fontWeight: 600,
    cursor: "pointer",
    boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
  },
};
