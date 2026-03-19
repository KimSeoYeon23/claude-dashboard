import { useEffect, useState, useCallback } from "react";
import { fetchApi, type UsagePredictData } from "../api";
import { fmtTokens } from "../utils/formatters";

function generateDemoPredict(): UsagePredictData {
  return {
    current_rate_per_hour: 2500000,
    predicted_5h_at_reset: 78.5,
    predicted_7d_at_reset: 45.2,
    will_hit_limit_5h: false,
    will_hit_limit_7d: false,
    estimated_limit_time_5h: null,
    estimated_limit_time_7d: null,
  };
}

function PredictBar({ label, pct, willHit }: { label: string; pct: number; willHit: boolean }) {
  const color = pct < 60 ? "#34D399" : pct < 80 ? "#FBBF24" : pct < 95 ? "#FB923C" : "#F87171";
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-xs text-text-muted">{label} 예상</span>
        <span className="font-mono text-xs font-semibold" style={{ color }}>
          {pct}%
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-white/[0.06]">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{
            width: `${Math.min(pct, 100)}%`,
            backgroundColor: color,
            boxShadow: `0 0 8px ${color}40`,
          }}
        />
      </div>
      {willHit && (
        <div className="mt-1 text-[10px] font-medium text-red">리밋 도달 예상</div>
      )}
    </div>
  );
}

export default function UsagePrediction({ isDemo }: { isDemo: boolean }) {
  const [data, setData] = useState<UsagePredictData | null>(null);
  const [error, setError] = useState("");

  const loadData = useCallback(() => {
    if (isDemo) {
      setData(generateDemoPredict());
      return;
    }
    fetchApi<UsagePredictData>("/api/usage/predict")
      .then(setData)
      .catch((e) => setError(e.message));
  }, [isDemo]);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, [loadData]);

  if (error) {
    return (
      <div className="glass-card p-6">
        <div className="text-sm text-red">예측 데이터를 불러올 수 없습니다</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="glass-card flex items-center justify-center p-10">
        <div className="mr-3 h-5 w-5 animate-spin rounded-full border-2 border-border border-t-accent" />
        <span className="text-sm text-text-muted">예측 계산 중...</span>
      </div>
    );
  }

  const fmtLimitTime = (iso: string | null) => {
    if (!iso) return null;
    const d = new Date(iso);
    return d.toLocaleString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="glass-card p-6">
      <h3 className="mb-4 text-sm font-medium text-text-muted">Code Usage Prediction</h3>

      <div className="mb-5 flex items-center gap-3">
        <div className="rounded-lg bg-accent/10 px-3 py-2">
          <div className="text-[10px] text-text-muted">현재 속도</div>
          <div className="font-mono text-sm font-bold text-accent glow-accent">
            {fmtTokens(data.current_rate_per_hour)}/h
          </div>
        </div>
        {data.estimated_limit_time_5h && (
          <div className="rounded-lg bg-red/10 px-3 py-2">
            <div className="text-[10px] text-text-muted">5h 한도 도달</div>
            <div className="font-mono text-sm font-bold text-red">
              {fmtLimitTime(data.estimated_limit_time_5h)}
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-4">
        <PredictBar
          label="5h 리셋 시점"
          pct={data.predicted_5h_at_reset}
          willHit={data.will_hit_limit_5h}
        />
        <PredictBar
          label="7d 리셋 시점"
          pct={data.predicted_7d_at_reset}
          willHit={data.will_hit_limit_7d}
        />
      </div>
    </div>
  );
}
