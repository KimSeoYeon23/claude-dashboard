import { NavLink } from "react-router-dom";

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `px-4 py-2 rounded-lg text-sm font-medium transition-all ${
    isActive
      ? "text-text-primary bg-bg-tertiary"
      : "text-text-secondary hover:text-text-primary hover:bg-bg-tertiary"
  }`;

export default function Nav() {
  return (
    <nav className="sticky top-0 z-50 flex h-14 items-center gap-8 border-b border-border bg-bg-secondary px-6">
      <div className="flex items-center gap-2 text-base font-bold text-text-primary">
        <span className="text-accent">&gt;_</span> Claude Code Dashboard
      </div>
      <div className="flex gap-1">
        <NavLink to="/" end className={linkClass}>
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
      </div>
      <a
        href="https://claude.ai/settings/usage"
        target="_blank"
        rel="noopener noreferrer"
        className="ml-auto rounded-lg px-4 py-2 text-sm font-medium text-text-secondary transition-all hover:bg-bg-tertiary hover:text-text-primary hover:no-underline"
      >
        Usage &nearr;
      </a>
    </nav>
  );
}
