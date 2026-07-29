/**
 * Single plain-text HUD composer (Phase A).
 * All adapters (status.txt, CLI --once, future elementOrder) start here.
 * tmux coloring stays in status.ts — it wraps the same semantic fields.
 */
import {
  formatDuration,
  formatTokenCount,
  projectLabel,
  renderBar,
} from "../bar.js";
import { formatToolLine } from "../activity.js";
import {
  loadHudConfig,
  type HudDisplayConfig,
} from "../hud-config.js";
import { stringsFromConfig } from "../i18n.js";
import { formatTokenBreakdownLine } from "../token-usage.js";
import type {
  SessionSnapshot,
  TodoItem,
  TokenBreakdown,
  UsageSnapshot,
} from "../types.js";
import { truncateVisible } from "./width.js";

export function displayModel(model: string): string {
  if (!model || model === "unknown") return "Grok";
  return model.replace(/^grok-/i, "Grok ").replace(/-/g, " ");
}

export function contextValueText(
  session: SessionSnapshot,
  mode: HudDisplayConfig["display"]["contextValue"],
): string {
  const pct = Math.round(session.contextPercent);
  const tokens =
    session.contextWindowTokens > 0
      ? `${formatTokenCount(session.contextTokensUsed)}/${formatTokenCount(session.contextWindowTokens)}`
      : "";
  if (mode === "tokens") return tokens || `${pct}%`;
  if (mode === "both") return tokens ? `${pct}% (${tokens})` : `${pct}%`;
  return `${pct}%`;
}

function formatTodosLine(todos: TodoItem[]): string {
  if (!todos.length) return "";
  const done = todos.filter((t) => t.status === "completed").length;
  const cur =
    todos.find((t) => t.status === "in_progress") ??
    todos.find((t) => t.status === "pending");
  const label = cur?.content
    ? truncateVisible(cur.content, 42)
    : "todos";
  return `▸ ${label} (${done}/${todos.length})`;
}

function formatAgentsLine(session: SessionSnapshot): string {
  if (!session.agents?.length) return "";
  const a = session.agents[session.agents.length - 1]!;
  const title = a.title ?? "agent";
  const detail = a.detail ? `: ${truncateVisible(a.detail, 36)}` : "";
  const status =
    a.status && a.status !== "active" ? ` [${a.status}]` : "";
  return `◐ ${title}${status}${detail}`;
}

function pickTokenForDisplay(
  session: SessionSnapshot,
  scope: HudDisplayConfig["display"]["tokenScope"],
): { last: TokenBreakdown | null; sessionSum: TokenBreakdown | null } {
  const last = session.lastTurnTokens ?? null;
  const sessionSum = session.sessionTokens ?? null;
  if (scope === "session") return { last: null, sessionSum };
  if (scope === "last") return { last, sessionSum: null };
  return { last, sessionSum };
}

function tokenLinesForHud(
  session: SessionSnapshot,
  cfg: HudDisplayConfig,
): string[] {
  if (!cfg.display.showTokenBreakdown) return [];
  const mode = cfg.display.tokenDigits ?? "exact";
  const { last, sessionSum } = pickTokenForDisplay(
    session,
    cfg.display.tokenScope ?? "both",
  );
  const short = mode === "short" ? formatTokenCount : undefined;
  const out: string[] = [];
  if (last) {
    out.push(
      formatTokenBreakdownLine(last, {
        mode,
        prefix: "TOK",
        formatShort: short,
      }),
    );
  }
  if (
    sessionSum &&
    (cfg.display.tokenScope === "both" || cfg.display.tokenScope === "session")
  ) {
    const same =
      last &&
      last.inputTokens === sessionSum.inputTokens &&
      last.outputTokens === sessionSum.outputTokens &&
      last.cachedReadTokens === sessionSum.cachedReadTokens;
    if (!same) {
      out.push(
        formatTokenBreakdownLine(sessionSum, {
          mode,
          prefix: "ΣTOK",
          formatShort: short,
        }),
      );
    }
  }
  return out;
}

/**
 * Compose semantic HUD lines (no ANSI, no tmux codes).
 * Default expanded: identity · metrics · activity.
 */
