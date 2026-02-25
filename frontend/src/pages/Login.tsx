import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth";
import GoogleLoginButton from "../components/GoogleLoginButton";

export default function Login() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // 이미 로그인 상태면 /setup으로 redirect
  if (auth.token) {
    navigate("/setup", { replace: true });
    return null;
  }

  async function handleGoogleLogin(idToken: string) {
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id_token: idToken }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail || "Google 로그인 실패");
        return;
      }
      auth.login(data.token, data.username);
      navigate("/setup");
    } catch {
      setError("서버에 연결할 수 없습니다");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-3rem)] items-center justify-center">
      <div className="w-full max-w-sm rounded-2xl glass-card p-8">
        {/* 로고 + 제목 */}
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent/10 font-mono text-xl font-bold text-accent glow-accent">
            &gt;_
          </div>
          <h1 className="font-mono text-xl font-bold text-text-primary">
            Claude Code Dashboard
          </h1>
          <p className="text-sm text-text-secondary">
            Google 계정으로 로그인하여 시작하세요
          </p>
        </div>

        {/* Google 로그인 */}
        <div className="mt-8 flex flex-col items-center gap-4">
          {loading && (
            <p className="text-sm text-text-secondary">로그인 중...</p>
          )}
          {error && <p className="text-sm text-red">{error}</p>}
          <GoogleLoginButton onSuccess={handleGoogleLogin} />
        </div>
      </div>
    </div>
  );
}
