import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

export default function PublicProfile() {
  const { userId } = useParams(); // MUST match the route
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    async function loadProfile() {
      if (!userId) return;

      setLoading(true);
      setError("");

      const { data, error } = await supabase
        .from("public_profiles")
        .select(
          `
          id,
          full_name,
          avatar_url,
          bio,
          helper_categories,
          helper_tools
        `
        )
        .eq("id", userId)
        .maybeSingle();

      if (error) {
        setError(error.message);
        setProfile(null);
      } else if (!data) {
        setError("Profile not found.");
        setProfile(null);
      } else {
        setProfile(data);
      }

      setLoading(false);
    }

    loadProfile();
  }, [userId]);

  if (loading) return <div style={{ padding: 20 }}>Loading profile…</div>;

  if (error) {
    return (
      <div style={{ padding: 20 }}>
        <h2>Public Profile</h2>
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div style={{ padding: 20, maxWidth: 800, margin: "0 auto" }}>
      <h2>{profile.full_name || "User"}</h2>

      {profile.avatar_url && (
        <img
          src={profile.avatar_url}
          alt="Avatar"
          style={{
            width: 96,
            height: 96,
            borderRadius: "50%",
            objectFit: "cover",
            marginBottom: 12,
          }}
        />
      )}

      {profile.bio && <p>{profile.bio}</p>}

      <div style={{ marginTop: 12 }}>
        <strong>Can help with:</strong>{" "}
        {profile.helper_categories?.length
          ? profile.helper_categories.join(", ")
          : "—"}
      </div>

      <div style={{ marginTop: 12 }}>
        <strong>Tools:</strong>{" "}
        {profile.helper_tools?.length ? profile.helper_tools.join(", ") : "—"}
      </div>
    </div>
  );
}
