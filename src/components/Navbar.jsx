import { Link, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function Navbar() {
  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    // check if user is logged in
    const getUser = async () => {
      const { data, error } = await supabase.auth.getUser();
      if (data?.user) {
        setUser(data.user);
      } else {
        setUser(null);
      }
    };

    getUser();

    // subscribe to auth changes
    const { data: listener } = supabase.auth.onAuthStateChange(() => {
      getUser();
    });

    // cleanup
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
        <Link to="/">Home</Link>
        <Link to="/map">Map</Link>
        <Link to="/add-task">Add Task</Link>
        <Link to="/profile">Profile</Link>
        <Link to="/social">Social</Link>
        <Link to="/courses">Courses</Link>
        <Link to="/chat">Chat</Link>

        {!user ? (
          <Link to="/signup" className="login-btn">
            Login / Register
          </Link>
        ) : (
          <button onClick={handleLogout} className="login-btn">
            Logout
          </button>
        )}
      </div>
    </nav>
  );
}
