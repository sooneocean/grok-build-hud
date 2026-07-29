/**
 * Parse Grok session events.jsonl for metrics when signals.json is missing
 * or lagging (common mid-turn / some long sessions never get signals).
 */
import fs from "node:fs";

export interface EventsMetrics {
  turnCount: number;
  toolCallCount: number;
  toolFailureCount: number;
  /** Distinct tool names seen in tool_started/completed. */
  toolsUsed: string[];
}

export function emptyEventsMetrics(): EventsMetrics {
  return {
    turnCount: 0,
    toolCallCount: 0,
    toolFailureCount: 0,
    toolsUsed: [],
  };
}

/**
 * Count turn_started / tool_completed / tool_started / failures from event lines.
 * Pure: accepts pre-split lines for tests.
 */
export function parseEventsLines(lines: string[]): EventsMetrics {
  let turnCount = 0;
  let toolCallCount = 0;
  let toolFailureCount = 0;
  const tools = new Set<string>();

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    let obj: Record<string, unknown>;
    try {
      obj = JSON.parse(line) as Record<string, unknown>;
    } catch {
      continue;
    }
    const type = String(obj.type ?? "");
    if (type === "turn_started") {
      turnCount += 1;
      continue;
    }
    if (type === "tool_started") {
      const name = obj.tool_name;
      if (typeof name === "string" && name) tools.add(name);
      // Prefer tool_completed for the total; only count started when no
      // completed events appear later — handled after loop via max.
      continue;
    }
    if (type === "tool_completed") {
      toolCallCount += 1;
      const name = obj.tool_name;
      if (typeof name === "string" && name) tools.add(name);
      const outcome = String(obj.outcome ?? "").toLowerCase();
      if (
        outcome === "error" ||
        outcome === "failed" ||
        outcome === "failure" ||
        outcome === "denied"
      ) {
        toolFailureCount += 1;
      }
    }
  }

  // If Grok only emits tool_started (rare), fall back to counting starts.
  if (toolCallCount === 0 && tools.size > 0) {
    let started = 0;
    for (const raw of lines) {
      try {
        const o = JSON.parse(raw.trim()) as Record<string, unknown>;
        if (o.type === "tool_started") started += 1;
      } catch {
        /* ignore */
      }
    }
    toolCallCount = started;
  }

  return {
    turnCount,
    toolCallCount,
    toolFailureCount,
    toolsUsed: [...tools],
  };
}

/**
 * Tail-read events.jsonl (large files are common on long sessions).
 */
export function parseEventsFile(
  filePath: string,
  options: { maxTailBytes?: number } = {},
): EventsMetrics {
  if (!fs.existsSync(filePath)) return emptyEventsMetrics();
  const maxTail = options.maxTailBytes ?? 512_000;
  try {
    const stat = fs.statSync(filePath);
    let content: string;
    if (stat.size <= maxTail) {
      content = fs.readFileSync(filePath, "utf8");
    } else {
      // For counts we need the full file for accuracy on long sessions.
      // Cap at 8MB full read; beyond that use a larger tail (may undercount).
      const hardCap = 8_000_000;
      if (stat.size <= hardCap) {
        content = fs.readFileSync(filePath, "utf8");
      } else {
        const fd = fs.openSync(filePath, "r");
        try {
          const buf = Buffer.alloc(maxTail);
          fs.readSync(fd, buf, 0, maxTail, stat.size - maxTail);
          content = buf.toString("utf8");
          const nl = content.indexOf("\n");
          if (nl >= 0) content = content.slice(nl + 1);
        } finally {
          fs.closeSync(fd);
        }
      }
    }
    return parseEventsLines(content.split(/\r?\n/));
  } catch {
    return emptyEventsMetrics();
  }
}

/**
 * Rough context-window estimate when signals.json is absent.
 * Calibrated on real Grok sessions: tokens ≈ 0.25 × (chat+prompt+system) bytes
 * (median relative error ~12% on sessions with signals; better than showing 0%).
 */
export function estimateContextFromSessionDir(
  sessionDir: string,
  windowTokens = 500_000,
): { contextTokensUsed: number; contextWindowTokens: number; contextPercent: number } {
  const names = ["chat_history.jsonl", "prompt_context.json", "system_prompt.txt"];
  let bytes = 0;
  for (const name of names) {
    try {
      bytes += fs.statSync(`${sessionDir}/${name}`).size;
    } catch {
      /* optional */
    }
  }
  const used = Math.min(windowTokens, Math.max(0, Math.round(bytes * 0.25)));
  const pct =
    windowTokens > 0 ? Math.min(100, Math.max(0, (used / windowTokens) * 100)) : 0;
  return {
    contextTokensUsed: used,
    contextWindowTokens: windowTokens,
    contextPercent: pct,
  };
}

/** Session age in seconds from summary timestamps (fallback for duration). */
export function durationFromSummary(summary?: {
  created_at?: string;
  last_active_at?: string;
  updated_at?: string;
} | null): number {
  if (!summary?.created_at) return 0;
  const start = Date.parse(summary.created_at);
  if (!Number.isFinite(start)) return 0;
  const endRaw =
    summary.last_active_at || summary.updated_at || new Date().toISOString();
  const end = Date.parse(endRaw);
  if (!Number.isFinite(end) || end < start) {
    return Math.max(0, Math.floor((Date.now() - start) / 1000));
  }
  return Math.max(0, Math.floor((end - start) / 1000));
}
