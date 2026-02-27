import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth";
import { useToast } from "../components/Toast";

function CodeBlock({ code, onCopy }: { code: string; onCopy: () => void }) {
  return (
    <div className="relative mt-4 rounded-lg border border-border/50 bg-bg-secondary/50 backdrop-blur-sm p-4">
      <pre className="overflow-x-auto text-sm text-text-primary whitespace-pre-wrap break-all">{code}</pre>
      <button
        onClick={onCopy}
        className="absolute right-2 top-2 rounded-md border border-border bg-bg-tertiary px-2 py-1 text-xs text-text-secondary transition-colors hover:text-text-primary"
      >
        복사
      </button>
    </div>
  );
}

function OsTabs({ value, onChange }: { value: "mac" | "windows"; onChange: (v: "mac" | "windows") => void }) {
  const base = "rounded-md px-3 py-1 text-xs font-medium transition-colors";
  const active = "bg-accent/15 text-accent";
  const inactive = "text-text-muted hover:text-text-secondary";
  return (
    <div className="flex gap-1 rounded-lg border border-border/50 bg-bg-secondary/50 p-1 w-fit">
      <button onClick={() => onChange("mac")} className={`${base} ${value === "mac" ? active : inactive}`}>
        macOS / Linux
      </button>
      <button onClick={() => onChange("windows")} className={`${base} ${value === "windows" ? active : inactive}`}>
        Windows
      </button>
    </div>
  );
}

