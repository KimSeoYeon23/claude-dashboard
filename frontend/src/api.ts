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

// ── Fetch wrapper ──

export async function fetchApi<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json() as Promise<T>;
}
