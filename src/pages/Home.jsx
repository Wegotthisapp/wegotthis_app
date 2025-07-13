import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import { categoryOptions } from "../lib/constants";
import CategoryRow from "../components/CategoryRow";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";

export default function Home() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userPosition, setUserPosition] = useState([51.505, -0.09]);
  const [error, setError] = useState(null);

  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserPosition([pos.coords.latitude, pos.coords.longitude]);
      },
      () => {
        setError("⚠️ Unable to fetch your location. Using fallback (London).");
      }
    );
  }, []);

  useEffect(() => {
    const fetchTasks = async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .order("created_at", { ascending: false });

      if (!error) setTasks(data || []);
      setLoading(false);
    };

    fetchTasks();
  }, []);

  return (
    <div style={styles.container}>
      {/* 🌟 Hero Section */}
      <section style={styles.hero}>
        <div style={styles.heroOverlay} />
        <h1 style={styles.heroTitle}>WeGotThis</h1>
        <p style={styles.heroSubtitle}>
          Your local help platform. Find and offer help in your community —
          moving, tutoring, gardening, and more.
        </p>
        <a href="/add-task" style={styles.ctaLink}>
          <button style={styles.ctaButton}>Create Your First Task</button>
        </a>
      </section>

      {error && <p style={styles.error}>{error}</p>}

      {loading ? (
        <p style={{ textAlign: "center" }}>Loading tasks…</p>
      ) : (
        categoryOptions.map((category) => {
          const categoryTasks = tasks.filter(t => t.category === category);
          return (
            <CategoryRow
              key={category}
              title={category}
              tasks={categoryTasks}
            />
          );
        })
      )}

      {/* Map */}
      <h2 style={styles.mapTitle}>Map of Tasks</h2>
      <div style={styles.mapWrapper}>
        <MapContainer
          center={userPosition}
          zoom={13}
          style={styles.map}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />

          <Marker position={userPosition}>
            <Popup>You are here</Popup>
          </Marker>

          {tasks.map(
            (task) =>
              task.lat &&
              task.lng && (
                <Marker key={task.id} position={[task.lat, task.lng]}>
                  <Popup>
                    <strong>{task.title}</strong><br />{task.description}
                  </Popup>
                </Marker>
              )
          )}
        </MapContainer>
      </div>
    </div>
  );
}

const styles = {
  container: {
    maxWidth: "1200px",
    margin: "0 auto",
    padding: "1rem",
    fontFamily: "'Poppins', sans-serif"
  },
  hero: {
    position: "relative",
    textAlign: "center",
    padding: "4rem 1rem",
    borderRadius: "12px",
    marginBottom: "2rem",
    color: "#fff",
    overflow: "hidden",
    background: "linear-gradient(135deg, #6a11cb, #2575fc)"
  },
  heroOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: "80px",
    background: "url('https://www.svgrepo.com/show/31146/wave.svg') bottom / cover no-repeat"
  },
  heroTitle: {
    fontSize: "3rem",
    marginBottom: "0.5rem",
    zIndex: 2
  },
  heroSubtitle: {
    fontSize: "1.2rem",
    maxWidth: "700px",
    margin: "0 auto",
    zIndex: 2
  },
  ctaLink: {
    textDecoration: "none",
    zIndex: 2
  },
  ctaButton: {
    marginTop: "1.5rem",
    padding: "0.75rem 2rem",
    fontSize: "1rem",
    border: "none",
    borderRadius: "25px",
    background: "#fff",
    color: "#2575fc",
    cursor: "pointer",
    fontWeight: "bold",
    boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
    transition: "transform 0.2s",
  },
  error: {
    color: "red",
    textAlign: "center",
  },
  mapTitle: {
    textAlign: "center",
    marginTop: "2rem",
    fontSize: "1.8rem",
  },
  mapWrapper: {
    height: "400px",
    width: "100%",
    borderRadius: "8px",
    overflow: "hidden",
    marginTop: "1rem",
  },
  map: {
    height: "100%",
    width: "100%",
  },
};