export function composeHudLines(
  session: SessionSnapshot,
  usage?: UsageSnapshot | null,
  cfg: HudDisplayConfig = loadHudConfig(),
): string[] {
  const d = cfg.display;
  const L = stringsFromConfig(cfg);
  const lines: string[] = [];

  // Line 1 — model │ project git │ live  (+ optional title)
  const l1: string[] = [];
  if (d.showModel) l1.push(`[${displayModel(session.model)}]`);
  if (d.showProject) {
    let proj = projectLabel(session.cwd, cfg.pathLevels);
    if (d.showGit && session.branch) {
      const dirty = d.showGitDirty && session.gitDirty ? "*" : "";
      let ab = "";
      if (session.gitAhead) ab += `↑${session.gitAhead}`;
      if (session.gitBehind) ab += `↓${session.gitBehind}`;
      proj += ` git:(${session.branch}${dirty}${ab})`;
    }
    l1.push(proj);
  }
  if (d.showLive) {
    l1.push(session.live ? `● ${L.live}` : `○ ${L.stale}`);
  }
  if (d.showTitle && session.title) {
    l1.push(truncateVisible(session.title, 36));
  }
  if (session.reasoningEffort) {
    l1.push(`effort:${session.reasoningEffort}`);
  }
  if (l1.length) lines.push(l1.join(" │ "));

  // Line 2 — context + usage + meta
  const cBar = d.showContextBar ? renderBar(session.contextPercent) + " " : "";
  const ctxPart = `${L.ctx} ${cBar}${contextValueText(session, d.contextValue)}`;

  let usagePart = "";
  if (d.showUsage) {
    if (usage?.available && usage.percent != null) {
      const uBar = d.showContextBar ? renderBar(usage.percent) + " " : "";
      const abs =
        usage.used != null && usage.limit != null
          ? ` ${formatTokenCount(usage.used)}/${formatTokenCount(usage.limit)}`
          : "";
      const reset = usage.resetsIn ? ` · ${usage.resetsIn} ${L.left}` : "";
      usagePart = `${L.use} ${uBar}${Math.round(usage.percent)}%${usage.period ? ` (${usage.period})` : ""}${abs}${reset}`;
    } else if (usage) {
      usagePart = `${L.use} — ${usage.message ?? "n/a"}`;
    }
  }

  const meta: string[] = [];
  if (d.showSessionTime && session.durationSeconds > 0) {
    meta.push(formatDuration(session.durationSeconds));
  }
  if (d.showTurns && session.turnCount > 0) {
    meta.push(`${L.turn}${session.turnCount}`);
  }
  if (d.showTools && session.toolCallCount > 0) {
    meta.push(`${L.tools}${session.toolCallCount}`);
  }
  if (d.showErrors && (session.errorCount > 0 || session.toolFailureCount > 0)) {
    meta.push(`${L.err} ${session.errorCount || session.toolFailureCount}`);
  }
  if (
    d.showDiffStats &&
    (session.agentLinesAdded > 0 || session.agentLinesRemoved > 0)
  ) {
    meta.push(`Δ +${session.agentLinesAdded}/-${session.agentLinesRemoved}`);
  }
  if (d.showProductBreakdown && usage?.message) {
    const gb = usage.message
      .split(",")
      .map((s) => s.trim())
      .find((s) => /GrokBuild/i.test(s));
    if (gb) meta.push(gb);
  }

  const tokParts = tokenLinesForHud(session, cfg);
  const line2 = [ctxPart, tokParts[0], usagePart, ...meta]
    .filter(Boolean)
    .join(" │ ");
  if (line2) lines.push(line2);
  if (tokParts[1]) lines.push(tokParts[1]);

  // Activity
  const activity: string[] = [];
  if (d.showToolActivity) {
    const tl = formatToolLine(session.tools);
    if (tl) activity.push(tl);
  }
  if (d.showAgents) {
    const al = formatAgentsLine(session);
    if (al) activity.push(al);
  }
  if (d.showTodos) {
    const td = formatTodosLine(session.todos);
    if (td) activity.push(td);
  }
  if (activity.length) lines.push(activity.join("  ·  "));

  if (cfg.lineLayout === "compact") {
    return [lines.slice(0, 2).join(" · ")].filter(Boolean);
  }
  return lines;
}

/** Join compose lines into a single multi-line string. */
export function composeHudText(
  session: SessionSnapshot,
  usage?: UsageSnapshot | null,
  cfg: HudDisplayConfig = loadHudConfig(),
): string {
  return composeHudLines(session, usage, cfg).join("\n");
}
