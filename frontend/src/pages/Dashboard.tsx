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
import { useAuth } from "../auth";
import StatCard from "../components/StatCard";
import UsageGauge from "../components/UsageGauge";
import UsagePrediction from "../components/UsagePrediction";
import PlanRecommend from "../components/PlanRecommend";
import Loading from "../components/Loading";
import ErrorMessage from "../components/ErrorMessage";
import {
  fmtNum,
  fmtDate,
  fmtDateTime,
  fmtTokens,
  projectShortName,
} from "../utils/formatters";

function generateDemoData(): { stats: Stats; sessions: SessionsResponse } {
  const today = new Date();
  const daily = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - 29 + i);
    return {
      date: d.toISOString().split("T")[0],
      messageCount: Math.floor(Math.random() * 80) + 20,
      toolCallCount: Math.floor(Math.random() * 50) + 10,
    };
  });

  const hourCounts: Record<string, number> = {};
  for (let h = 0; h < 24; h++) {
    hourCounts[h] = h >= 9 && h <= 22 ? Math.floor(Math.random() * 30) + 5 : Math.floor(Math.random() * 5);
  }

  const stats: Stats = {
    totalSessions: 847,
    totalMessages: 12453,
    firstSessionDate: "2025-01-15",
    dailyActivity: daily,
    hourCounts,
    modelUsage: {
      "claude-sonnet-4-20250514": { inputTokens: 2800000, outputTokens: 1200000 },
      "claude-opus-4-20250514": { inputTokens: 1500000, outputTokens: 850000 },
      "claude-haiku-3.5-20241022": { inputTokens: 600000, outputTokens: 350000 },
    },
  };

  const sessions: SessionsResponse = {
    sessions: [
      { sessionId: "a1b2c3d4-demo-1111", project: "/Users/demo/my-app", display: "React 컴포넌트에 다크모드 기능 추가", timestamp: new Date(Date.now() - 3600000).toISOString() },
      { sessionId: "e5f6g7h8-demo-2222", project: "/Users/demo/api-server", display: "JWT 인증 미들웨어 구현", timestamp: new Date(Date.now() - 7200000).toISOString() },
      { sessionId: "i9j0k1l2-demo-3333", project: "/Users/demo/my-app", display: "성능 최적화: 불필요한 리렌더링 제거", timestamp: new Date(Date.now() - 14400000).toISOString() },
      { sessionId: "m3n4o5p6-demo-4444", project: "/Users/demo/infra", display: "Docker Compose 설정 및 CI/CD 파이프라인 구성", timestamp: new Date(Date.now() - 28800000).toISOString() },
      { sessionId: "q7r8s9t0-demo-5555", project: "/Users/demo/api-server", display: "WebSocket 실시간 알림 기능 추가", timestamp: new Date(Date.now() - 43200000).toISOString() },
    ],
    total: 5,
    page: 1,
    limit: 10,
    totalPages: 1,
  };

  return { stats, sessions };
}

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

ChartJS.defaults.color = "#A1A1AA";
ChartJS.defaults.borderColor = "rgba(255, 255, 255, 0.06)";
ChartJS.defaults.font.family =
  "'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";

export default function Dashboard() {
  const { token } = useAuth();
  const isDemo = !token;

  const [stats, setStats] = useState<Stats | null>(null);
  const [sessions, setSessions] = useState<SessionsResponse | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isDemo) {
      const demo = generateDemoData();
      setStats(demo.stats);
      setSessions(demo.sessions);
      setLoading(false);
      return;
    }

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

    fetchApi<{ agents: Agent[] }>("/api/agents")
      .then((ag) => setAgents(ag.agents || []))
      .catch(() => {});
  }, [isDemo]);

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
    "#818CF8",
    "#34D399",
    "#FBBF24",
    "#F87171",
    "#C084FC",
    "#F472B6",
  ];

  return (
    <>
      {/* Demo Banner */}
      {isDemo && (
        <div className="mb-6 flex items-center justify-between rounded-xl border border-accent/30 bg-accent/5 px-5 py-3">
          <p className="text-sm text-text-secondary">
            예시 데이터입니다. <span className="text-text-primary font-medium">로그인</span>하면 실제 데이터를 볼 수 있습니다.
          </p>
          <Link
            to="/login"
            className="rounded-lg bg-accent px-4 py-1.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
          >
            시작하기
          </Link>
        </div>
      )}

      {/* Active Agents */}
      {agents.length > 0 && (
        <div className="mb-8">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-medium text-text-muted">
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
                  className="block glass-card p-4 transition-colors hover:bg-bg-tertiary/40 hover:no-underline"
                >
                  <div className="mb-2 flex items-center gap-2">
                    <span className="rounded bg-green/10 px-2 py-0.5 font-mono text-xs font-bold text-green glow-green">
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
                    <span className="font-mono text-xs text-accent glow-accent">
                      {a.sessionId ? `${a.sessionId.slice(0, 8)}...` : "-"}
                    </span>
                    {a.model && (
                      <span className="rounded-md bg-purple/15 px-2 py-px text-[11px] font-semibold text-purple">
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
                    <div className="mt-2 border-t border-border/50 pt-2">
                      <div className="mb-1 text-[10px] text-text-muted">
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

      {/* Usage Monitor */}
      <div className="mb-8">
        <UsageGauge isDemo={isDemo} />
      </div>

      {/* Prediction + Plan Recommend */}
      <div className="mb-8 grid grid-cols-2 gap-4 max-md:grid-cols-1">
        <UsagePrediction isDemo={isDemo} />
        <PlanRecommend isDemo={isDemo} />
      </div>

      {/* Stats Cards */}
      <div className="mb-8 grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4">
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
      <div className="mb-8 grid grid-cols-2 gap-4 max-md:grid-cols-1">
        {/* Daily Activity */}
        <div className="col-span-full glass-card p-6">
          <h3 className="mb-4 text-sm font-medium text-text-muted">
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
                    borderColor: "#818CF8",
                    backgroundColor: "rgba(129,140,248,.1)",
                    fill: true,
                    tension: 0.3,
                    pointRadius: 1,
                  },
                  {
                    label: "Tool Calls",
                    data: daily.map((d) => d.toolCallCount),
                    borderColor: "#34D399",
                    backgroundColor: "rgba(52,211,153,.08)",
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
        <div className="glass-card p-6">
          <h3 className="mb-4 text-sm font-medium text-text-muted">
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
                    backgroundColor: "rgba(129,140,248,.5)",
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
        <div className="glass-card p-6">
          <h3 className="mb-4 text-sm font-medium text-text-muted">
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
      <div className="mb-8 overflow-hidden glass-card">
        <div className="flex items-center justify-between px-6 py-5">
          <h3 className="text-sm font-medium text-text-muted">
            Recent Sessions
          </h3>
        </div>
        <table className="w-full border-collapse">
          <thead>
            <tr>
              {["Project", "Session", "Message", "Date"].map((h) => (
                <th
                  key={h}
                  className="border-b border-border/50 px-6 py-2.5 text-left text-xs font-medium text-text-muted"
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
                  className="border-b border-border/50 last:border-b-0 hover:bg-bg-tertiary/40"
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
                    {(s.display || "").slice(0, 60)}
                  </td>
                  <td className="px-6 py-3 text-sm text-text-secondary">
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
