import { BrowserRouter, Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar";

// PAGINE
import Home from "./pages/Home";
import Tasks from "./pages/Tasks";
import AddTask from "./pages/AddTask";
import Profile from "./pages/Profile";
import Social from "./pages/Social";
import Courses from "./pages/Courses";
import Chat from "./pages/Chat";
import Signup from "./pages/Signup";
import Login from "./pages/Login";
import MapPage from "./pages/Map";
import TaskDetails from "./pages/TaskDetails"; // 👈 NUOVA PAGINA DETTAGLIO

export default function App() {
  return (
    <BrowserRouter>
      <Navbar />
      <Routes>
        {/* Home */}
        <Route path="/" element={<Home />} />

        {/* Tasks */}
        <Route path="/tasks" element={<Tasks />} />
        <Route path="/add-task" element={<AddTask />} />

        {/* Profilo & social */}
        <Route path="/profile" element={<Profile />} />
        <Route path="/social" element={<Social />} />
        <Route path="/courses" element={<Courses />} />

        {/* Chat per task specifico */}
        <Route path="/chat/:taskId/:receiverId" element={<Chat />} />

        {/* Auth */}
        <Route path="/signup" element={<Signup />} />
        <Route path="/login" element={<Login />} />

        {/* Mappa */}
        <Route path="/map" element={<MapPage />} />

        {/* 👇 NUOVA ROUTE: DETTAGLI TASK */}
        <Route path="/task/:id" element={<TaskDetails />} />
      </Routes>
    </BrowserRouter>
  );
}
