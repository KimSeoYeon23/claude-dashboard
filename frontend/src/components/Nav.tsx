import { NavLink } from "react-router-dom";
import { useAuth } from "../auth";

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
    isActive
      ? "text-text-primary bg-bg-tertiary"
      : "text-text-secondary hover:text-text-primary hover:bg-bg-tertiary"
  }`;

export default function Nav() {
  const { token, username, logout } = useAuth();

  return (
    <nav className="sticky top-0 z-50 flex h-12 items-center bg-bg-primary px-6">
      <div className="mx-auto flex w-full max-w-6xl items-center gap-8">
        <NavLink to="/" className="flex items-center gap-2 text-sm font-semibold text-text-primary hover:no-underline">
          <span className="text-accent">&gt;_</span> Claude Code Dashboard
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
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-text-secondary transition-all hover:bg-bg-tertiary hover:text-text-primary"
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
