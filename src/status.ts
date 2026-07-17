/**
 * Claude-HUD-parity multi-line status rendering for Grok Build.
 *
 * Default expanded layout (mirrors Claude HUD):
 *   [Grok 4.5] │ project git:(main*) │ ● live
 *   Context ████░░░░ 45% (224k/500k) │ Usage ██░░░░ 23% (weekly · resets 4d)
 *   ◐ read_file: x │ ✓ grep ×3 │ ▸ todos 2/5
 */
import fs from "node:fs";
import path from "node:path";
import {
  formatDuration,
  formatTokenCount,
  projectLabel,
  renderBar,
} from "./bar.js";
import { formatToolLine } from "./activity.js";
import type {
  SessionSnapshot,
  TodoItem,
  UsageSnapshot,
} from "./types.js";
import { defaultGrokHome } from "./session.js";
import {
  miniBar,
  tmuxFg,
  resolveTheme,
  type HudTheme,
} from "./theme.js";
import {
  loadHudConfig,
  type HudDisplayConfig,
} from "./hud-config.js";

export function hudDataDir(grokHome = defaultGrokHome()): string {
  return path.join(grokHome, "hud");
}

function displayModel(model: string): string {
  if (!model || model === "unknown") return "Grok";
  return model.replace(/^grok-/i, "Grok ").replace(/-/g, " ");
}

function contextValueText(
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
    ? truncate(cur.content, 42)
    : "todos";
  return `▸ ${label} (${done}/${todos.length})`;
}

function formatAgentsLine(session: SessionSnapshot): string {
  if (!session.agents?.length) return "";
  const a = session.agents[session.agents.length - 1]!;
  const title = a.title ?? "agent";
  const detail = a.detail ? `: ${truncate(a.detail, 36)}` : "";
  return `◐ ${title}${detail}`;
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return s.slice(0, n - 1) + "…";
}

/** Plain multi-line Claude-HUD parity block (for files / /hud / hooks). */
export function formatStatusBlock(
  session: SessionSnapshot,
  usage?: UsageSnapshot | null,
  cfg: HudDisplayConfig = loadHudConfig(),
): string {
  const d = cfg.display;
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
  if (d.showLive) l1.push(session.live ? "● live" : "○ stale");
  if (d.showTitle && session.title) l1.push(truncate(session.title, 36));
  if (session.reasoningEffort) l1.push(`effort:${session.reasoningEffort}`);
  lines.push(l1.join(" │ "));

  // Line 2 — Context + Usage (Claude default merge)
  const pct = Math.round(session.contextPercent);
  const cBar = d.showContextBar ? renderBar(session.contextPercent) + " " : "";
  const ctxPart = `Context ${cBar}${contextValueText(session, d.contextValue)}`;

  let usagePart = "";
  if (d.showUsage) {
    if (usage?.available && usage.percent != null) {
      const uBar = d.showContextBar ? renderBar(usage.percent) + " " : "";
      const abs =
        usage.used != null && usage.limit != null
          ? ` ${formatTokenCount(usage.used)}/${formatTokenCount(usage.limit)}`
          : "";
      const reset = usage.resetsIn ? ` · ${usage.resetsIn} left` : "";
      usagePart = `Usage ${uBar}${Math.round(usage.percent)}%${usage.period ? ` (${usage.period})` : ""}${abs}${reset}`;
    } else {
      usagePart = `Usage — ${usage?.message ?? "n/a"}`;
    }
  }

  const meta: string[] = [];
  if (d.showSessionTime && session.durationSeconds > 0) {
    meta.push(`Time ${formatDuration(session.durationSeconds)}`);
  }
  if (d.showTurns && session.turnCount > 0) {
    meta.push(`Turns ${session.turnCount}`);
  }
  if (d.showTools && session.toolCallCount > 0) {
    meta.push(`Tools ${session.toolCallCount}`);
  }
  if (d.showErrors && (session.errorCount > 0 || session.toolFailureCount > 0)) {
    meta.push(`Err ${session.errorCount || session.toolFailureCount}`);
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

  const line2 = [ctxPart, usagePart, ...meta].filter(Boolean).join(" │ ");
  lines.push(line2);

  // Line 3 — tools / agents / todos
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
    return lines.slice(0, 2).join(" · ");
  }
  return lines.join("\n");
}

