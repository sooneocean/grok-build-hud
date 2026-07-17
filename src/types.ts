export interface ActiveSessionEntry {
  session_id: string;
  pid?: number;
  cwd?: string;
  opened_at?: string;
}

export interface SessionSignals {
  contextWindowUsage?: number;
  contextTokensUsed?: number;
  contextWindowTokens?: number;
  turnCount?: number;
  toolCallCount?: number;
  toolFailureCount?: number;
  errorCount?: number;
  userMessageCount?: number;
  assistantMessageCount?: number;
  toolsUsed?: string[];
  modelsUsed?: string[];
  primaryModelId?: string;
  sessionDurationSeconds?: number;
  agentLinesAdded?: number;
  agentLinesRemoved?: number;
  compactionCount?: number;
  avgTimeToFirstTokenMs?: number;
  [key: string]: unknown;
}

export interface SessionSummary {
  info?: { id?: string; cwd?: string };
  session_summary?: string;
  generated_title?: string;
  current_model_id?: string;
  head_branch?: string;
  git_root_dir?: string;
  last_active_at?: string;
  updated_at?: string;
  created_at?: string;
  agent_name?: string;
  reasoning_effort?: string;
  sandbox_profile?: string;
  [key: string]: unknown;
}

export interface ToolActivityItem {
  id: string;
  name: string;
  status: "running" | "completed" | "failed" | "unknown";
  detail?: string;
  count?: number;
}

export interface AgentActivityItem {
  id?: string;
  title?: string;
  status?: string;
  detail?: string;
}

export interface TodoItem {
  content: string;
  status: "pending" | "in_progress" | "completed" | "cancelled" | string;
  id?: string;
}

export interface SessionSnapshot {
  sessionId: string;
  sessionDir: string;
  cwd: string;
  model: string;
  title?: string;
  branch?: string;
  gitDirty?: boolean;
  gitAhead?: number;
  gitBehind?: number;
  live: boolean;
  pid?: number;
  contextPercent: number;
  contextTokensUsed: number;
  contextWindowTokens: number;
  turnCount: number;
  userMessageCount: number;
  toolCallCount: number;
  toolFailureCount: number;
  errorCount: number;
  durationSeconds: number;
  agentLinesAdded: number;
  agentLinesRemoved: number;
  compactionCount: number;
  avgTtftMs: number;
  agentName?: string;
  reasoningEffort?: string;
  tools: ToolActivityItem[];
  agents: AgentActivityItem[];
  todos: TodoItem[];
  signals: SessionSignals;
  summary?: SessionSummary;
}

export interface UsageSnapshot {
  available: boolean;
  percent?: number;
  used?: number;
  limit?: number;
  period?: string;
  resetsIn?: string;
  message?: string;
  source?: string;
}

export interface RenderOptions {
  color: boolean;
  tmux: boolean;
  compact: boolean;
  pathLevels: number;
  warningThreshold: number;
  criticalThreshold: number;
}

export interface HudConfig {
  pathLevels: number;
  refreshMs: number;
  warningThreshold: number;
  criticalThreshold: number;
  showUsage: boolean;
  usageCacheTtlMs: number;
}
