import { NavLink } from "react-router-dom";
import { useAuth } from "../auth";

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
    isActive
      ? "text-text-primary bg-bg-tertiary/60"
      : "text-text-secondary/80 hover:text-text-primary hover:bg-bg-tertiary/40"
  }`;

export default function Nav() {
  const { token, username, logout } = useAuth();

  return (
    <nav className="sticky top-0 z-50 flex h-12 items-center glass-nav px-6">
      <div className="mx-auto flex w-full max-w-6xl items-center gap-8">
        <NavLink to={token ? "/dashboard" : "/"} className="flex items-center gap-2 text-sm font-semibold text-text-primary hover:no-underline">
          <span className="font-mono text-accent glow-accent">&gt;_</span> <span className="font-mono">Claude Code Dashboard</span>
        </NavLink>
        {token ? (
          <>
            <div className="flex gap-1">
              <NavLink to="/dashboard" className={linkClass}>
                Dashboard
              </NavLink>
              <NavLink
                to="/sessions"
                className={({ isActive }) =>
                  linkClass({
                    isActive: isActive || location.hash.startsWith("#/session/"),
                  })
                }
              >
                Sessions
              </NavLink>
              <NavLink to="/setup" className={linkClass}>
                Setup
              </NavLink>
            </div>
            <div className="ml-auto flex items-center gap-3">
              <span className="text-xs text-text-muted">{username}</span>
              <button
                onClick={logout}
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-text-secondary/80 transition-all hover:bg-bg-tertiary/40 hover:text-text-primary"
              >
                Logout
              </button>
            </div>
          </>
        ) : (
          <div className="ml-auto">
            <NavLink to="/login" className={linkClass}>
              로그인
            </NavLink>
          </div>
        )}
      </div>
    </nav>
  );
}
