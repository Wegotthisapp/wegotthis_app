import { BrowserRouter, Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar";

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
import TaskDetails from "./pages/TaskDetails";
import Auth from "./pages/Auth";
import HelperSetup from "./pages/HelperSetup";

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
        <Route path="/chat" element={<Chat />} />
        <Route path="/chat/:taskId/:receiverId" element={<Chat />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/login" element={<Login />} />
        <Route path="/map" element={<MapPage />} />
        <Route path="/task/:id" element={<TaskDetails />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/helper-setup" element={<HelperSetup />} />
      </Routes>
    </BrowserRouter>
  );
}