/** Compact single-line for hooks / titles. */
export function formatCompactLine(
  session: SessionSnapshot,
  usage?: UsageSnapshot | null,
  cfg: HudDisplayConfig = loadHudConfig(),
): string {
  const pct = Math.round(session.contextPercent);
  const q =
    usage?.available && usage.percent != null
      ? `usage ${Math.round(usage.percent)}%`
      : "usage —";
  const git =
    cfg.display.showGit && session.branch
      ? ` git:(${session.branch}${session.gitDirty && cfg.display.showGitDirty ? "*" : ""})`
      : "";
  return `[hud] [${displayModel(session.model)}] ${projectLabel(session.cwd, cfg.pathLevels)}${git} │ ctx ${pct}% │ ${q} │ t${session.turnCount} │ tools ${session.toolCallCount}`;
}

/**
 * Multi-line tmux status content (colour-coded).
 * Written as separate lines for status-format[0..n].
 */
export function formatTmuxStatusLines(
  session: SessionSnapshot,
  usage?: UsageSnapshot | null,
  theme: HudTheme = resolveTheme(),
  cfg: HudDisplayConfig = loadHudConfig(),
): string[] {
  const d = cfg.display;
  const bold = cfg.bold !== false;
  const barW = cfg.barWidth && cfg.barWidth > 0 ? cfg.barWidth : 12;
  // wider separators + bold values = easier to scan at a glance
  const sep = tmuxFg(theme.sep, "  │  ", { bold: false });
  const label = (s: string) => tmuxFg(theme.label, s, { bold: false });
  const value = (s: string) => tmuxFg(theme.value, s, { bold });
  const accent = (s: string) => tmuxFg(theme.mark, s, { bold });
  const lines: string[] = [];

  // L0 model + project + git + live
  const l0: string[] = [];
  if (d.showModel) {
    l0.push(accent(`[${displayModel(session.model)}]`));
  }
  if (d.showProject) {
    let p = value(projectLabel(session.cwd, cfg.pathLevels));
    if (d.showGit && session.branch) {
      const dirty = d.showGitDirty && session.gitDirty ? "*" : "";
      p +=
        tmuxFg(theme.label, "  git:(", { bold: false }) +
        value(`${session.branch}${dirty}`) +
        tmuxFg(theme.label, ")", { bold: false });
    }
    l0.push(p);
  }
  if (d.showLive) {
    l0.push(
      session.live
        ? tmuxFg(theme.live, " ● LIVE ", { bold: true })
        : tmuxFg(theme.stale, " ○ stale ", { bold: false }),
    );
  }
  // Extra leading/trailing spaces = more breathing room (reads larger)
  lines.push("   " + l0.join(sep) + "   ");

  // L1 context + usage — thicker bars, bold percentages
  const pct = Math.round(session.contextPercent);
  const ctx =
    label("CTX ") +
    (d.showContextBar ? miniBar(pct, barW, theme, { bold }) + " " : "") +
    value(contextValueText(session, d.contextValue));

  let usagePart = label("USE ") + value("—");
  if (d.showUsage && usage?.available && usage.percent != null) {
    const q = Math.round(usage.percent);
    usagePart =
      label("USE ") +
      (d.showContextBar ? miniBar(q, barW, theme, { bold }) + " " : "") +
      value(
        `${q}%${usage.period ? ` ${usage.period}` : ""}${usage.resetsIn ? ` · ${usage.resetsIn}` : ""}`,
      );
  }
  const meta: string[] = [];
  if (d.showSessionTime && session.durationSeconds > 0) {
    meta.push(label("TIME ") + value(formatDuration(session.durationSeconds)));
  }
  if (d.showTurns) meta.push(label("T ") + value(String(session.turnCount)));
  if (d.showTools)
    meta.push(label("TOOLS ") + value(String(session.toolCallCount)));
  if (d.showErrors && session.toolFailureCount > 0) {
    meta.push(tmuxFg(theme.crit, ` ERR ${session.toolFailureCount} `, { bold: true }));
  }
  if (
    d.showDiffStats &&
    (session.agentLinesAdded || session.agentLinesRemoved)
  ) {
    meta.push(
      value(`+${session.agentLinesAdded}/-${session.agentLinesRemoved}`),
    );
  }
  lines.push("   " + [ctx, usagePart, ...meta].join(sep) + "   ");

  // L2 activity
  if (cfg.statusLines >= 3) {
    const bits: string[] = [];
    if (d.showToolActivity) {
      const tl = formatToolLine(session.tools);
      if (tl) bits.push(value(tl));
    }
    if (d.showAgents) {
      const al = formatAgentsLine(session);
      if (al) bits.push(label(al));
    }
    if (d.showTodos) {
      const td = formatTodosLine(session.todos);
      if (td) bits.push(accent(td));
    }
    if (d.showProductBreakdown && usage?.message) {
      const gb = usage.message
        .split(",")
        .map((s) => s.trim())
        .find((s) => /GrokBuild/i.test(s));
      if (gb) bits.push(label(gb));
    }
    if (bits.length)
      lines.push("   " + bits.join(tmuxFg(theme.sep, "   ·   ", { bold: false })) + "   ");
  }

  const n = Math.max(1, Math.min(3, cfg.statusLines));
  return lines.slice(0, n);
}

