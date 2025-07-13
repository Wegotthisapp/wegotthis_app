import { useState, useEffect } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMap,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";

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
  const [error, setError] = useState(null);

  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setUserPosition([latitude, longitude]);
      },
      (err) => {
        console.error(err);
        setError("Unable to get your location.");
      }
    );
  }, []);

  return (
    <div className="container">
      <h2>Map</h2>
      {error && <p style={{ color: "red" }}>{error}</p>}
      <div style={{ height: "500px", width: "100%", marginTop: "1rem" }}>
        <MapContainer
          center={userPosition || [51.505, -0.09]} // fallback to London
          zoom={13}
          scrollWheelZoom={true}
          style={{ height: "100%", width: "100%" }}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />
          {userPosition && (
            <>
              <Marker position={userPosition}>
                <Popup>Your Location</Popup>
              </Marker>
              <SetViewToUser position={userPosition} />
            </>
          )}
        </MapContainer>
      </div>
      {!userPosition && !error && (
        <p style={{ marginTop: "1rem" }}>Fetching your location...</p>
      )}
    </div>
  );
}
