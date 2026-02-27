import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth";
import { useToast } from "../components/Toast";

export default function Setup() {
  const auth = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [tokenVisible, setTokenVisible] = useState(false);

  const copyToClipboard = useCallback((text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("클립보드에 복사되었습니다");
  }, [toast]);

  // 비로그인 상태면 /login으로 redirect
  if (!auth.token) {
    navigate("/login", { replace: true });
    return null;
  }

  const serverUrl = window.location.origin;
  const hookCommand = `_P=/tmp/claude-projects.tar.gz; (cd "$HOME/.claude/projects" && find . -name '*.jsonl' -not -path '*/subagents/*' -mtime -1 | tar czf "$_P" -T - 2>/dev/null); curl -s -X POST ${serverUrl}/api/sync -H 'Authorization: Bearer ${auth.token}' -F stats=@"$HOME/.claude/stats-cache.json" -F history=@"$HOME/.claude/history.jsonl" $([ -s "$_P" ] && echo "-F projects=@$_P"); rm -f "$_P"`;

  const settingsJson = JSON.stringify(
    {
      hooks: {
        Stop: [{ command: hookCommand }],
      },
    },
    null,
    2
  );

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-mono text-2xl font-bold text-text-primary">Setup Guide</h1>
        <p className="mt-1 text-text-secondary">
          Claude Code 사용 데이터를 이 대시보드에 동기화하세요.
        </p>
      </div>

      {/* Step 1: 로그인 완료 */}
      <section className="glass-card p-6">
        <h2 className="font-mono text-lg font-semibold text-text-primary">
          Step 1. 로그인 완료
        </h2>
        <div className="mt-4 flex flex-col gap-2">
          <p className="text-sm text-green">
            <span className="font-medium">{auth.username}</span>님으로 로그인됨
          </p>
          <div className="rounded-lg border border-border/50 bg-bg-secondary/50 backdrop-blur-sm p-3">
            <div className="flex items-center justify-between">
              <p className="text-xs text-text-muted">내 토큰 (안전하게 보관하세요)</p>
              <div className="flex gap-1">
                <button
                  onClick={() => setTokenVisible((v) => !v)}
                  className="rounded-md border border-border bg-bg-tertiary px-2 py-1 text-xs text-text-secondary transition-colors hover:text-text-primary"
                >
                  {tokenVisible ? "숨기기" : "보기"}
                </button>
                <button
                  onClick={() => copyToClipboard(auth.token!)}
                  className="rounded-md border border-border bg-bg-tertiary px-2 py-1 text-xs text-text-secondary transition-colors hover:text-text-primary"
                >
                  복사
                </button>
              </div>
            </div>
            <code className="mt-1 block break-all text-sm text-accent">
              {tokenVisible ? auth.token : "••••••••••••••••••••••••••••••••"}
            </code>
          </div>
        </div>
      </section>

      {/* Step 2: Hook 설정 */}
      <section className="glass-card p-6">
        <h2 className="font-mono text-lg font-semibold text-text-primary">
          Step 2. Claude Code Hook 설정
        </h2>
        <p className="mt-1 text-sm text-text-secondary">
          아래 내용을 <code className="text-accent">~/.claude/settings.json</code>에 추가하세요.
          Claude Code 세션이 끝날 때마다 자동으로 데이터가 동기화됩니다.
        </p>
        <div className="relative mt-4 rounded-lg border border-border/50 bg-bg-secondary/50 backdrop-blur-sm p-4">
          <pre className="overflow-x-auto text-sm text-text-primary">{settingsJson}</pre>
          <button
            onClick={() => copyToClipboard(settingsJson)}
            className="absolute right-2 top-2 rounded-md border border-border bg-bg-tertiary px-2 py-1 text-xs text-text-secondary transition-colors hover:text-text-primary"
          >
            복사
          </button>
        </div>
      </section>

      {/* Step 3: 확인 */}
      <section className="glass-card p-6">
        <h2 className="font-mono text-lg font-semibold text-text-primary">
          Step 3. 동기화 테스트
        </h2>
        <p className="mt-1 text-sm text-text-secondary">
          터미널에서 아래 명령어를 실행하여 동기화가 되는지 확인하세요.
        </p>
        <div className="relative mt-4 rounded-lg border border-border/50 bg-bg-secondary/50 backdrop-blur-sm p-4">
          <pre className="overflow-x-auto text-sm text-text-primary">{hookCommand}</pre>
          <button
            onClick={() => copyToClipboard(hookCommand)}
            className="absolute right-2 top-2 rounded-md border border-border bg-bg-tertiary px-2 py-1 text-xs text-text-secondary transition-colors hover:text-text-primary"
          >
            복사
          </button>
        </div>
        <p className="mt-3 text-sm text-text-secondary">
          성공하면 <code className="text-green">{'"ok": true'}</code>를 반환합니다.
          이후 <a href="#/dashboard" className="text-accent hover:underline">대시보드</a>에서 내 데이터를 확인할 수 있습니다.
        </p>
      </section>
    </div>
  );
}
