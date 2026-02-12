import { useEffect, useState, useRef } from "react";
import { Link, useParams } from "react-router-dom";
import { fetchApi, type SessionDetail as SessionDetailType } from "../api";
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

  const toolEntries = Object.entries(data.toolCalls || {}).sort(
    (a, b) => b[1] - a[1],
  );
  const totalCalls = Object.values(data.toolCalls || {}).reduce(
    (a, b) => a + b,
    0,
  );

  return (
    <>
      <BackButton />

      {/* Header */}
      <div className="mb-6">
        <h2 className="mb-1 break-all text-xl font-bold text-text-primary">
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
            <span
              key={name}
              className="inline-flex items-center gap-1.5 rounded-2xl border border-border bg-bg-tertiary px-3 py-1 text-[13px] text-text-secondary"
            >
              {name}
              <span className="rounded-xl bg-accent px-1.5 py-px text-[11px] font-bold text-white">
                {count}
              </span>
            </span>
          ))}
        </div>
      )}

      {/* Modified Files */}
      {(data.filesModified || []).length > 0 && (
        <div className="mb-6 rounded-lg border border-border bg-bg-card px-5 py-4">
          <h3 className="mb-3 text-sm font-semibold text-text-secondary">
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
          <h3 className="mb-3 text-sm font-semibold text-text-secondary">
            Subagents ({data.subagentIds.length})
          </h3>
          <div className="flex flex-wrap gap-2">
            {data.subagentIds.map((sid) => (
              <span
                key={sid}
                className="inline-block rounded-2xl border border-border bg-bg-tertiary px-3 py-1 font-mono text-xs text-text-muted"
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
        ref={timelineRef}
      />
    </>
  );
}

const MessageTimeline = ({
  messages,
  page,
  onPageChange,
  ref,
}: {
  messages: SessionDetailType["messages"];
  page: number;
  onPageChange: (p: number) => void;
  ref: React.RefObject<HTMLDivElement | null>;
}) => {
  const total = messages.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const start = (page - 1) * PAGE_SIZE;
  const pageMessages = messages.slice(start, start + PAGE_SIZE);

  return (
    <div ref={ref}>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-text-secondary">
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
                key={start + i}
                className={`rounded-lg border border-border border-l-[3px] ${roleClass} bg-bg-card px-[18px] py-3.5 shadow-[0_1px_3px_rgba(0,0,0,.3)]`}
              >
                <div className="mb-2 flex items-center gap-2">
                  <span
                    className={`rounded px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ${tagClass}`}
                  >
                    {msg.role}
                  </span>
                  <span className="text-[11px] text-text-muted">
                    {fmtDateTime(msg.timestamp)}
                  </span>
                  <span className="text-[11px] text-text-muted">
                    #{start + i + 1}
                  </span>
                </div>
                <div className="whitespace-pre-wrap break-words text-sm leading-relaxed text-text-secondary">
                  {(msg.content || []).length === 0 ? (
                    <span className="text-text-muted">(empty)</span>
                  ) : (
                    msg.content.map((block, j) => {
                      if (block.type === "text" && block.text) {
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
                        return (
                          <div
                            key={j}
                            className="my-1.5 rounded-md border border-border bg-bg-tertiary px-3 py-2 text-[13px]"
                          >
                            <span className="font-semibold text-purple">
                              {block.name}
                            </span>
                            {block.input_summary && (
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
                            className={`my-1.5 max-h-[120px] overflow-hidden rounded-md border bg-bg-tertiary px-3 py-2 font-mono text-xs ${
                              block.is_error
                                ? "border-red text-red"
                                : "border-border text-text-muted"
                            }`}
                          >
                            {block.text || "(no output)"}
                          </div>
                        );
                      }
                      return null;
                    })
                  )}
                </div>
              </div>
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
            className="rounded-lg border border-border bg-bg-tertiary px-3 py-1.5 text-sm text-text-primary transition-all hover:border-accent hover:bg-accent hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            &laquo;
          </button>
          <button
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            className="rounded-lg border border-border bg-bg-tertiary px-3.5 py-1.5 text-sm text-text-primary transition-all hover:border-accent hover:bg-accent hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            &larr; Prev
          </button>
          <span className="text-[13px] text-text-muted">
            {page} / {totalPages}
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
            className="rounded-lg border border-border bg-bg-tertiary px-3.5 py-1.5 text-sm text-text-primary transition-all hover:border-accent hover:bg-accent hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next &rarr;
          </button>
          <button
            disabled={page >= totalPages}
            onClick={() => onPageChange(totalPages)}
            className="rounded-lg border border-border bg-bg-tertiary px-3 py-1.5 text-sm text-text-primary transition-all hover:border-accent hover:bg-accent hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
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
      className="mb-4 inline-flex items-center gap-1.5 rounded-lg border border-border bg-bg-tertiary px-3.5 py-1.5 text-[13px] text-text-secondary transition-all hover:border-accent hover:text-text-primary hover:no-underline"
    >
      &larr; Back to Sessions
    </Link>
  );
}
