import { BrowserRouter, Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar";
import Home from "./pages/Home";
import AddTask from "./pages/AddTask";
import Profile from "./pages/Profile";
import Social from "./pages/Social";
import Courses from "./pages/Courses";
import Chat from "./pages/Chat";
import Signup from "./pages/Signup";
import Tasks from "./pages/Tasks";
import MapPage from "./pages/Map";

export default function App() {
  return (
    <BrowserRouter>
      <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/tasks" element={<Tasks />} />
        <Route path="/add-task" element={<AddTask />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/social" element={<Social />} />
        <Route path="/courses" element={<Courses />} />
        <Route path="/chat/:taskId/:receiverId" element={<Chat />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/map" element={<MapPage />} />
      </Routes>
    </BrowserRouter>
  );
}
