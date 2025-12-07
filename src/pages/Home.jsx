import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import { categoryOptions } from "../lib/constants";
import CategoryRow from "../components/CategoryRow";

import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMap,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";

const formatPrice = (min, max, currency = "EUR") => {
  if (min == null && max == null) return null;
  const cur = currency || "EUR";
  if (min != null && max != null) return `${min}-${max} ${cur}`;
  if (min != null) return `From ${min} ${cur}`;
  return `Up to ${max} ${cur}`;
};

function SetViewToUser({ position }) {
  const map = useMap();
  useEffect(() => {
    if (position) {
      map.setView(position, 13);
    }
  }, [position, map]);
  return null;
}

export default function Home() {
  const [tasks, setTasks] = useState([]);
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [tasksError, setTasksError] = useState("");

  const [userId, setUserId] = useState(null);

  const [userPosition, setUserPosition] = useState(null);
  const [geoError, setGeoError] = useState(null);

  // 1️⃣ Geolocalizzazione utente
  useEffect(() => {
    if (!navigator.geolocation) {
      setGeoError("Geolocation is not supported by your browser.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserPosition([pos.coords.latitude, pos.coords.longitude]);
      },
      () => {
        setGeoError("Unable to fetch your location. Using Milan as fallback.");
        setUserPosition([45.4642, 9.19]); // fallback Milano
      }
    );
  }, []);

  // 2️⃣ Utente + tasks da Supabase
  useEffect(() => {
    const init = async () => {
      setLoadingTasks(true);
      setTasksError("");

      // utente loggato
      const { data: userData } = await supabase.auth.getUser();
      const user = userData?.user;
      setUserId(user?.id || null);

      // tasks
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        setTasksError(error.message);
        setTasks([]);
      } else {
        setTasks(data || []);
      }

      setLoadingTasks(false);
    };

    init();
  }, []);

  const center = userPosition || [45.4642, 9.19]; // Milano se non abbiamo ancora la posizione

  // 3️⃣ Raggruppiamo i task per categoria (per le righe stile Netflix)
  const groupedByCategory = tasks.reduce((acc, task) => {
    const cat = task.category || "Other";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(task);
    return acc;
  }, {});

  // Ordine categorie: prima quelle definite in categoryOptions, poi le altre
  const definedOrder = (categoryOptions || []).map((c) => c.value);
  const allCategories = Object.keys(groupedByCategory);

  const sortedCategories = allCategories.sort((a, b) => {
    const indexA = definedOrder.indexOf(a);
    const indexB = definedOrder.indexOf(b);

    if (indexA === -1 && indexB === -1) {
      return a.localeCompare(b);
    }
    if (indexA === -1) return 1;
    if (indexB === -1) return -1;
    return indexA - indexB;
  });

  return (
    <div style={styles.container}>
      {/* 🌟 Hero Section */}
     <section style={styles.hero}>
  <div style={styles.heroOverlay} />

  <h1 style={styles.heroTitle}>WeGotThis</h1>

  {/* Testo diverso se loggata / non loggata */}
  {!userId ? (
    <>
      <p style={styles.heroSubtitle}>
        Benvenuto su WeGotThis.
      </p>
      <p style={styles.heroSubtitle}>
        Qui puoi chiedere aiuto quando ne hai bisogno,
      </p>
      <p style={styles.heroSubtitle}>
        e offrirlo quando hai tempo o competenze.
      </p>
    </>
  ) : (
    <p style={styles.heroSubtitle}>
      Welcome back to your local help hub. Create or answer tasks in your area.
    </p>
  )}

  {/* CTA diversa se loggata / non loggata */}
  {!userId ? (
    <a href="/signup" style={styles.ctaLink}>
      <button style={styles.ctaButton}>Create Your First Task</button>
    </a>
  ) : (
    <a href="/add-task" style={styles.ctaLink}>
      <button style={styles.ctaButton}>Create a New Task</button>
    </a>
  )}
</section>


      {/* Errori */}
      {geoError && <p style={styles.error}>{geoError}</p>}
      {tasksError && (
        <p style={styles.error}>Error loading tasks: {tasksError}</p>
      )}

      {/* 🎬 Righe per categoria – stile Netflix */}
      <section style={{ marginTop: "2rem" }}>
        {loadingTasks ? (
          <p>Loading tasks…</p>
        ) : sortedCategories.length === 0 ? (
          <p>No tasks yet. Be the first one to create a task!</p>
        ) : (
          sortedCategories.map((category) => (
            <CategoryRow
              key={category}
              title={category}
              tasks={groupedByCategory[category]}
              userId={userId}
            />
          ))
        )}
      </section>

      {/* 🗺 Map – stessa logica di MapPage */}
      <h2 style={styles.mapTitle}>Map of tasks</h2>
      <div style={styles.mapWrapper}>
        <MapContainer center={center} zoom={13} style={styles.map}>
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />

          {/* Posizione utente */}
          {userPosition && (
            <>
              <Marker position={userPosition}>
                <Popup>You are here</Popup>
              </Marker>
              <SetViewToUser position={userPosition} />
            </>
          )}

          {/* Task markers */}
          {tasks
            .filter((task) => task.location_lat && task.location_lng)
            .map((task) => {
              const priceLabel = formatPrice(
                task.price_min,
                task.price_max,
                task.currency
              );
              return (
                <Marker
                  key={task.id}
                  position={[task.location_lat, task.location_lng]}
                >
                  <Popup>
                    <strong>{task.title}</strong>
                    <br />
                    {task.category && (
                      <>
                        <span>Category: {task.category}</span>
                        <br />
                      </>
                    )}
                    {priceLabel && <span>Price: {priceLabel}</span>}
                  </Popup>
                </Marker>
              );
            })}
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
    fontFamily: "'Poppins', sans-serif",
  },
  hero: {
    position: "relative",
    textAlign: "center",
    padding: "4rem 1rem",
    borderRadius: "12px",
    marginBottom: "2rem",
    color: "#fff",
    overflow: "hidden",
    background: "linear-gradient(135deg, #6a11cb, #2575fc)",
  },
  heroOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: "80px",
    background:
      "url('https://www.svgrepo.com/show/31146/wave.svg') bottom / cover no-repeat",
  },
  heroTitle: {
    fontSize: "3rem",
    marginBottom: "0.5rem",
    zIndex: 2,
    position: "relative",
  },
  heroSubtitle: {
    fontSize: "1.2rem",
    maxWidth: "700px",
    margin: "0 auto",
    zIndex: 2,
    position: "relative",
  },
  ctaLink: {
    textDecoration: "none",
    zIndex: 2,
    position: "relative",
    display: "inline-block",
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
    boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
    transition: "transform 0.2s, box-shadow 0.2s",
  },
  error: {
    color: "red",
    textAlign: "center",
  },
  mapTitle: {
    textAlign: "center",
    marginTop: "2.5rem",
    fontSize: "1.8rem",
  },
  mapWrapper: {
    height: "400px",
    width: "100%",
    borderRadius: "8px",
    overflow: "hidden",
    marginTop: "1rem",
    marginBottom: "2rem",
  },
  map: {
    height: "100%",
    width: "100%",
  },
};
