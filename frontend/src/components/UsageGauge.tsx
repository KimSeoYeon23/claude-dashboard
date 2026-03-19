import { useEffect, useState, useCallback, useRef } from "react";
import { fetchApi, type UsageGaugeData, type UsageWindow } from "../api";
import { fmtTokens } from "../utils/formatters";
import UsageSettings from "./UsageSettings";

function gaugeColor(pct: number): string {
  if (pct < 60) return "#34D399";
  if (pct < 80) return "#FBBF24";
  if (pct < 95) return "#FB923C";
  return "#F87171";
}

function fmtCountdown(seconds: number): string {
  if (seconds <= 0) return "리셋 완료";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 24) {
    const d = Math.floor(h / 24);
    return `${d}일 ${h % 24}시간`;
  }
  return `${h}시간 ${m.toString().padStart(2, "0")}분 ${s.toString().padStart(2, "0")}초`;
}

function generateDemoGauge(): UsageGaugeData {
  return {
    window_5h: {
      used_tokens: 12500000,
      limit_tokens: 45000000,
      percentage: 27.8,
      reset_at: new Date(Date.now() + 3600000).toISOString(),
      remaining_seconds: 3600,
    },
    window_7d: {
      used_tokens: 150000000,
      limit_tokens: 500000000,
      percentage: 30.0,
      reset_at: new Date(Date.now() + 518400000).toISOString(),
      remaining_seconds: 518400,
    },
  };
}

function GaugeRing({ window, label }: { window: UsageWindow; label: string }) {
  const [countdown, setCountdown] = useState(window.remaining_seconds);
  const timerRef = useRef<ReturnType<typeof setInterval>>(undefined);

  useEffect(() => {
    setCountdown(window.remaining_seconds);
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCountdown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [window.remaining_seconds]);

  const color = gaugeColor(window.percentage);
  const radius = 70;
  const circumference = Math.PI * radius;
  const dashOffset = circumference - (circumference * Math.min(window.percentage, 100)) / 100;

  return (
    <div className="flex flex-col items-center">
      <div className="relative h-[100px] w-[160px]">
        <svg viewBox="0 0 160 100" className="h-full w-full">
          {/* Background arc */}
          <path
            d="M 10 90 A 70 70 0 0 1 150 90"
            fill="none"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth="10"
            strokeLinecap="round"
          />
          {/* Value arc */}
          <path
            d="M 10 90 A 70 70 0 0 1 150 90"
            fill="none"
            stroke={color}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={`${circumference}`}
            strokeDashoffset={dashOffset}
            style={{
              filter: `drop-shadow(0 0 6px ${color}40)`,
              transition: "stroke-dashoffset 0.8s ease, stroke 0.3s ease",
            }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-end pb-1">
          <span className="font-mono text-2xl font-bold text-text-primary" style={{ color }}>
            {window.percentage}%
          </span>
        </div>
      </div>
      <div className="mt-1 text-xs font-medium text-text-muted">{label}</div>
      <div className="mt-0.5 font-mono text-[11px] text-text-secondary">
        {fmtTokens(window.used_tokens)} / {fmtTokens(window.limit_tokens)}
      </div>
      <div className="mt-2 rounded-lg bg-white/[0.03] px-3 py-1.5">
        <div className="text-[10px] text-text-muted">리셋까지</div>
        <div className="font-mono text-xs font-semibold text-text-primary">
          {fmtCountdown(countdown)}
        </div>
      </div>
    </div>
  );
}

// Web Push 알림
function checkAndNotify(data: UsageGaugeData) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  const { window_5h, window_7d } = data;
  if (window_5h.percentage >= 95) {
    new Notification("Claude Usage Alert", {
      body: `5시간 윈도우 ${window_5h.percentage}% 도달 — 리밋 임박!`,
      icon: "/favicon.ico",
    });
  } else if (window_5h.percentage >= 80) {
    new Notification("Claude Usage Warning", {
      body: `5시간 윈도우 ${window_5h.percentage}% 도달 — 속도 조절을 고려하세요`,
      icon: "/favicon.ico",
    });
  }
  if (window_7d.percentage >= 95) {
    new Notification("Claude Usage Alert", {
      body: `7일 윈도우 ${window_7d.percentage}% 도달 — 리밋 임박!`,
      icon: "/favicon.ico",
    });
  }
}

export default function UsageGauge({ isDemo }: { isDemo: boolean }) {
  const [data, setData] = useState<UsageGaugeData | null>(null);
  const [error, setError] = useState("");
  const lastNotifiedRef = useRef<string>("");

  const loadData = useCallback(() => {
    if (isDemo) {
      setData(generateDemoGauge());
      return;
    }
    fetchApi<UsageGaugeData>("/api/usage/gauge")
      .then((d) => {
        setData(d);
        const key = `${Math.floor(d.window_5h.percentage / 5)}-${Math.floor(d.window_7d.percentage / 5)}`;
        if (key !== lastNotifiedRef.current) {
          checkAndNotify(d);
          lastNotifiedRef.current = key;
        }
      })
      .catch((e) => setError(e.message));
  }, [isDemo]);

  useEffect(() => {
    // 알림 권한 요청
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
    loadData();
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
  }, [loadData]);

  if (error) {
    return (
      <div className="glass-card p-6">
        <div className="text-sm text-red">사용량 데이터를 불러올 수 없습니다</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="glass-card flex items-center justify-center p-10">
        <div className="mr-3 h-5 w-5 animate-spin rounded-full border-2 border-border border-t-accent" />
        <span className="text-sm text-text-muted">사용량 로딩 중...</span>
      </div>
    );
  }

  return (
    <div className="glass-card p-6">
      <h3 className="mb-3 text-center text-sm font-medium text-text-muted">Claude Code Usage</h3>
      <div className="mb-4 rounded-lg bg-white/[0.05] px-3 py-2.5 text-[11px] leading-5 text-gray-400">
        <span className="font-semibold text-gray-300">집계</span>
        {" "}output + cache creation 토큰 기준 · Stop 훅 동기화분만 반영
        <br />
        <span className="font-semibold text-gray-300">오차</span>
        {" "}진행 중 세션·웹·Cowork 미포함 · ±5% 가능 · 정확한 수치는 claude.ai 확인
      </div>
      <div className="flex items-start justify-center gap-10 max-sm:flex-col max-sm:items-center max-sm:gap-6">
        <GaugeRing window={data.window_5h} label="5-Hour Window" />
        <GaugeRing window={data.window_7d} label="7-Day Window" />
      </div>
      {!isDemo && <UsageSettings onSaved={loadData} />}
    </div>
  );
}