export default function Setup() {
  const auth = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [tokenVisible, setTokenVisible] = useState(false);
  const [os, setOs] = useState<"mac" | "windows">("mac");

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

  // ── macOS / Linux ──
  const bashCommand = `_P=/tmp/claude-projects.tar.gz; (cd "$HOME/.claude/projects" && find . -name '*.jsonl' -not -path '*/subagents/*' -mtime -1 | tar czf "$_P" -T - 2>/dev/null); curl -s -X POST ${serverUrl}/api/sync -H 'Authorization: Bearer ${auth.token}' -F stats=@"$HOME/.claude/stats-cache.json" -F history=@"$HOME/.claude/history.jsonl" $([ -s "$_P" ] && echo "-F projects=@$_P"); rm -f "$_P"`;

  const bashSettingsJson = JSON.stringify(
    {
      hooks: {
        Stop: [
          {
            hooks: [
              { type: "command", command: bashCommand },
            ],
          },
        ],
      },
    },
    null,
    2
  );

  // ── Windows ──
  const psScript = `$statsPath = "$env:USERPROFILE\\.claude\\stats-cache.json"
$historyPath = "$env:USERPROFILE\\.claude\\history.jsonl"
$projDir = "$env:USERPROFILE\\.claude\\projects"
$P = "$env:TEMP\\claude-projects.tar.gz"

$curlArgs = @(
    '-s', '-X', 'POST',
    '${serverUrl}/api/sync',
    '-H', "Authorization: Bearer ${auth.token}"
)

if (Test-Path $statsPath) { $curlArgs += '-F', "stats=@$statsPath" }
if (Test-Path $historyPath) { $curlArgs += '-F', "history=@$historyPath" }

if (Test-Path $projDir) {
    $files = Get-ChildItem $projDir -Recurse -Filter *.jsonl |
        Where-Object { $_.FullName -notmatch 'subagents' -and $_.LastWriteTime -gt (Get-Date).AddDays(-1) }
    if ($files) {
        $list = "$env:TEMP\\claude-files.txt"
        $files.FullName | Out-File $list -Encoding utf8
        tar czf $P -C $projDir -T $list 2>$null
        Remove-Item $list -ErrorAction SilentlyContinue
        if (Test-Path $P) { $curlArgs += '-F', "projects=@$P" }
    }
}

& curl.exe @curlArgs

Remove-Item $P -ErrorAction SilentlyContinue`;

  const winSettingsJson = JSON.stringify(
    {
      hooks: {
        Stop: [
          {
            hooks: [
              {
                type: "command",
                command: 'powershell -ExecutionPolicy Bypass -File "%USERPROFILE%\\.claude\\sync.ps1"',
              },
            ],
          },
        ],
      },
    },
    null,
    2
  );

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-mono text-2xl font-bold text-text-primary">Setup Guide</h1>
          <p className="mt-1 text-text-secondary">
            Claude Code 사용 데이터를 이 대시보드에 동기화하세요.
          </p>
        </div>
        <OsTabs value={os} onChange={setOs} />
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

      {/* Step 2: /stats 실행 (권장) */}
      <section className="glass-card p-6">
        <h2 className="font-mono text-lg font-semibold text-text-primary">
          Step 2. /stats 실행
          <span className="ml-2 rounded-md bg-orange/15 px-2 py-0.5 text-xs font-medium text-orange">권장</span>
        </h2>
        <p className="mt-1 text-sm text-text-secondary">
          Claude Code 터미널에서 <code className="text-accent">/stats</code> 명령어를 한 번 실행하세요.
          이 명령어는 <code className="text-accent">stats-cache.json</code> 파일을 생성하며,
          모델별 토큰 사용량, 비용, 도구 호출 횟수 등 상세한 통계 데이터를 포함합니다.
        </p>
        <div className="mt-3 rounded-lg border border-border/50 bg-bg-secondary/50 backdrop-blur-sm p-3">
          <code className="text-sm text-accent">/stats</code>
        </div>
        <p className="mt-3 text-sm text-text-muted">
          실행하지 않아도 대시보드는 동작하지만, 세션/메시지 수 등 기본 통계만 표시됩니다.
          <code className="text-accent">/stats</code>를 실행하면 모델 사용량, 비용 분석 등 전체 통계를 확인할 수 있습니다.
        </p>
      </section>

      {/* Step 3: Hook 설정 */}
      <section className="glass-card p-6">
        <h2 className="font-mono text-lg font-semibold text-text-primary">
          Step 3. Claude Code Hook 설정
        </h2>

        {os === "mac" ? (
          <>
            <p className="mt-1 text-sm text-text-secondary">
              아래 내용을 <code className="text-accent">~/.claude/settings.json</code>에 추가하세요.
              Claude Code 세션이 끝날 때마다 자동으로 데이터가 동기화됩니다.
            </p>
            <CodeBlock code={bashSettingsJson} onCopy={() => copyToClipboard(bashSettingsJson)} />
          </>
        ) : (
          <>
            <p className="mt-1 text-sm text-text-secondary">
              두 파일을 설정해야 합니다.
            </p>

            {/* sync.ps1 */}
            <h3 className="mt-4 text-sm font-medium text-text-secondary">
              1. 동기화 스크립트 생성
            </h3>
            <p className="mt-1 text-sm text-text-muted">
              아래 내용을 <code className="text-accent">%USERPROFILE%\.claude\sync.ps1</code> 파일로 저장하세요.
            </p>
            <CodeBlock code={psScript} onCopy={() => copyToClipboard(psScript)} />

            {/* settings.json */}
            <h3 className="mt-6 text-sm font-medium text-text-secondary">
              2. Hook 설정 추가
            </h3>
            <p className="mt-1 text-sm text-text-muted">
              아래 내용을 <code className="text-accent">%USERPROFILE%\.claude\settings.json</code>에 추가하세요.
            </p>
            <CodeBlock code={winSettingsJson} onCopy={() => copyToClipboard(winSettingsJson)} />
          </>
        )}
      </section>

      {/* Step 4: 확인 */}
      <section className="glass-card p-6">
        <h2 className="font-mono text-lg font-semibold text-text-primary">
          Step 4. 동기화 테스트
        </h2>
        <p className="mt-1 text-sm text-text-secondary">
          터미널에서 아래 명령어를 실행하여 동기화가 되는지 확인하세요.
        </p>

        {os === "mac" ? (
          <CodeBlock code={bashCommand} onCopy={() => copyToClipboard(bashCommand)} />
        ) : (
          <>
            <CodeBlock
              code={`powershell -ExecutionPolicy Bypass -File "$env:USERPROFILE\\.claude\\sync.ps1"`}
              onCopy={() => copyToClipboard(`powershell -ExecutionPolicy Bypass -File "$env:USERPROFILE\\.claude\\sync.ps1"`)}
            />
          </>
        )}

        <p className="mt-3 text-sm text-text-secondary">
          성공하면 <code className="text-green">{'"ok": true'}</code>를 반환합니다.
          이후 <a href="#/dashboard" className="text-accent hover:underline">대시보드</a>에서 내 데이터를 확인할 수 있습니다.
        </p>
      </section>
    </div>
  );
}
