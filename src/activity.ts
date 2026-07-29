import fs from "node:fs";
import type {
  AgentActivityItem,
  TodoItem,
  TokenBreakdown,
  ToolActivityItem,
} from "./types.js";
import {
  emptyTokenBreakdown,
  parseTokenUsageFromLines,
  readUpdatesText,
} from "./token-usage.js";

interface ToolState {
  id: string;
  name: string;
  status: ToolActivityItem["status"];
  detail?: string;
  lastTs: number;
}

/**
 * Parse Grok `updates.jsonl` for tool / agent activity.
 * Pure-ish: accepts optional pre-split lines for tests.
 */
export function parseUpdatesLines(lines: string[]): {
  tools: ToolActivityItem[];
  agents: AgentActivityItem[];
  todos: TodoItem[];
} {
  const tools = new Map<string, ToolState>();
  const agents: AgentActivityItem[] = [];
  let todos: TodoItem[] = [];
  let lineNo = 0;

  for (const raw of lines) {
    lineNo += 1;
    const line = raw.trim();
    if (!line) continue;
    let obj: Record<string, unknown>;
    try {
      obj = JSON.parse(line) as Record<string, unknown>;
    } catch {
      continue;
    }

    const params = (obj.params as Record<string, unknown> | undefined) ?? {};
    const update =
      (params.update as Record<string, unknown> | undefined) ??
      (obj.update as Record<string, unknown> | undefined) ??
      {};
    const kind =
      (update.sessionUpdate as string | undefined) ??
      (obj.sessionUpdate as string | undefined) ??
      "";

    const ts =
      typeof obj.timestamp === "number"
        ? obj.timestamp
        : typeof obj.ts === "string"
          ? Date.parse(obj.ts) / 1000
          : lineNo;

    if (kind === "tool_call" || kind === "tool_call_update") {
      const id =
        (update.toolCallId as string | undefined) ??
        (update.id as string | undefined) ??
        `tool-${lineNo}`;
      const title = (update.title as string | undefined) ?? "";
      const statusRaw = (update.status as string | undefined) ?? "";
      const prev = tools.get(id);

      let name = prev?.name ?? "tool";
      if (title && !title.includes(" ") && title.length < 64) {
        name = title;
      } else if (title && prev?.name === "tool") {
        // Prefer short tool name from earlier tool_call event
        name = prev.name;
      }
      // On initial tool_call, title is the tool name
      if (kind === "tool_call" && title) {
        name = title.split(/\s+/)[0] || title;
      }

      let status: ToolActivityItem["status"] = prev?.status ?? "running";
      if (statusRaw === "completed" || statusRaw === "complete" || statusRaw === "success") {
        status = "completed";
      } else if (statusRaw === "failed" || statusRaw === "error") {
        status = "failed";
      } else if (kind === "tool_call") {
        status = "running";
      }

      let detail = prev?.detail;
      if (kind === "tool_call_update" && title && title.length < 120) {
        detail = title;
      }
      const rawInput = update.rawInput;
      if (!detail && rawInput != null) {
        detail = summarizeRawInput(rawInput);
      }

      tools.set(id, {
        id,
        name,
        status,
        detail,
        lastTs: ts,
      });

      // Capture latest todo list from todo_write
      if (
        name === "todo_write" ||
        name === "TodoWrite" ||
        (typeof title === "string" && /todo/i.test(title))
      ) {
        const extracted = extractTodos(rawInput ?? update);
        if (extracted.length) todos = extracted;
      }
      continue;
    }

    // Real subagents only — agent_message_chunk / agent_thought_chunk are
    // the main model streaming, not workers (they flooded the activity row).
    if (kind === "subagent_spawned") {
      const id =
        (update.subagent_id as string | undefined) ??
        (update.child_session_id as string | undefined) ??
        (update.agentId as string | undefined);
      const title =
        (update.description as string | undefined) ??
        (update.subagent_type as string | undefined) ??
        (update.agentType as string | undefined) ??
        "subagent";
      agents.push({
        id,
        title: String(title),
        status: "active",
        detail:
          typeof update.subagent_type === "string"
            ? update.subagent_type
            : undefined,
      });
      continue;
    }
    if (kind === "subagent_finished") {
      const id =
        (update.subagent_id as string | undefined) ??
        (update.child_session_id as string | undefined);
      const status = String(update.status ?? "completed");
      const title =
        (update.description as string | undefined) ??
        (update.subagent_type as string | undefined) ??
        "subagent";
      // Update matching active entry or append finished
      const existing = id
        ? agents.findIndex((a) => a.id === id)
        : -1;
      const item = {
        id,
        title: String(title),
        status,
        detail:
          typeof update.error === "string"
            ? update.error.slice(0, 80)
            : undefined,
      };
      if (existing >= 0) agents[existing] = item;
      else agents.push(item);
    }
  }

  // Aggregate completed tools by name for a compact summary
  const sorted = [...tools.values()].sort((a, b) => b.lastTs - a.lastTs);
  const recent = sorted.slice(0, 12);
  const completedCounts = new Map<string, number>();
  const items: ToolActivityItem[] = [];

  for (const t of recent) {
    if (t.status === "running") {
      items.push({
        id: t.id,
        name: t.name,
        status: "running",
        detail: t.detail,
      });
    } else {
      completedCounts.set(t.name, (completedCounts.get(t.name) ?? 0) + 1);
    }
  }

  for (const [name, count] of completedCounts) {
    items.push({
      id: `agg-${name}`,
      name,
      status: "completed",
      count,
    });
  }

  // Keep running first, then completed aggregates
  items.sort((a, b) => {
    if (a.status === "running" && b.status !== "running") return -1;
    if (b.status === "running" && a.status !== "running") return 1;
    return 0;
  });

  return {
    tools: items.slice(0, 8),
    agents: agents.slice(-3),
    todos,
  };
}

