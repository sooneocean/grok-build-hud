/**
 * Parse per-turn token usage (input / output / cache) from updates.jsonl.
 * Source: sessionUpdate "turn_completed" → usage{ inputTokens, outputTokens, cachedReadTokens, … }
 */
import fs from "node:fs";
import type { TokenBreakdown } from "./types.js";

function num(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

export function parseUsageObject(raw: unknown): TokenBreakdown | null {
  if (!raw || typeof raw !== "object") return null;
  const u = raw as Record<string, unknown>;
  const inputTokens = num(u.inputTokens ?? u.input_tokens);
  const outputTokens = num(u.outputTokens ?? u.output_tokens);
  const cachedReadTokens = num(
    u.cachedReadTokens ?? u.cache_read_input_tokens ?? u.cached_read_tokens,
  );
  const reasoningTokens = num(u.reasoningTokens ?? u.reasoning_tokens);
  const totalTokens =
    num(u.totalTokens ?? u.total_tokens) ||
    inputTokens + outputTokens;
  const modelCalls = num(u.modelCalls ?? u.model_calls ?? u.numTurns);
  if (
    inputTokens <= 0 &&
    outputTokens <= 0 &&
    cachedReadTokens <= 0 &&
    totalTokens <= 0
  ) {
    return null;
  }
  const cacheHitPct =
    inputTokens > 0
      ? Math.min(100, (cachedReadTokens / inputTokens) * 100)
      : 0;
  return {
    inputTokens,
    outputTokens,
    cachedReadTokens,
    reasoningTokens,
    totalTokens,
    modelCalls,
    cacheHitPct,
  };
}

export function emptyTokenBreakdown(): TokenBreakdown {
  return {
    inputTokens: 0,
    outputTokens: 0,
    cachedReadTokens: 0,
    reasoningTokens: 0,
    totalTokens: 0,
    modelCalls: 0,
    cacheHitPct: 0,
  };
}

export function addTokenBreakdown(
  a: TokenBreakdown,
  b: TokenBreakdown,
): TokenBreakdown {
  const inputTokens = a.inputTokens + b.inputTokens;
  const cachedReadTokens = a.cachedReadTokens + b.cachedReadTokens;
  return {
    inputTokens,
    outputTokens: a.outputTokens + b.outputTokens,
    cachedReadTokens,
    reasoningTokens: a.reasoningTokens + b.reasoningTokens,
    totalTokens: a.totalTokens + b.totalTokens,
    modelCalls: a.modelCalls + b.modelCalls,
    cacheHitPct:
      inputTokens > 0
        ? Math.min(100, (cachedReadTokens / inputTokens) * 100)
        : 0,
  };
}

/**
 * Scan updates.jsonl lines for turn_completed usage.
 * Returns last turn + session sum (sum of each turn's reported usage).
 */
export function parseTokenUsageFromLines(lines: string[]): {
  lastTurn: TokenBreakdown | null;
  session: TokenBreakdown;
  turnCount: number;
} {
  let lastTurn: TokenBreakdown | null = null;
  let session = emptyTokenBreakdown();
  let turnCount = 0;

  for (const raw of lines) {
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
    if (kind !== "turn_completed") continue;
    const usage = parseUsageObject(update.usage ?? obj.usage);
    if (!usage) continue;
    lastTurn = usage;
    session = addTokenBreakdown(session, usage);
    turnCount += 1;
  }

  return { lastTurn, session, turnCount };
}

export function parseTokenUsageFile(filePath: string): {
  lastTurn: TokenBreakdown | null;
  session: TokenBreakdown;
  turnCount: number;
} {
  try {
    if (!fs.existsSync(filePath)) {
      return { lastTurn: null, session: emptyTokenBreakdown(), turnCount: 0 };
    }
    // Prefer shared read helper (tail for huge files) — see readUpdatesText
    const text = readUpdatesText(filePath);
    return parseTokenUsageFromLines(text.split(/\r?\n/));
  } catch {
    return { lastTurn: null, session: emptyTokenBreakdown(), turnCount: 0 };
  }
}

/** Max bytes for full session sum scan; larger → tail (last-turn still accurate). */
const TOKEN_FULL_CAP = 4_000_000;
const TOKEN_TAIL = 512_000;

/** Shared updates.jsonl reader (full under cap, else tail). */
export function readUpdatesText(
  filePath: string,
  options: { maxTailBytes?: number; fullCapBytes?: number } = {},
): string {
  const fullCap = options.fullCapBytes ?? TOKEN_FULL_CAP;
  const maxTail = options.maxTailBytes ?? TOKEN_TAIL;
  if (!fs.existsSync(filePath)) return "";
  const stat = fs.statSync(filePath);
  if (stat.size <= fullCap) {
    return fs.readFileSync(filePath, "utf8");
  }
  const fd = fs.openSync(filePath, "r");
  try {
    const buf = Buffer.alloc(maxTail);
    fs.readSync(fd, buf, 0, maxTail, Math.max(0, stat.size - maxTail));
    let content = buf.toString("utf8");
    const nl = content.indexOf("\n");
    if (nl >= 0) content = content.slice(nl + 1);
    return content;
  } finally {
    fs.closeSync(fd);
  }
}

/** Full integers with thousands separators: 974820 → "974,820" */
export function formatExactCount(n: number): string {
  if (!Number.isFinite(n) || n < 0) return "0";
  return Math.round(n).toLocaleString("en-US");
}

/**
 * Token line for HUD.
 * mode "exact" → full digits; "short" → 974.8k style via formatTokenCount.
 */
export function formatTokenBreakdownLine(
  tokens: TokenBreakdown | null | undefined,
  options: {
    mode?: "exact" | "short";
    prefix?: string;
    includeReason?: boolean;
    includeCachePct?: boolean;
    formatShort?: (n: number) => string;
  } = {},
): string {
  if (!tokens) return "";
  const {
    mode = "exact",
    prefix = "TOK",
    includeReason = true,
    includeCachePct = true,
  } = options;
  const fmt =
    mode === "short" && options.formatShort
      ? options.formatShort
      : formatExactCount;

  const parts = [
    `IN ${fmt(tokens.inputTokens)}`,
    `OUT ${fmt(tokens.outputTokens)}`,
    `CACHE ${fmt(tokens.cachedReadTokens)}`,
  ];
  if (includeCachePct && tokens.inputTokens > 0) {
    parts[2] += ` (${Math.round(tokens.cacheHitPct)}%)`;
  }
  if (includeReason && tokens.reasoningTokens > 0) {
    parts.push(`REASON ${fmt(tokens.reasoningTokens)}`);
  }
  return `${prefix} ${parts.join(" · ")}`;
}