/** Single-line coloured status (fallback / compact). */
export function formatTmuxStatusLine(
  session: SessionSnapshot,
  usage?: UsageSnapshot | null,
  theme: HudTheme = resolveTheme(),
  cfg: HudDisplayConfig = loadHudConfig(),
): string {
  if (cfg.lineLayout === "compact" || cfg.statusLines === 1) {
    const lines = formatTmuxStatusLines(session, usage, theme, {
      ...cfg,
      statusLines: 1,
    });
    // collapse expanded L0+L1 into one dense line for single-row mode
    const pct = Math.round(session.contextPercent);
    const q =
      usage?.available && usage.percent != null
        ? Math.round(usage.percent)
        : null;
    const barW = cfg.barWidth && cfg.barWidth > 0 ? cfg.barWidth : 12;
    const bold = cfg.bold !== false;
    const sep = tmuxFg(theme.sep, "  ·  ", { bold: false });
    const label = (s: string) => tmuxFg(theme.label, s, { bold: false });
    const value = (s: string) => tmuxFg(theme.value, s, { bold });
    const parts = [
      tmuxFg(theme.mark, `[${displayModel(session.model)}]`, { bold: true }),
      value(projectLabel(session.cwd, cfg.pathLevels)),
      label("CTX ") + miniBar(pct, barW, theme, { bold }) + " " + value(`${pct}%`),
      q != null
        ? label("USE ") + miniBar(q, barW, theme, { bold }) + " " + value(`${q}%`)
        : label("USE ") + value("—"),
      label("T ") + value(String(session.turnCount)),
      label("TOOLS ") + value(String(session.toolCallCount)),
      session.live
        ? tmuxFg(theme.live, "● LIVE", { bold: true })
        : tmuxFg(theme.stale, "○", { bold: false }),
    ];
    return "   " + parts.join(sep) + "   ";
  }
  return formatTmuxStatusLines(session, usage, theme, cfg).join("\n");
}

export interface WriteStatusResult {
  dir: string;
  compactPath: string;
  fullPath: string;
  compact: string;
  full: string;
  tmuxLines: string[];
}

export function writeStatusFiles(
  session: SessionSnapshot,
  usage?: UsageSnapshot | null,
  grokHome = defaultGrokHome(),
): WriteStatusResult {
  const cfg = loadHudConfig(grokHome);
  const theme = resolveTheme(undefined, process.env, { grokHome });
  const dir = hudDataDir(grokHome);
  fs.mkdirSync(dir, { recursive: true });

  const compact = formatCompactLine(session, usage, cfg);
  const full = formatStatusBlock(session, usage, cfg);
  const tmuxLines = formatTmuxStatusLines(session, usage, theme, cfg);
  const single = formatTmuxStatusLine(session, usage, theme, cfg);

  const compactPath = path.join(dir, "status-line.txt");
  const fullPath = path.join(dir, "status.txt");
  const jsonPath = path.join(dir, "status.json");
  const tmuxPath = path.join(dir, "tmux-status.txt");
  const tmuxLinesPath = path.join(dir, "tmux-lines.txt");

  fs.writeFileSync(compactPath, compact + "\n", "utf8");
  fs.writeFileSync(fullPath, full + "\n", "utf8");
  fs.writeFileSync(tmuxPath, single + "\n", "utf8");
  // pad to 3 lines for stable sed -n
  const padded = [...tmuxLines];
  while (padded.length < 3) padded.push("");
  fs.writeFileSync(tmuxLinesPath, padded.join("\n") + "\n", "utf8");

  fs.writeFileSync(
    jsonPath,
    JSON.stringify(
      {
        updatedAt: new Date().toISOString(),
        sessionId: session.sessionId,
        model: session.model,
        cwd: session.cwd,
        live: session.live,
        contextPercent: session.contextPercent,
        contextTokensUsed: session.contextTokensUsed,
        contextWindowTokens: session.contextWindowTokens,
        turnCount: session.turnCount,
        toolCallCount: session.toolCallCount,
        toolFailureCount: session.toolFailureCount,
        agentLinesAdded: session.agentLinesAdded,
        agentLinesRemoved: session.agentLinesRemoved,
        todos: session.todos,
        tools: session.tools,
        agents: session.agents,
        usage: usage ?? null,
        preset: cfg.preset,
        compact,
        full,
        tmuxLines,
      },
      null,
      2,
    ),
    "utf8",
  );

  return {
    dir,
    compactPath,
    fullPath,
    compact,
    full,
    tmuxLines,
  };
}
