import { useEffect, useState, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import {
  fetchApi,
  type SessionsResponse,
  type Project,
} from "../api";
import Loading from "../components/Loading";
import ErrorMessage from "../components/ErrorMessage";
import { fmtNum, fmtDateTime, projectShortName } from "../utils/formatters";

export default function Sessions() {
  const [sessions, setSessions] = useState<SessionsResponse | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [project, setProject] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const loadSessions = useCallback(
    async (p: number, proj: string, q: string) => {
      setLoading(true);
      setError("");
      try {
        const [projRes, sessRes] = await Promise.all([
          fetchApi<{ projects: Project[] }>("/api/projects"),
          fetchApi<SessionsResponse>(
            `/api/sessions?page=${p}&limit=30&project=${encodeURIComponent(proj)}&search=${encodeURIComponent(q)}`,
          ),
        ]);
        setProjects(projRes.projects || []);
        setSessions(sessRes);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    loadSessions(page, project, search);
  }, [page, project, loadSessions]); // search is handled by debounce

  const handleSearchInput = (val: string) => {
    setSearch(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setPage(1);
      loadSessions(1, project, val);
    }, 400);
  };

  const handleProjectChange = (val: string) => {
    setProject(val);
    setPage(1);
  };

  if (loading && !sessions) return <Loading text="Loading sessions..." />;
  if (error && !sessions)
    return <ErrorMessage message={`Failed to load sessions: ${error}`} />;

  return (
    <>
      {/* Filters */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <select
          value={project}
          onChange={(e) => handleProjectChange(e.target.value)}
          className="rounded-lg border border-border bg-bg-tertiary px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
        >
          <option value="">All Projects</option>
          {projects.map((p) => (
            <option key={p.name} value={p.name}>
              {projectShortName(p.name)} ({p.sessionCount})
            </option>
          ))}
        </select>
        <input
          type="text"
          placeholder="Search messages..."
          value={search}
          onChange={(e) => handleSearchInput(e.target.value)}
          className="min-w-[240px] rounded-lg border border-border bg-bg-tertiary px-3 py-2 text-sm text-text-primary outline-none focus:border-accent max-md:min-w-[160px]"
        />
      </div>

      {/* Table */}
      <div className="mb-6 overflow-hidden rounded-xl bg-bg-card">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              {["Project", "Session", "First Message", "Date"].map((h) => (
                <th
                  key={h}
                  className="border-b border-border px-6 py-2.5 text-left text-xs font-medium text-text-muted"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(sessions?.sessions || []).map((s, i) => {
              const pName = projectShortName(
                s.project ? s.project.split("/").pop()! : "",
              );
              return (
                <tr
                  key={`${s.sessionId}-${i}`}
                  className="border-b border-border last:border-b-0 hover:bg-bg-tertiary"
                >
                  <td className="px-6 py-3 text-sm text-text-secondary">
                    <span
                      className="inline-block max-w-[200px] truncate rounded-md bg-bg-tertiary px-2 py-0.5 text-xs text-text-secondary"
                      title={s.project}
                    >
                      {pName}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-sm">
                    <Link to={`/session/${s.sessionId}`} className="text-accent">
                      {s.sessionId?.slice(0, 8)}...
                    </Link>
                  </td>
                  <td className="px-6 py-3 text-sm text-text-secondary">
                    {(s.display || "").slice(0, 80)}
                  </td>
                  <td className="px-6 py-3 text-sm text-text-secondary">
                    {fmtDateTime(s.timestamp)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Pagination */}
        <div className="flex items-center justify-center gap-2 p-4">
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="rounded-lg border border-border px-3.5 py-1.5 text-sm text-text-primary transition-colors hover:bg-bg-tertiary disabled:cursor-not-allowed disabled:opacity-40"
          >
            &larr; Prev
          </button>
          <span className="text-[13px] text-text-muted">
            {sessions?.page} / {sessions?.totalPages} ({fmtNum(sessions?.total ?? 0)})
          </span>
          <button
            disabled={(sessions?.page ?? 0) >= (sessions?.totalPages ?? 0)}
            onClick={() => setPage((p) => p + 1)}
            className="rounded-lg border border-border px-3.5 py-1.5 text-sm text-text-primary transition-colors hover:bg-bg-tertiary disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next &rarr;
          </button>
        </div>
      </div>
    </>
  );
}
