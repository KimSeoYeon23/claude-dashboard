import { Routes, Route } from "react-router-dom";
import Nav from "./components/Nav";
import Dashboard from "./pages/Dashboard";
import Sessions from "./pages/Sessions";
import SessionDetail from "./pages/SessionDetail";
import AgentDetail from "./pages/AgentDetail";

export default function App() {
  return (
    <>
      <Nav />
      <main className="mx-auto w-full p-6 flex flex-col justify-center gap-6">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/sessions" element={<Sessions />} />
          <Route path="/session/:id" element={<SessionDetail />} />
          <Route path="/agent/:pid" element={<AgentDetail />} />
        </Routes>
      </main>
    </>
  );
}
