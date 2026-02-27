import { useEffect, useState, useRef, useCallback } from "react";
import { Link, useParams } from "react-router-dom";
import { fetchApi, type SessionDetail as SessionDetailType } from "../api";

function buildApiPath(path: string) {
  const match = document.cookie.match(/(?:^|; )username=([^;]*)/);
  const username = match ? decodeURIComponent(match[1]) : null;
  if (username) {
    const sep = path.includes("?") ? "&" : "?";
    return `${path}${sep}user=${encodeURIComponent(username)}`;
  }
  return path;
}

function AISummary({ sessionId }: { sessionId: string }) {
  const [summary, setSummary] = useState<string | null>(null);
  const [displayText, setDisplayText] = useState("");
  const [phase, setPhase] = useState<"checking" | "streaming" | "done" | "error">("checking");
  const textRef = useRef("");
  const rafRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  const startStream = useCallback(async (signal: AbortSignal, regen = false) => {
    setPhase("streaming");
    setSummary(null);
    textRef.current = "";
    setDisplayText("");

    let running = true;
    const tick = () => {
      if (signal.aborted) { running = false; return; }
      setDisplayText(textRef.current);
      if (running) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    try {
      const url = `/api/session/${sessionId}/summary/stream${regen ? "?regenerate=true" : ""}`;
      const res = await fetch(buildApiPath(url), { signal });
      if (!res.ok) throw new Error("stream failed");
      const reader = res.body?.getReader();
      if (!reader) throw new Error("no reader");
      const decoder = new TextDecoder();
      let buf = "";

      while (true) {
        const { done, value } = await reader.read();
        if (signal.aborted) break;
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() || "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.text) textRef.current += data.text;
            if (data.done) {
              running = false;
              cancelAnimationFrame(rafRef.current);
              const final = textRef.current.trim();
              setSummary(final);
              setDisplayText(final);
              setPhase("done");
            }
          } catch { /* skip bad JSON */ }
        }
      }
    } catch (e) {
      if (signal.aborted) return;
      running = false;
      cancelAnimationFrame(rafRef.current);
      setPhase("error");
    }
  }, [sessionId]);

  const retryStream = useCallback((regen = false) => {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    startStream(ac.signal, regen);
  }, [startStream]);

  useEffect(() => {
    const ac = new AbortController();
    abortRef.current = ac;

    fetchApi<{ summary: string }>(`/api/session/${sessionId}/summary`)
      .then((res) => {
        if (ac.signal.aborted) return;
        setSummary(res.summary);
        setPhase("done");
      })
      .catch(() => {
        if (ac.signal.aborted) return;
        startStream(ac.signal);
      });

    return () => {
      ac.abort();
      cancelAnimationFrame(rafRef.current);
    };
  }, [sessionId, startStream]);

  if (phase === "checking") return null;

  if (phase === "error") {
    return (
      <div className="mb-6">
        <span className="text-[13px] text-red">요약 생성 실패</span>
        <button
          onClick={() => retryStream()}
          className="ml-3 text-[13px] text-accent hover:text-accent-hover"
        >
          다시 시도
        </button>
      </div>
    );
  }

  return (
    <div className="mb-6 glass-card px-5 py-4 flex items-start gap-3">
      <span className="shrink-0 rounded-md bg-accent/15 px-2 py-0.5 text-[11px] font-bold text-accent">
        AI 요약
      </span>
      <p className={`flex-1 text-sm leading-relaxed ${phase === "done" ? "text-text-primary" : "text-text-secondary"}`}>
        {summary || displayText || "요약 생성 중..."}
        {phase === "streaming" && (
          <span className="ml-0.5 inline-block h-3.5 w-[2px] translate-y-[1px] animate-[blink_0.8s_steps(2)_infinite] bg-accent" />
        )}
      </p>
      {phase === "done" && (
        <button
          onClick={() => retryStream(true)}
          className="shrink-0 rounded-md border border-border/50 px-2.5 py-1 text-[11px] text-text-secondary hover:border-accent/50 hover:text-accent transition-colors"
        >
          ↻ 재생성
        </button>
      )}
    </div>
  );
}
import StatCard from "../components/StatCard";
import Loading from "../components/Loading";
import ErrorMessage from "../components/ErrorMessage";
import { fmtNum, fmtDateTime, fmtDuration, fmtTokens } from "../utils/formatters";

