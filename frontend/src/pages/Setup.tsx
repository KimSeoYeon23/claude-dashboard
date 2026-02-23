import { useState } from "react";
import { useAuth } from "../auth";

export default function Setup() {
  const auth = useAuth();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [token, setToken] = useState(auth.token || "");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // 토큰으로 로그인 (기존 유저)
  const [loginToken, setLoginToken] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [showLogin, setShowLogin] = useState(false);

  const serverUrl = window.location.origin;

  const activeToken = token || "YOUR_TOKEN";
  const hookCommand = `curl -s -X POST ${serverUrl}/api/sync -H 'Authorization: Bearer ${activeToken}' -F stats=@$HOME/.claude/stats-cache.json -F history=@$HOME/.claude/history.jsonl`;

  const settingsJson = JSON.stringify(
    {
      hooks: {
        stop: [{ command: hookCommand }],
      },
    },
    null,
    2
  );

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail || "등록 실패");
        return;
      }
      setToken(data.token);
      auth.login(data.token, data.username);
    } catch {
      setError("서버에 연결할 수 없습니다");
    } finally {
      setLoading(false);
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginError("");
    setLoginLoading(true);
    try {
      const res = await fetch("/api/me", {
        headers: { Authorization: `Bearer ${loginToken}` },
      });
      const data = await res.json();
      if (!res.ok) {
        setLoginError(data.detail || "유효하지 않은 토큰입니다");
        return;
      }
      setToken(loginToken);
      auth.login(loginToken, data.username);
    } catch {
      setLoginError("서버에 연결할 수 없습니다");
    } finally {
      setLoginLoading(false);
    }
  }

  const isLoggedIn = !!auth.token;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Setup Guide</h1>
        <p className="mt-1 text-text-secondary">
          Claude Code 사용 데이터를 이 대시보드에 동기화하세요.
        </p>
      </div>

      {/* Step 1: 등록 / 로그인 */}
      <section className="rounded-xl border border-border bg-bg-card p-6">
        <h2 className="text-lg font-semibold text-text-primary">
          Step 1. {isLoggedIn ? "로그인 완료" : "등록 또는 로그인"}
        </h2>

        {isLoggedIn ? (
          <div className="mt-4 flex flex-col gap-2">
            <p className="text-sm text-green">
              <span className="font-medium">{auth.username}</span>님으로 로그인됨
            </p>
            <div className="rounded-lg border border-border bg-bg-secondary p-3">
              <p className="text-xs text-text-muted">내 토큰 (안전하게 보관하세요)</p>
              <code className="mt-1 block break-all text-sm text-accent">
                {token}
              </code>
            </div>
          </div>
        ) : !showLogin ? (
          <>
            <p className="mt-1 text-sm text-text-secondary">
              유저명을 입력하면 토큰이 발급됩니다.
            </p>
            <form onSubmit={handleRegister} className="mt-4 flex flex-col gap-3">
              <input
                type="text"
                placeholder="유저명 (예: kimsy)"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                minLength={2}
                className="rounded-lg border border-border bg-bg-secondary px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
              />
              <input
                type="email"
                placeholder="이메일 (선택, 에러 알림용)"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="rounded-lg border border-border bg-bg-secondary px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
              />
              {error && <p className="text-sm text-red">{error}</p>}
              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-fit rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  {loading ? "등록 중..." : "토큰 발급"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowLogin(true)}
                  className="text-sm text-text-muted hover:text-text-secondary"
                >
                  이미 토큰이 있나요?
                </button>
              </div>
            </form>
          </>
        ) : (
          <>
            <p className="mt-1 text-sm text-text-secondary">
              발급받은 토큰을 입력하세요.
            </p>
            <form onSubmit={handleLogin} className="mt-4 flex flex-col gap-3">
              <input
                type="text"
                placeholder="토큰 입력"
                value={loginToken}
                onChange={(e) => setLoginToken(e.target.value)}
                required
                className="rounded-lg border border-border bg-bg-secondary px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
              />
              {loginError && <p className="text-sm text-red">{loginError}</p>}
              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  disabled={loginLoading}
                  className="w-fit rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  {loginLoading ? "확인 중..." : "로그인"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowLogin(false)}
                  className="text-sm text-text-muted hover:text-text-secondary"
                >
                  신규 등록하기
                </button>
              </div>
            </form>
          </>
        )}
      </section>

      {/* Step 2: Hook 설정 */}
      <section className="rounded-xl border border-border bg-bg-card p-6">
        <h2 className="text-lg font-semibold text-text-primary">
          Step 2. Claude Code Hook 설정
        </h2>
        <p className="mt-1 text-sm text-text-secondary">
          아래 내용을 <code className="text-accent">~/.claude/settings.json</code>에 추가하세요.
          Claude Code 세션이 끝날 때마다 자동으로 데이터가 동기화됩니다.
        </p>
        <div className="relative mt-4 rounded-lg border border-border bg-bg-secondary p-4">
          <pre className="overflow-x-auto text-sm text-text-primary">
            {settingsJson}
          </pre>
          <button
            onClick={() => navigator.clipboard.writeText(settingsJson)}
            className="absolute right-2 top-2 rounded-md border border-border bg-bg-tertiary px-2 py-1 text-xs text-text-secondary transition-colors hover:text-text-primary"
          >
            복사
          </button>
        </div>
      </section>

      {/* Step 3: 확인 */}
      <section className="rounded-xl border border-border bg-bg-card p-6">
        <h2 className="text-lg font-semibold text-text-primary">
          Step 3. 동기화 테스트
        </h2>
        <p className="mt-1 text-sm text-text-secondary">
          터미널에서 아래 명령어를 실행하여 동기화가 되는지 확인하세요.
        </p>
        <div className="relative mt-4 rounded-lg border border-border bg-bg-secondary p-4">
          <pre className="overflow-x-auto text-sm text-text-primary">
            {hookCommand}
          </pre>
          <button
            onClick={() => navigator.clipboard.writeText(hookCommand)}
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
