import { Link, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function Navbar() {
  const [user, setUser] = useState(null);
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

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    navigate("/");
  };

  return (
    <nav className="navbar">
      <div className="navbar-left">
        <Link to="/">WeGotThis</Link>
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
            <Link to="/chat">Chat</Link>
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
