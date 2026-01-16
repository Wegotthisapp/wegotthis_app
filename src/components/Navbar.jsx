import { Link, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { BRAND } from "../config/brand";

export default function Navbar() {
  const [user, setUser] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    const getUser = async () => {
      const { data, error } = await supabase.auth.getUser();
      if (data?.user) {
        setUser(data.user);
      } else {
        setUser(null);
      }
    };

    getUser();

    const { data: listener } = supabase.auth.onAuthStateChange(() => {
      getUser();
    });

    return () => {
      listener?.subscription?.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!user?.id) {
      setUnreadCount(0);
      return;
    }

    let channel;

    const fetchUnread = async () => {
      const { data: convoRows, error: convoError } = await supabase
        .from("conversations")
        .select("id")
        .or(`user_a.eq.${user.id},user_b.eq.${user.id}`);

      if (convoError) return;

      const ids = (convoRows || []).map((row) => row.id);
      if (ids.length === 0) {
        setUnreadCount(0);
        return;
      }

      const { count, error } = await supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .in("conversation_id", ids)
        .is("read_at", null)
        .neq("sender_id", user.id);

      if (!error && typeof count === "number") {
        setUnreadCount(count);
      }
    };

    fetchUnread();

    channel = supabase
      .channel(`messages:unread:${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        () => {
          fetchUnread();
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "messages" },
        () => {
          fetchUnread();
        }
      )
      .subscribe();

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [user?.id]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    navigate("/");
  };

  return (
    <nav className="navbar">
      <div className="navbar-left">
        <Link to="/">
          <h1>{BRAND.name}</h1>
          <p>{BRAND.tagline}</p>
        </Link>
      </div>

      <div className="navbar-right">
        {/* Always visible */}
        <Link to="/">Home</Link>
        <Link to="/map">Map</Link>

        {/* Visible ONLY when logged in */}
        {user && (
          <>
            <Link to="/add-task">Add Task</Link>
            <Link to="/profile">Profile</Link>
            {/* <Link to="/social">Social</Link>   👈 HIDDEN */}
            {/* <Link to="/courses">Courses</Link> 👈 HIDDEN */}
            <Link to="/chat" style={{ position: "relative" }}>
              Chat
              {unreadCount > 0 && (
                <span
                  style={{
                    position: "absolute",
                    top: "-6px",
                    right: "-12px",
                    background: "#7c3aed",
                    color: "#fff",
                    borderRadius: "999px",
                    padding: "0.1rem 0.4rem",
                    fontSize: "0.7rem",
                    fontWeight: 600,
                  }}
                >
                  {unreadCount}
                </span>
              )}
            </Link>
          </>
        )}

        {/* Auth buttons */}
        {!user ? (
          <div className="auth-buttons">
            <Link to="/login" className="login-btn">
              Login
            </Link>
            <Link to="/signup" className="login-btn">
              Register
            </Link>
          </div>
        ) : (
          <button onClick={handleLogout} className="login-btn">
            Logout
          </button>
        )}
      </div>
    </nav>
  );
}