const PAGE_SIZE = 30;

export default function SessionDetail() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<SessionDetailType | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [msgPage, setMsgPage] = useState(1);
  const [toolFilter, setToolFilter] = useState<string | null>(null);
  const timelineRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    fetchApi<SessionDetailType>(`/api/session/${id}`)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <Loading text="Loading session detail..." />;
  if (error)
    return (
      <>
        <BackButton />
        <ErrorMessage message={`Failed to load session: ${error}`} />
      </>
    );
  if (!data) return null;

  // MCP 도구명을 보기 좋게 변환 + 같은 서버 도구끼리 합산
  const rawCalls = data.toolCalls || {};
  const groupedCalls: Record<string, number> = {};
  for (const [name, count] of Object.entries(rawCalls)) {
    if (name.startsWith("mcp__")) {
      const parts = name.split("__");
      const server = parts[1] || name;
      groupedCalls[`MCP:${server}`] = (groupedCalls[`MCP:${server}`] || 0) + count;
    } else {
      groupedCalls[name] = (groupedCalls[name] || 0) + count;
    }
  }
  const toolEntries = Object.entries(groupedCalls).sort(
    (a, b) => b[1] - a[1],
  );
  const totalCalls = Object.values(rawCalls).reduce(
    (a, b) => a + b,
    0,
  );

  return (
    <>
      <BackButton />

      {/* Header */}
      <div className="mb-6">
        <h2 className="mb-1 break-all font-mono text-xl font-bold text-text-primary">
          Session: {id}
        </h2>
        <div className="text-[13px] text-text-muted">
          Model: {data.model || "N/A"} &middot; Duration:{" "}
          {fmtDuration(data.durationMs)} &middot;{" "}
          {fmtDateTime(data.startTimestamp)} ~ {fmtDateTime(data.endTimestamp)}
        </div>
      </div>

      {/* Stats */}
      <div className="mb-6 grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4">
        <StatCard label="Messages" value={fmtNum(data.messageCount)} />
        <StatCard label="Input Tokens" value={fmtTokens(data.totalInputTokens)} />
        <StatCard label="Output Tokens" value={fmtTokens(data.totalOutputTokens)} />
        <StatCard
          label="Tools Used"
          value={String(Object.keys(data.toolCalls || {}).length)}
          sub={`${totalCalls} total calls`}
        />
      </div>

      {/* Tool Summary */}
      {toolEntries.length > 0 && (
        <div className="mb-6 flex flex-wrap gap-2">
          {toolEntries.map(([name, count]) => (
            <button
              key={name}
              onClick={() => {
                setToolFilter(toolFilter === name ? null : name);
                setMsgPage(1);
              }}
              className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1 text-[13px] transition-colors ${
                toolFilter === name
                  ? "border-accent bg-accent/15 text-accent"
                  : "border-border/50 glass-card text-text-secondary hover:border-accent/50 hover:text-text-primary"
              }`}
            >
              {name.startsWith("Skill:/") ? (
                <>
                  <span className="text-accent">{name.slice(6)}</span>
                  <span className="rounded-sm bg-accent/15 px-1 py-px text-[10px] font-medium text-accent">Skill</span>
                </>
              ) : name.startsWith("MCP:") ? (
                <>
                  <span>{name.slice(4)}</span>
                  <span className="rounded-sm bg-purple/15 px-1 py-px text-[10px] font-medium text-purple">MCP</span>
                </>
              ) : (
                name
              )}
              <span className="rounded-md bg-accent px-1.5 py-px text-[11px] font-bold text-white">
                {count}
              </span>
            </button>
          ))}
          {toolFilter && (
            <button
              onClick={() => { setToolFilter(null); setMsgPage(1); }}
              className="rounded-md border border-border/50 px-3 py-1 text-[13px] text-text-muted hover:text-text-primary transition-colors"
            >
              필터 해제
            </button>
          )}
        </div>
      )}

      {/* AI Summary */}
      <AISummary sessionId={id!} />

      {/* Modified Files */}
      {(data.filesModified || []).length > 0 && (
        <div className="mb-6 glass-card px-5 py-4">
          <h3 className="mb-3 text-sm font-medium text-text-muted">
            Modified Files ({data.filesModified.length})
          </h3>
          <ul className="max-h-[200px] list-none overflow-y-auto">
            {data.filesModified.map((f) => (
              <li
                key={f}
                className="py-0.5 font-mono text-[13px] text-text-muted"
              >
                {f}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Subagents */}
      {(data.subagentIds || []).length > 0 && (
        <div className="mb-6">
          <h3 className="mb-3 text-sm font-medium text-text-muted">
            Subagents ({data.subagentIds.length})
          </h3>
          <div className="flex flex-wrap gap-2">
            {data.subagentIds.map((sid) => (
              <span
                key={sid}
                className="inline-block rounded-md border border-border bg-bg-tertiary px-3 py-1 font-mono text-xs text-text-muted"
              >
                {sid.slice(0, 8)}...
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Message Timeline */}
      <MessageTimeline
        messages={data.messages || []}
        page={msgPage}
        onPageChange={(p) => {
          setMsgPage(p);
          timelineRef.current?.scrollIntoView({ behavior: "smooth" });
        }}
        toolFilter={toolFilter}
        ref={timelineRef}
      />
    </>
  );
}

const COLLAPSED_HEIGHT = 200;

/** 메시지 블록들로부터 한 줄 요약 생성 */
interface MessageSummary {
  text: string;
  badges: { label: string; type: "skill" | "mcp" | "tool" }[];
}

function getMessageSummary(content: SessionDetailType["messages"][number]["content"]): MessageSummary {
  if (!content || content.length === 0) return { text: "(empty)", badges: [] };

  const textParts: string[] = [];
  const toolNames: string[] = [];
  const badges: MessageSummary["badges"] = [];

  for (const block of content) {
    if (block.type === "text" && block.text) {
      if (textParts.length === 0) {
        const cmdMatch = block.text.match(/<command-name>\/?([\w-]+)<\/command-name>/);
        if (cmdMatch) {
          textParts.push(`/${cmdMatch[1]}`);
          badges.push({ label: "Skill", type: "skill" });
        } else {
          const firstLine = block.text.split("\n").find((l) => l.trim()) || "";
          textParts.push(firstLine.trim().slice(0, 120));
        }
      }
    } else if (block.type === "tool_use" && block.name) {
      let name = block.name;
      if (name.startsWith("mcp__")) {
        const parts = name.split("__");
        const server = parts[1] || "";
        name = parts[2] || parts[1] || name;
        if (!badges.some((b) => b.label === server)) {
          badges.push({ label: server, type: "mcp" });
        }
      } else if (name === "Skill" && block.input_summary) {
        name = block.input_summary.split(" ")[0];
        badges.push({ label: "Skill", type: "skill" });
      }
      toolNames.push(name);
    }
  }

  let text: string;
  if (textParts.length > 0 && toolNames.length > 0) {
    text = `${textParts[0]}${textParts[0].length >= 120 ? "..." : ""} → ${toolNames.join(", ")}`;
  } else if (toolNames.length > 0) {
    text = toolNames.join(" → ");
  } else if (textParts.length > 0) {
    text = textParts[0] + (textParts[0].length >= 120 ? "..." : "");
  } else {
    text = "(empty)";
  }
  return { text, badges };
}

function MessageCard({
  msg,
  index,
}: {
  msg: SessionDetailType["messages"][number];
  index: number;
}) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [, setOverflows] = useState(false);

  const checkOverflow = useCallback(() => {
    const el = contentRef.current;
    if (el) setOverflows(el.scrollHeight > COLLAPSED_HEIGHT);
  }, []);

  useEffect(() => {
    checkOverflow();
  }, [checkOverflow]);

  const summary = getMessageSummary(msg.content);

  const roleClass =
    msg.role === "user"
      ? "border-l-accent"
      : msg.role === "assistant"
        ? "border-l-green"
        : "border-l-orange";
  const tagClass =
    msg.role === "user"
      ? "bg-accent/15 text-accent"
      : msg.role === "assistant"
        ? "bg-green/15 text-green"
        : "bg-orange/15 text-orange";

  return (
    <div
      className={`rounded-xl border-l-[3px] ${roleClass} glass-card px-[18px] py-3.5`}
    >
      <div className="mb-1 flex items-center gap-2">
        <span
          className={`rounded px-2 py-0.5 text-[11px] font-bold ${tagClass}`}
        >
          {msg.role}
        </span>
        <span className="text-[11px] text-text-muted">
          {fmtDateTime(msg.timestamp)}
        </span>
        <span className="text-[11px] text-text-muted">
          #{index}
        </span>
        <button
          onClick={() => setExpanded((v) => !v)}
          className="ml-auto text-[11px] text-text-muted transition-colors hover:text-text-secondary"
        >
          {expanded ? "접기 ▲" : "펼치기 ▼"}
        </button>
      </div>
      {/* 한 줄 요약 */}
      <div className="flex items-center gap-1.5 text-[13px] text-text-secondary">
        <span className="truncate">{summary.text}</span>
        {summary.badges.map((b, i) => (
          <span
            key={i}
            className={`shrink-0 rounded-sm px-1.5 py-px text-[10px] font-medium ${
              b.type === "skill"
                ? "bg-accent/15 text-accent"
                : b.type === "mcp"
                  ? "bg-purple/15 text-purple"
                  : "bg-text-muted/15 text-text-muted"
            }`}
          >
            {b.label}
          </span>
        ))}
      </div>
      {/* 전체 내용 */}
      {expanded && (
        <div
          ref={contentRef}
          className="mt-3 whitespace-pre-wrap break-words border-t border-border/50 pt-3 text-sm leading-relaxed text-text-secondary relative"
        >
          {msg.content.map((block, j) => {
            if (block.type === "text" && block.text) {
              const cmdMatch = block.text.match(/<command-name>\/?([\w-]+)<\/command-name>/);
              if (cmdMatch) {
                return (
                  <div key={j} className="my-1.5 inline-flex items-center gap-1.5 rounded-md border border-accent/30 bg-accent/10 px-3 py-1.5 text-[13px]">
                    <span className="font-semibold text-accent">/{cmdMatch[1]}</span>
                    <span className="rounded-sm bg-accent/15 px-1.5 py-px text-[10px] font-medium text-accent">Skill</span>
                  </div>
                );
              }
              return <div key={j}>{block.text}</div>;
            }
            if (block.type === "thinking") {
              return (
                <div
                  key={j}
                  className="text-[13px] italic text-text-muted"
                >
                  {block.text}
                </div>
              );
            }
            if (block.type === "tool_use") {
              const isMcp = block.name?.startsWith("mcp__");
              const isSkill = block.name === "Skill";
              let displayName = block.name || "";
              let badge = "";
              if (isMcp) {
                const parts = displayName.split("__");
                badge = parts[1] || "";
                displayName = parts[2] || displayName;
              }
              if (isSkill && block.input_summary) {
                displayName = block.input_summary.split(" ")[0];
                badge = "Skill";
              }
              return (
                <div
                  key={j}
                  className="my-1.5 rounded-md border border-border/50 bg-bg-tertiary/40 backdrop-blur-sm px-3 py-2 text-[13px]"
                >
                  <span className="font-semibold text-purple">
                    {displayName}
                  </span>
                  {badge && (
                    <span className="ml-1.5 rounded-sm bg-purple/15 px-1.5 py-px text-[10px] font-medium text-purple">
                      {badge}
                    </span>
                  )}
                  {block.input_summary && !isSkill && (
                    <div className="mt-1 truncate font-mono text-xs text-text-muted">
                      {block.input_summary}
                    </div>
                  )}
                </div>
              );
            }
            if (block.type === "tool_result") {
              return (
                <div
                  key={j}
                  className={`my-1.5 max-h-[120px] overflow-hidden rounded-md border bg-bg-tertiary/40 backdrop-blur-sm px-3 py-2 font-mono text-xs ${
                    block.is_error
                      ? "border-red/30 text-red"
                      : "border-border/50 text-text-muted"
                  }`}
                >
                  {block.text || "(no output)"}
                </div>
              );
            }
            return null;
          })}
        </div>
      )}
    </div>
  );
}

const MessageTimeline = ({
  messages,
  page,
  onPageChange,
  toolFilter,
  ref,
}: {
  messages: SessionDetailType["messages"];
  page: number;
  onPageChange: (p: number) => void;
  toolFilter: string | null;
  ref: React.RefObject<HTMLDivElement | null>;
}) => {
  // 대화 턴 단위로 그룹핑 (유저 질문 → 도구 호출 → 결과)
  const filtered = (() => {
    if (!toolFilter) return messages;
    const matchTool = (block: (typeof messages)[number]["content"][number]) => {
      if (block.type !== "tool_use" || !block.name) return false;
      if (toolFilter.startsWith("MCP:")) {
        return block.name.startsWith(`mcp__${toolFilter.slice(4)}__`);
      }
      if (toolFilter.startsWith("Skill:/")) {
        const skillName = toolFilter.slice(7);
        return block.name === "Skill" && block.input_summary?.startsWith(`/${skillName}`);
      }
      return block.name === toolFilter;
    };
    // 유저의 text 메시지를 기준으로 턴 분리
    const turns: (typeof messages)[] = [];
    let current: typeof messages = [];
    for (const msg of messages) {
      const isUserQuestion = msg.role === "user" && msg.content.some((b) => b.type === "text");
      if (isUserQuestion && current.length > 0) {
        turns.push(current);
        current = [];
      }
      current.push(msg);
    }
    if (current.length > 0) turns.push(current);
    // 해당 도구를 사용한 턴만 필터
    return turns.filter((turn) => turn.some((msg) => msg.content.some(matchTool))).flat();
  })();
  const reversed = [...filtered].reverse();
  const total = reversed.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const start = (page - 1) * PAGE_SIZE;
  const pageMessages = reversed.slice(start, start + PAGE_SIZE);

  return (
    <div ref={ref}>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-text-muted">
          Message Timeline ({fmtNum(total)})
        </h3>
        {totalPages > 1 && (
          <span className="text-[13px] text-text-muted">
            {start + 1}-{Math.min(start + PAGE_SIZE, total)} / {fmtNum(total)}
          </span>
        )}
      </div>

      <div className="flex flex-col gap-3">
        {total === 0 ? (
          <div className="px-5 py-15 text-center text-text-muted">
            No messages found
          </div>
        ) : (
          pageMessages.map((msg, i) => {
            const originalIndex = total - (start + i);
            return (
              <MessageCard key={start + i} msg={msg} index={originalIndex} />
            );
          })
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2">
          <button
            disabled={page <= 1}
            onClick={() => onPageChange(1)}
            className="rounded-lg border border-border px-3 py-1.5 text-sm text-text-primary transition-colors hover:bg-bg-tertiary disabled:cursor-not-allowed disabled:opacity-40"
          >
            &laquo;
          </button>
          <button
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            className="rounded-lg border border-border px-3.5 py-1.5 text-sm text-text-primary transition-colors hover:bg-bg-tertiary disabled:cursor-not-allowed disabled:opacity-40"
          >
            &larr; Prev
          </button>
          <span className="text-[13px] text-text-muted">
            {page} / {totalPages}
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
            className="rounded-lg border border-border px-3.5 py-1.5 text-sm text-text-primary transition-colors hover:bg-bg-tertiary disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next &rarr;
          </button>
          <button
            disabled={page >= totalPages}
            onClick={() => onPageChange(totalPages)}
            className="rounded-lg border border-border px-3 py-1.5 text-sm text-text-primary transition-colors hover:bg-bg-tertiary disabled:cursor-not-allowed disabled:opacity-40"
          >
            &raquo;
          </button>
        </div>
      )}
    </div>
  );
};

function BackButton() {
  return (
    <Link
      to="/sessions"
      className="mb-4 inline-flex items-center gap-1.5 rounded-lg border border-border px-3.5 py-1.5 text-[13px] text-text-secondary transition-colors hover:bg-bg-tertiary hover:text-text-primary hover:no-underline"
    >
      &larr; Back to Sessions
    </Link>
  );
}
