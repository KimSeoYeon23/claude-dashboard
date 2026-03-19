// ── API Types ──

export interface DailyActivity {
  date: string;
  messageCount: number;
  toolCallCount: number;
}

export interface ModelUsageEntry {
  inputTokens: number;
  outputTokens: number;
}

export interface Stats {
  totalSessions: number;
  totalMessages: number;
  firstSessionDate: string;
  dailyActivity: DailyActivity[];
  hourCounts: Record<string, number>;
  modelUsage: Record<string, ModelUsageEntry>;
}

export interface Session {
  sessionId: string;
  project: string;
  display: string;
  timestamp: string;
}

export interface SessionsResponse {
  sessions: Session[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface Project {
  name: string;
  path: string;
  sessionCount: number;
}

export interface AgentActivity {
  role: string;
  type: "message" | "tool_call";
  summary: string;
  fullText?: string;
  timestamp: string;
}

export interface Agent {
  pid: number;
  tty: string;
  cwd: string;
  owner: string;
  project: string;
  sessionId: string | null;
  firstMessage: string;
  model: string;
  cpu: string;
  mem: string;
  started: string;
  recentActivity: AgentActivity[];
  toolUsage?: Record<string, number>;
}

export interface ContentBlock {
  type: "text" | "thinking" | "tool_use" | "tool_result";
  text?: string;
  name?: string;
  input_summary?: string;
  tool_use_id?: string;
  is_error?: boolean;
}

export interface Message {
  role: string;
  timestamp: string;
  content: ContentBlock[];
}

export interface SessionDetail {
  sessionId: string;
  model: string;
  messageCount: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  toolCalls: Record<string, number>;
  filesModified: string[];
  durationMs: number;
  startTimestamp: string;
  endTimestamp: string;
  messages: Message[];
  subagentIds: string[];
}

// ── Usage Types ──

export interface UsageWindow {
  used_tokens: number;
  limit_tokens: number;
  percentage: number;
  reset_at: string | null;
  remaining_seconds: number;
}

export interface UsageGaugeData {
  window_5h: UsageWindow;
  window_7d: UsageWindow;
}

export interface UsagePredictData {
  current_rate_per_hour: number;
  predicted_5h_at_reset: number;
  predicted_7d_at_reset: number;
  will_hit_limit_5h: boolean;
  will_hit_limit_7d: boolean;
  estimated_limit_time_5h: string | null;
  estimated_limit_time_7d: string | null;
}

export interface HeatmapCell {
  day: number;
  hour: number;
  tokens: number;
  sessions: number;
}

export interface UsageHeatmapData {
  heatmap: HeatmapCell[];
  period_days: number;
}

export interface PlanRecommendData {
  current_plan: string;
  avg_daily_tokens: number;
  peak_daily_tokens: number;
  recommendation: {
    plan: string;
    reason: string;
    monthly_savings: number;
  } | null;
  usage_pattern: string;
}

// ── Axios instance ──

import axios, { AxiosHeaders } from "axios";

function getToken(): string | null {
  const match = document.cookie.match(/(?:^|; )token=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : null;
}

export function getAuthHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export const api = axios.create();

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    const headers = AxiosHeaders.from(config.headers);
    headers.set("Authorization", `Bearer ${token}`);
    config.headers = headers;
  }
  return config;
});

// ── Error reporting ──

export async function reportError(
  type: string,
  message: string,
  extra?: { stack?: string; url?: string; componentStack?: string },
) {
  try {
    const stack = [extra?.stack, extra?.componentStack].filter(Boolean).join("\n\n");
    await api.post("/api/report-error", {
      type,
      message,
      url: extra?.url ?? window.location.href,
      stack: stack || undefined,
    });
  } catch {
    // 에러 리포팅 실패는 무시
  }
}

// ── Fetch wrapper ──

export async function fetchApi<T>(path: string): Promise<T> {
  try {
    const res = await api.get<T>(path);
    return res.data;
  } catch (err) {
    if (axios.isAxiosError(err) && err.response) {
      const errMsg = `API ${err.response.status}: ${path}`;
      reportError("api_error", errMsg);
      throw new Error(`API ${err.response.status}`);
    }
    throw err;
  }
}
