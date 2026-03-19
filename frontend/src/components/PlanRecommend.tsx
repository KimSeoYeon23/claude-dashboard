import { useEffect, useState, useCallback } from "react";
import { fetchApi, type PlanRecommendData } from "../api";
import { fmtTokens } from "../utils/formatters";

const PATTERN_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  none: { label: "No Data", color: "text-text-muted", bg: "bg-white/5" },
  light: { label: "Light", color: "text-green", bg: "bg-green/10" },
  moderate: { label: "Moderate", color: "text-accent", bg: "bg-accent/10" },
  heavy: { label: "Heavy", color: "text-orange", bg: "bg-orange/10" },
  power: { label: "Power", color: "text-red", bg: "bg-red/10" },
};

function generateDemoPlan(): PlanRecommendData {
  return {
    current_plan: "Max 5x",
    avg_daily_tokens: 25000000,
    peak_daily_tokens: 80000000,
    recommendation: {
      plan: "Pro",
      reason: "최근 14일 평균 사용량이 Pro 한도 내에 있습니다",
      monthly_savings: 80,
    },
    usage_pattern: "light",
  };
}

export default function PlanRecommend({ isDemo }: { isDemo: boolean }) {
  const [data, setData] = useState<PlanRecommendData | null>(null);
  const [error, setError] = useState("");

  const loadData = useCallback(() => {
    if (isDemo) {
      setData(generateDemoPlan());
      return;
    }
    fetchApi<PlanRecommendData>("/api/usage/plan-recommend")
      .then(setData)
      .catch((e) => setError(e.message));
  }, [isDemo]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (error) {
    return (
      <div className="glass-card p-6">
        <div className="text-sm text-red">플랜 추천 데이터를 불러올 수 없습니다</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="glass-card flex items-center justify-center p-10">
        <div className="mr-3 h-5 w-5 animate-spin rounded-full border-2 border-border border-t-accent" />
        <span className="text-sm text-text-muted">플랜 분석 중...</span>
      </div>
    );
  }

  const pattern = PATTERN_CONFIG[data.usage_pattern] || PATTERN_CONFIG.moderate;
  const rec = data.recommendation;
  const isSamePlan = rec && rec.plan === data.current_plan;

  return (
    <div className="glass-card p-6">
      <h3 className="mb-4 text-sm font-medium text-text-muted">Plan Recommendation</h3>

      <div className="mb-4 flex items-center gap-3">
        <div>
          <div className="text-xs text-text-muted">현재 플랜</div>
          <div className="font-mono text-lg font-bold text-text-primary">{data.current_plan}</div>
        </div>
        <span className={`ml-auto rounded-full px-3 py-1 text-xs font-semibold ${pattern.color} ${pattern.bg}`}>
          {pattern.label} User
        </span>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3">
        <div className="rounded-lg bg-white/[0.03] px-3 py-2">
          <div className="text-[10px] text-text-muted">일 평균</div>
          <div className="font-mono text-sm font-semibold text-text-secondary">{fmtTokens(data.avg_daily_tokens)}</div>
        </div>
        <div className="rounded-lg bg-white/[0.03] px-3 py-2">
          <div className="text-[10px] text-text-muted">일 최대</div>
          <div className="font-mono text-sm font-semibold text-text-secondary">{fmtTokens(data.peak_daily_tokens)}</div>
        </div>
      </div>

      {rec ? (
        <div className={`rounded-xl border p-4 ${isSamePlan ? "border-green/30 bg-green/5" : "border-accent/30 bg-accent/5"}`}>
          {isSamePlan ? (
            <div className="text-sm text-green">현재 플랜이 최적입니다</div>
          ) : (
            <>
              <div className="mb-1 flex items-center gap-2">
                <span className="text-xs text-text-muted">추천</span>
                <span className="font-mono text-base font-bold text-accent glow-accent">
                  {rec.plan}
                </span>
              </div>
              <p className="mb-2 text-xs leading-relaxed text-text-secondary">
                {rec.reason}
              </p>
              {rec.monthly_savings > 0 && (
                <div className="flex items-center gap-1">
                  <span className="text-xs text-text-muted">예상 절약</span>
                  <span className="font-mono text-sm font-bold text-green glow-green">
                    ${rec.monthly_savings}/월
                  </span>
                </div>
              )}
            </>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-border/30 bg-white/[0.02] p-4 text-sm text-text-muted">
          충분한 데이터가 쌓이면 플랜을 추천해드립니다
        </div>
      )}
    </div>
  );
}