export function parseUpdatesFile(
  filePath: string,
  options: { maxTailBytes?: number } = {},
): {
  tools: ToolActivityItem[];
  agents: AgentActivityItem[];
  todos: TodoItem[];
} {
  if (!fs.existsSync(filePath)) {
    return { tools: [], agents: [], todos: [] };
  }
  try {
    // Activity only needs recent lines; use smaller tail for huge logs
    const content = readUpdatesText(filePath, {
      maxTailBytes: options.maxTailBytes ?? 256_000,
      fullCapBytes: options.maxTailBytes ?? 256_000,
    });
    return parseUpdatesLines(content.split(/\r?\n/));
  } catch {
    return { tools: [], agents: [], todos: [] };
  }
}

/**
 * Single read of updates.jsonl → tools/agents/todos + token usage (1.3 opt).
 * Avoids double-parse / double-read of the same file on every dashboard tick.
 */
export function parseUpdatesBundle(filePath: string): {
  tools: ToolActivityItem[];
  agents: AgentActivityItem[];
  todos: TodoItem[];
  lastTurn: TokenBreakdown | null;
  session: TokenBreakdown;
  turnCount: number;
} {
  if (!fs.existsSync(filePath)) {
    return {
      tools: [],
      agents: [],
      todos: [],
      lastTurn: null,
      session: emptyTokenBreakdown(),
      turnCount: 0,
    };
  }
  try {
    const content = readUpdatesText(filePath);
    const lines = content.split(/\r?\n/);
    const activity = parseUpdatesLines(lines);
    const tokens = parseTokenUsageFromLines(lines);
    return {
      tools: activity.tools,
      agents: activity.agents,
      todos: activity.todos,
      lastTurn: tokens.lastTurn,
      session: tokens.session,
      turnCount: tokens.turnCount,
    };
  } catch {
    return {
      tools: [],
      agents: [],
      todos: [],
      lastTurn: null,
      session: emptyTokenBreakdown(),
      turnCount: 0,
    };
  }
}

function extractTodos(raw: unknown): TodoItem[] {
  if (raw == null) return [];
  let obj: unknown = raw;
  if (typeof raw === "string") {
    try {
      obj = JSON.parse(raw.replace(/'/g, '"'));
    } catch {
      return [];
    }
  }
  if (!obj || typeof obj !== "object") return [];
  const o = obj as Record<string, unknown>;
  const list = (o.todos ?? o.TodoWrite ?? o.items) as unknown;
  if (!Array.isArray(list)) return [];
  const out: TodoItem[] = [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const t = item as Record<string, unknown>;
    const content = String(t.content ?? t.title ?? t.text ?? "").trim();
    if (!content) continue;
    out.push({
      content,
      status: String(t.status ?? "pending"),
      id: t.id != null ? String(t.id) : undefined,
    });
  }
  return out;
}

function summarizeRawInput(raw: unknown): string | undefined {
  if (raw == null) return undefined;
  if (typeof raw === "string") {
    try {
      return summarizeRawInput(JSON.parse(raw.replace(/'/g, '"')));
    } catch {
      return raw.slice(0, 60);
    }
  }
  if (typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    const command = o.command ?? o.target_file ?? o.path ?? o.query ?? o.pattern;
    if (typeof command === "string") return command.slice(0, 60);
  }
  return undefined;
}

/** Format tool activity line: ◐ tool · ✓ tool ×3 */
export function formatToolLine(tools: ToolActivityItem[]): string {
  if (!tools.length) return "";
  const parts: string[] = [];
  for (const t of tools) {
    if (t.status === "running") {
      const d = t.detail ? `: ${truncate(t.detail, 40)}` : "";
      parts.push(`◐ ${t.name}${d}`);
    } else if (t.status === "failed") {
      parts.push(`✗ ${t.name}`);
    } else {
      const n = t.count && t.count > 1 ? ` ×${t.count}` : "";
      parts.push(`✓ ${t.name}${n}`);
    }
  }
  return parts.join(" | ");
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return s.slice(0, n - 1) + "…";
}
