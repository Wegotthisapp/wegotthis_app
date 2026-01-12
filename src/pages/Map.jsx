import { useState, useEffect } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMap,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { supabase } from "../lib/supabaseClient";

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

export default function MapPage() {
  const [userPosition, setUserPosition] = useState(null);
  const [geoError, setGeoError] = useState(null);

  const [tasks, setTasks] = useState([]);
  const [tasksError, setTasksError] = useState("");
  const [tasksLoading, setTasksLoading] = useState(true);

  // 1️⃣ Get user location
  useEffect(() => {
    if (!navigator.geolocation) {
      setGeoError("Geolocation is not supported by your browser.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setUserPosition([latitude, longitude]);
      },
      (err) => {
        console.error(err);
        setGeoError("Unable to get your location.");
      }
    );
  }, []);

  // 2️⃣ Fetch tasks from Supabase (with lat/lng)
  useEffect(() => {
    const fetchTasks = async () => {
      setTasksLoading(true);
      setTasksError("");

      const { data, error } = await supabase
        .from("tasks")
        .select(
          "id, user_id, title, description, category, price_min, price_max, currency, location_lat, location_lng, created_at, status"
        )
        .eq("status", "open")
        .not("location_lat", "is", null)
        .not("location_lng", "is", null);

      if (error) {
        setTasksError(error.message);
        setTasks([]);
      } else {
        setTasks(data || []);
      }

      setTasksLoading(false);
    };

    fetchTasks();
  }, []);

  // 3️⃣ Center map: user position if available, otherwise Milan (demo)
  const center = userPosition || [45.4642, 9.1900];

  return (
    <div className="container">
      <h2>Map</h2>

      {geoError && <p style={{ color: "red" }}>{geoError}</p>}
      {tasksError && <p style={{ color: "red" }}>Error loading tasks: {tasksError}</p>}

      <div style={{ height: "500px", width: "100%", marginTop: "1rem" }}>
        <MapContainer
          center={center}
          zoom={13}
          scrollWheelZoom={true}
          style={{ height: "100%", width: "100%" }}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />

          {/* User position marker */}
          {userPosition && (
            <>
              <Marker position={userPosition}>
                <Popup>Your Location</Popup>
              </Marker>
              <SetViewToUser position={userPosition} />
            </>
          )}

          {/* Task markers */}
          {tasks.map((task) => {
            const priceLabel = formatPrice(task.price_min, task.price_max, task.currency);
            return (
              <Marker
                key={task.id}
                position={[task.location_lat, task.location_lng]}
              >
                <Popup>
                  <strong>{task.title}</strong>
                  <br />
                  {task.category && <span>Category: {task.category}<br /></span>}
                  {priceLabel && <span>Price: {priceLabel}</span>}
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>
      </div>

      {!userPosition && !geoError && (
        <p style={{ marginTop: "1rem" }}>Fetching your location...</p>
      )}
      {tasksLoading && (
        <p style={{ marginTop: "0.5rem" }}>Loading tasks on the map...</p>
      )}
    </div>
  );
}
