import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Filler,
  Tooltip,
  Legend,
} from "chart.js";
import { Line, Bar, Doughnut } from "react-chartjs-2";
import {
  fetchApi,
  type Stats,
  type SessionsResponse,
  type Agent,
} from "../api";
import StatCard from "../components/StatCard";
import Loading from "../components/Loading";
import ErrorMessage from "../components/ErrorMessage";
import {
  fmtNum,
  fmtDate,
  fmtDateTime,
  fmtTokens,
  projectShortName,
} from "../utils/formatters";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Filler,
  Tooltip,
  Legend,
);

ChartJS.defaults.color = "#8b949e";
ChartJS.defaults.borderColor = "#30363d";
ChartJS.defaults.font.family =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [sessions, setSessions] = useState<SessionsResponse | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetchApi<Stats>("/api/stats"),
      fetchApi<SessionsResponse>("/api/sessions?limit=10"),
    ])
      .then(([s, sess]) => {
        setStats(s);
        setSessions(sess);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));

    // agents는 실패해도 대시보드 렌더링에 영향 없도록 별도 fetch
    fetchApi<{ agents: Agent[] }>("/api/agents")
      .then((ag) => setAgents(ag.agents || []))
      .catch(() => {});
  }, []);

  if (loading) return <Loading text="Loading dashboard..." />;
  if (error) return <ErrorMessage message={`Failed to load dashboard: ${error}`} />;
  if (!stats) return null;

  const totalToolCalls = (stats.dailyActivity || []).reduce(
    (s, d) => s + (d.toolCallCount || 0),
    0,
  );
  const totalTokens = Object.values(stats.modelUsage || {}).reduce(
    (s, m) => s + (m.outputTokens || 0),
    0,
  );

  const daily = stats.dailyActivity || [];
  const hourCounts = stats.hourCounts || {};
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const modelUsage = stats.modelUsage || {};
  const modelNames = Object.keys(modelUsage);
  const modelColors = [
    "#58a6ff",
    "#3fb950",
    "#d29922",
    "#f85149",
    "#bc8cff",
    "#f778ba",
  ];

  return (
    <>
      {/* Active Agents */}
      {agents.length > 0 && (
        <div className="mb-6">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-text-secondary">
            <span className="inline-block h-2 w-2 animate-[pulse_2s_ease-in-out_infinite] rounded-full bg-green" />
            Active Agents ({agents.length})
          </h3>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-3">
            {agents.map((a) => {
              const pName = projectShortName(a.project || "");
              return (
                <Link
                  to={`/agent/${a.pid}`}
                  key={a.pid}
                  className="block rounded-lg border border-border border-l-[3px] border-l-green bg-bg-card p-4 shadow-[0_1px_3px_rgba(0,0,0,.3)] transition-all hover:border-green/50 hover:no-underline"
                >
                  <div className="mb-2 flex items-center gap-2">
                    <span className="rounded bg-green/10 px-2 py-0.5 font-mono text-xs font-bold text-green">
                      PID {a.pid}
                    </span>
                    <span className="font-mono text-[11px] text-text-muted">
                      {a.tty}
                    </span>
                    <span className="ml-auto h-1.5 w-1.5 animate-[pulse_2s_ease-in-out_infinite] rounded-full bg-green" />
                  </div>
                  <div
                    className="mb-1 truncate text-sm font-semibold text-text-primary"
                    title={a.cwd}
                  >
                    {pName || a.cwd}
                  </div>
                  {a.firstMessage && (
                    <div className="mb-2 truncate rounded-md bg-bg-tertiary px-2.5 py-1.5 text-[13px] leading-snug text-text-secondary">
                      {a.firstMessage}
                    </div>
                  )}
                  <div className="mb-1 flex flex-wrap items-center gap-2.5">
                    <span className="font-mono text-xs text-accent">
                      {a.sessionId ? `${a.sessionId.slice(0, 8)}...` : "-"}
                    </span>
                    {a.model && (
                      <span className="rounded-xl bg-purple/15 px-2 py-px text-[11px] font-semibold text-purple">
                        {a.model.replace("claude-", "").replace(/-\d{8}$/, "")}
                      </span>
                    )}
                    <span className="ml-auto text-[11px] text-text-muted">
                      CPU {a.cpu}% &middot; MEM {a.mem}%
                    </span>
                  </div>
                  {a.started && (
                    <div className="mt-1 text-[11px] text-text-muted">
                      Started: {a.started}
                    </div>
                  )}
                  {/* 최근 활동 */}
                  {(a.recentActivity || []).length > 0 && (
                    <div className="mt-2 border-t border-border pt-2">
                      <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-text-muted">
                        Recent Activity
                      </div>
                      <div className="flex flex-col gap-1">
                        {a.recentActivity.slice(-3).map((act, i) => (
                          <div
                            key={i}
                            className="flex items-start gap-1.5 text-[11px] leading-snug"
                          >
                            <span
                              className={`mt-0.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full ${
                                act.type === "tool_call"
                                  ? "bg-purple"
                                  : act.role === "user"
                                    ? "bg-accent"
                                    : "bg-green"
                              }`}
                            />
                            <span className="truncate text-text-secondary">
                              {act.summary}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="mb-6 grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4">
        <StatCard
          label="Total Sessions"
          value={fmtNum(stats.totalSessions)}
          sub={`since ${fmtDate(stats.firstSessionDate)}`}
        />
        <StatCard label="Total Messages" value={fmtNum(stats.totalMessages)} />
        <StatCard label="Tool Calls" value={fmtNum(totalToolCalls)} />
        <StatCard label="Output Tokens" value={fmtTokens(totalTokens)} />
      </div>

      {/* Charts */}
      <div className="mb-6 grid grid-cols-2 gap-4 max-md:grid-cols-1">
        {/* Daily Activity */}
        <div className="col-span-full rounded-lg border border-border bg-bg-card p-5 shadow-[0_1px_3px_rgba(0,0,0,.3)]">
          <h3 className="mb-4 text-sm font-semibold text-text-secondary">
            Daily Activity
          </h3>
          <div className="relative h-[280px] w-full">
            <Line
              data={{
                labels: daily.map((d) => d.date),
                datasets: [
                  {
                    label: "Messages",
                    data: daily.map((d) => d.messageCount),
                    borderColor: "#58a6ff",
                    backgroundColor: "rgba(88,166,255,.1)",
                    fill: true,
                    tension: 0.3,
                    pointRadius: 1,
                  },
                  {
                    label: "Tool Calls",
                    data: daily.map((d) => d.toolCallCount),
                    borderColor: "#3fb950",
                    backgroundColor: "rgba(63,185,80,.1)",
                    fill: true,
                    tension: 0.3,
                    pointRadius: 1,
                  },
                ],
              }}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                interaction: { intersect: false, mode: "index" },
                plugins: { legend: { position: "top" } },
                scales: {
                  x: {
                    ticks: { maxTicksLimit: 15, font: { size: 11 } },
                    grid: { display: false },
                  },
                  y: { beginAtZero: true, ticks: { font: { size: 11 } } },
                },
              }}
            />
          </div>
        </div>

        {/* Hourly Activity */}
        <div className="rounded-lg border border-border bg-bg-card p-5 shadow-[0_1px_3px_rgba(0,0,0,.3)]">
          <h3 className="mb-4 text-sm font-semibold text-text-secondary">
            Activity by Hour
          </h3>
          <div className="relative h-[220px] w-full">
            <Bar
              data={{
                labels: hours.map((h) => `${h}시`),
                datasets: [
                  {
                    label: "Sessions",
                    data: hours.map((h) => hourCounts[h] || 0),
                    backgroundColor: "rgba(188,140,255,.6)",
                    borderRadius: 4,
                  },
                ],
              }}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                  x: {
                    ticks: { font: { size: 10 } },
                    grid: { display: false },
                  },
                  y: { beginAtZero: true, ticks: { font: { size: 10 } } },
                },
              }}
            />
          </div>
        </div>

        {/* Model Tokens */}
        <div className="rounded-lg border border-border bg-bg-card p-5 shadow-[0_1px_3px_rgba(0,0,0,.3)]">
          <h3 className="mb-4 text-sm font-semibold text-text-secondary">
            Tokens by Model
          </h3>
          <div className="relative h-[220px] w-full">
            <Doughnut
              data={{
                labels: modelNames.map((m) =>
                  m.replace("claude-", "").replace(/-\d{8}$/, ""),
                ),
                datasets: [
                  {
                    data: modelNames.map(
                      (m) => modelUsage[m].outputTokens || 0,
                    ),
                    backgroundColor: modelColors.slice(0, modelNames.length),
                    borderWidth: 0,
                  },
                ],
              }}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: {
                    position: "right",
                    labels: { font: { size: 11 }, padding: 12 },
                  },
                },
              }}
            />
          </div>
        </div>
      </div>

      {/* Recent Sessions */}
      <div className="mb-6 overflow-hidden rounded-lg border border-border bg-bg-card shadow-[0_1px_3px_rgba(0,0,0,.3)]">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h3 className="text-sm font-semibold text-text-secondary">
            Recent Sessions
          </h3>
        </div>
        <table className="w-full border-collapse">
          <thead>
            <tr>
              {["Project", "Session", "Message", "Date"].map((h) => (
                <th
                  key={h}
                  className="border-b border-border bg-bg-secondary px-5 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-text-muted"
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
                  <td className="px-5 py-3 text-sm text-text-secondary">
                    <span
                      className="inline-block max-w-[200px] truncate rounded-xl bg-bg-tertiary px-2 py-0.5 text-xs text-text-secondary"
                      title={s.project}
                    >
                      {pName}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-sm">
                    <Link to={`/session/${s.sessionId}`} className="text-accent">
                      {s.sessionId?.slice(0, 8)}...
                    </Link>
                  </td>
                  <td className="px-5 py-3 text-sm text-text-secondary">
                    {(s.display || "").slice(0, 60)}
                  </td>
                  <td className="px-5 py-3 text-sm text-text-secondary">
                    {fmtDateTime(s.timestamp)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
