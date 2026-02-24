import { Routes, Route } from "react-router-dom";
import Nav from "./components/Nav";
import Landing from "./pages/Landing";
import Dashboard from "./pages/Dashboard";
import Sessions from "./pages/Sessions";
import SessionDetail from "./pages/SessionDetail";
import AgentDetail from "./pages/AgentDetail";
import Setup from "./pages/Setup";
import Login from "./pages/Login";

export default function App() {
  return (
    <>
      <Nav />
      <main className="mx-auto w-full max-w-6xl px-6 py-8 flex flex-col justify-center gap-6">
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/setup" element={<Setup />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/sessions" element={<Sessions />} />
          <Route path="/session/:id" element={<SessionDetail />} />
          <Route path="/agent/:pid" element={<AgentDetail />} />
        </Routes>
      </main>
    </>
  );
}
