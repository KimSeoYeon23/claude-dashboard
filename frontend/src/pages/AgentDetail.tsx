import { useEffect, useState, useCallback, useRef } from "react";
import { Link, useParams } from "react-router-dom";
import { fetchApi, type Agent, type AgentActivity } from "../api";
import StatCard from "../components/StatCard";
import Loading from "../components/Loading";
import ErrorMessage from "../components/ErrorMessage";
import { fmtDateTime, projectShortName } from "../utils/formatters";

const POLL_INTERVAL = 5000;

/** activity 항목의 안정적인 키 생성 */
function activityKey(act: AgentActivity): string {
  return `${act.timestamp}|${act.role}|${act.type}|${act.summary.slice(0, 60)}`;
}

/** 기존 목록에 새 항목만 머지 (중복 제거) */
function mergeActivity(
  prev: AgentActivity[],
  next: AgentActivity[],
): AgentActivity[] {
  const seen = new Set(prev.map(activityKey));
  const merged = [...prev];
  for (const act of next) {
    const key = activityKey(act);
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(act);
    }
  }
  return merged;
}

/** sessionStorage 키 */
function storageKey(pid: string) {
  return `agent-activity-${pid}`;
}

/** sessionStorage에서 activity 로드 */
function loadStoredActivity(pid: string): AgentActivity[] {
  try {
    const raw = sessionStorage.getItem(storageKey(pid));
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return [];
}

/** sessionStorage에 activity 저장 */
function saveActivity(pid: string, activities: AgentActivity[]) {
  try {
    sessionStorage.setItem(storageKey(pid), JSON.stringify(activities));
  } catch { /* ignore */ }
}

export default function AgentDetail() {
  const { pid } = useParams<{ pid: string }>();
  const [agent, setAgent] = useState<Agent | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const activityRef = useRef<AgentActivity[]>(
    pid ? loadStoredActivity(pid) : [],
  );

  const toggleExpand = (key: string) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const loadAgent = useCallback(async () => {
    if (!pid) return;
    try {
      const data = await fetchApi<Agent>(`/api/agent/${pid}`);
      // activity 머지 + sessionStorage 저장
      const merged = mergeActivity(
        activityRef.current,
        data.recentActivity || [],
      );
      activityRef.current = merged;
      saveActivity(pid, merged);
      setAgent({ ...data, recentActivity: merged });
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [pid]);

  useEffect(() => {
    loadAgent();
    const timer = setInterval(loadAgent, POLL_INTERVAL);
    return () => clearInterval(timer);
  }, [loadAgent]);

  if (loading) return <Loading text="Loading agent..." />;
  if (error)
    return (
      <>
        <BackButton />
        <ErrorMessage message={`Agent not found or no longer active: ${error}`} />
      </>
    );
  if (!agent) return null;

  const pName = projectShortName(agent.project || "");
  const toolUsage = agent.toolUsage || {};
  const toolEntries = Object.entries(toolUsage).sort((a, b) => b[1] - a[1]);
  // 내림차순 정렬 (최신이 위)
  const sortedActivity = [...(agent.recentActivity || [])].sort(
    (a, b) => b.timestamp.localeCompare(a.timestamp),
  );

  return (
    <>
      <BackButton />

      {/* Header */}
      <div className="mb-6 flex items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green/10">
          <span className="h-3 w-3 animate-[pulse_2s_ease-in-out_infinite] rounded-full bg-green" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-text-primary">
            Agent PID {agent.pid}
          </h2>
          <div className="text-[13px] text-text-muted">
            {agent.owner && <span>{agent.owner} &middot; </span>}
            {agent.tty} &middot; Auto-refreshing every 5s
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="mb-6 grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4">
        <StatCard label="Project" value={pName || "-"} sub={agent.cwd} />
        <StatCard
          label="Model"
          value={
            agent.model
              ? agent.model.replace("claude-", "").replace(/-\d{8}$/, "")
              : "N/A"
          }
        />
        <StatCard label="CPU" value={`${agent.cpu}%`} />
        <StatCard label="Memory" value={`${agent.mem}%`} />
      </div>

      {/* Meta info */}
      <div className="mb-6 rounded-lg border border-border bg-bg-card p-5">
        <div className="grid grid-cols-2 gap-4 text-sm max-md:grid-cols-1">
          <div>
            <span className="text-text-muted">Session: </span>
            {agent.sessionId ? (
              <Link
                to={`/session/${agent.sessionId}`}
                className="font-mono text-accent"
              >
                {agent.sessionId}
              </Link>
            ) : (
              <span className="text-text-muted">-</span>
            )}
          </div>
          <div>
            <span className="text-text-muted">Started: </span>
            <span className="text-text-secondary">{agent.started || "-"}</span>
          </div>
          <div className="col-span-full">
            <span className="text-text-muted">First Message: </span>
            <span className="text-text-secondary">
              {agent.firstMessage || "-"}
            </span>
          </div>
        </div>
      </div>

      {/* Tool Usage */}
      {toolEntries.length > 0 && (
        <div className="mb-6">
          <h3 className="mb-3 text-sm font-semibold text-text-secondary">
            Tools Used ({toolEntries.length})
          </h3>
          <div className="flex flex-wrap gap-2">
            {toolEntries.map(([name, count]) => (
              <span
                key={name}
                className="inline-flex items-center gap-1.5 rounded-2xl border border-border bg-bg-tertiary px-3 py-1 text-[13px] text-text-secondary"
              >
                {name}
                <span className="rounded-xl bg-purple/80 px-1.5 py-px text-[11px] font-bold text-white">
                  {count}
                </span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Recent Activity Timeline */}
      <h3 className="mb-4 text-sm font-semibold text-text-secondary">
        Live Activity ({sortedActivity.length})
      </h3>
      <div className="flex flex-col gap-2">
        {sortedActivity.length === 0 ? (
          <div className="px-5 py-10 text-center text-text-muted">
            No activity recorded yet
          </div>
        ) : (
          sortedActivity.map((act) => {
            const key = activityKey(act);
            return (
              <ActivityItem
                key={key}
                act={act}
                expanded={expandedItems.has(key)}
                onToggle={() => toggleExpand(key)}
              />
            );
          })
        )}
      </div>
    </>
  );
}

function ActivityItem({
  act,
  expanded,
  onToggle,
}: {
  act: AgentActivity;
  expanded: boolean;
  onToggle: () => void;
}) {
  const isToolCall = act.type === "tool_call";
  const hasFullText = !!act.fullText;
  const borderColor =
    act.role === "user"
      ? "border-l-accent"
      : isToolCall
        ? "border-l-purple"
        : "border-l-green";
  const dotColor =
    act.role === "user"
      ? "bg-accent"
      : isToolCall
        ? "bg-purple"
        : "bg-green";
  const tagColor =
    act.role === "user"
      ? "bg-accent/15 text-accent"
      : isToolCall
        ? "bg-purple/15 text-purple"
        : "bg-green/15 text-green";
  const tagLabel = isToolCall ? "tool" : act.role;

  return (
    <div
      className={`rounded-lg border border-border border-l-[3px] ${borderColor} bg-bg-card px-4 py-3 shadow-[0_1px_3px_rgba(0,0,0,.3)] ${hasFullText ? "cursor-pointer transition-colors hover:bg-bg-tertiary" : ""}`}
      onClick={hasFullText ? onToggle : undefined}
    >
      <div className="mb-1 flex items-center gap-2">
        <span
          className={`inline-block h-1.5 w-1.5 rounded-full ${dotColor}`}
        />
        <span
          className={`rounded px-1.5 py-px text-[10px] font-bold uppercase tracking-wide ${tagColor}`}
        >
          {tagLabel}
        </span>
        <span className="text-[11px] text-text-muted">
          {fmtDateTime(act.timestamp)}
        </span>
        {hasFullText && (
          <span className="ml-auto text-[11px] text-text-muted">
            {expanded ? "▲ 접기" : "▼ 펼치기"}
          </span>
        )}
      </div>
      <div
        className={`whitespace-pre-wrap break-words text-[13px] leading-relaxed text-text-secondary ${!expanded && !hasFullText ? "" : !expanded ? "line-clamp-2" : ""}`}
      >
        {expanded && act.fullText ? act.fullText : act.summary}
      </div>
    </div>
  );
}

function BackButton() {
  return (
    <Link
      to="/"
      className="mb-4 inline-flex items-center gap-1.5 rounded-lg border border-border bg-bg-tertiary px-3.5 py-1.5 text-[13px] text-text-secondary transition-all hover:border-accent hover:text-text-primary hover:no-underline"
    >
      &larr; Back to Dashboard
    </Link>
  );
}
