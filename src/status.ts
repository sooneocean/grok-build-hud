/**
 * Multi-line status rendering for Grok Build HUD.
 *
 * Plain multi-line text comes from render/compose.ts (single pipeline).
 * This module keeps tmux-colored / adaptive-width adapters + status files.
 */
import fs from "node:fs";
import path from "node:path";
import {
  formatDuration,
  formatTokenCount,
  formatTokenCount as fmtTokShort,
  projectLabel,
  renderBar,
} from "./bar.js";
import { formatToolLine } from "./activity.js";
import type {
  SessionSnapshot,
  UsageSnapshot,
} from "./types.js";
import { defaultGrokHome } from "./session.js";
import {
  miniBar,
  tmuxRole,
  resolveTheme,
  THEME_CODEX,
  isLightTheme,
  type HudTheme,
} from "./theme.js";
import {
  loadHudConfig,
  type HudDisplayConfig,
} from "./hud-config.js";
import {
  adaptiveBarWidth,
  adaptiveStatusLines,
  fitSegments,
  resolveDisplayWidth,
  trimVisible,
  visibleLen,
  widthTier,
  type FitSegment,
} from "./layout.js";
import { stringsFromConfig } from "./i18n.js";
import {
  composeHudText,
  contextValueText,
  displayModel,
} from "./render/compose.js";

export function hudDataDir(grokHome = defaultGrokHome()): string {
  return path.join(grokHome, "hud");
}

/** Prefer Codex calm palette when aesthetic=codex and Grok theme is dark. */
export function themeForHudConfig(
  cfg: HudDisplayConfig,
  grokHome?: string,
): HudTheme {
  const followed = resolveTheme(undefined, process.env, { grokHome });
  if (cfg.aesthetic === "codex" && !isLightTheme(followed)) {
    return THEME_CODEX;
  }
  return followed;
}

/** Plain multi-line status block (for files / /hud / hooks). */
export function formatStatusBlock(
  session: SessionSnapshot,
  usage?: UsageSnapshot | null,
  cfg: HudDisplayConfig = loadHudConfig(),
): string {
  return composeHudText(session, usage, cfg);
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return s.slice(0, n - 1) + "…";
}

function formatTodosLineTmux(todos: SessionSnapshot["todos"]): string {
  if (!todos?.length) return "";
  const done = todos.filter((t) => t.status === "completed").length;
  const cur =
    todos.find((t) => t.status === "in_progress") ??
    todos.find((t) => t.status === "pending");
  const label = cur?.content ? truncate(cur.content, 42) : "todos";
  return `▸ ${label} (${done}/${todos.length})`;
}

function formatAgentsLineTmux(session: SessionSnapshot): string {
  if (!session.agents?.length) return "";
  const a = session.agents[session.agents.length - 1]!;
  const title = a.title ?? "agent";
  const detail = a.detail ? `: ${truncate(a.detail, 36)}` : "";
  return `◐ ${title}${detail}`;
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
  const tok = session.lastTurnTokens;
  const tokBit =
    cfg.display.showTokenBreakdown && tok
      ? ` │ in ${formatTokenCount(tok.inputTokens)} out ${formatTokenCount(tok.outputTokens)} cache ${formatTokenCount(tok.cachedReadTokens)}`
      : "";
  return `[hud] [${displayModel(session.model)}] ${projectLabel(session.cwd, cfg.pathLevels)}${git} │ ctx ${pct}% │ ${q}${tokBit} │ t${session.turnCount} │ tools ${session.toolCallCount}`;
}

/**
 * Compact token cluster with mixed styles (not one big bold blob).
 * label italic/dim · number bold (colour by kind)
 */
function formatTokenCluster(
  session: SessionSnapshot,
  theme: HudTheme,
  cfg: HudDisplayConfig,
  tier: ReturnType<typeof widthTierLike>,
): { plain: string; render: string } | null {
  if (!cfg.display.showTokenBreakdown) return null;
  const tok = session.lastTurnTokens;
  if (!tok) return null;
  const L = stringsFromConfig(cfg);
  const exact = cfg.display.tokenDigits === "exact" && tier !== "xs" && tier !== "sm";
  const n = (x: number) => (exact ? x.toLocaleString("en-US") : fmtTokShort(x));
  const hit = Math.round(tok.cacheHitPct);
  // short labels from i18n: 入/出/缓 or i/o/c
  const partsPlain = [
    `${L.in} ${n(tok.inputTokens)}`,
    `${L.out} ${n(tok.outputTokens)}`,
    `${L.cache} ${n(tok.cachedReadTokens)}${hit ? ` ${hit}%` : ""}`,
  ];
  if (tok.reasoningTokens > 0 && (tier === "md" || tier === "lg")) {
    partsPlain.push(`${L.reason} ${n(tok.reasoningTokens)}`);
  }
  const plain = partsPlain.join(" ");
  const render =
    tmuxRole(theme, "label", `${L.in} `) +
    tmuxRole(theme, "primary", n(tok.inputTokens)) +
    tmuxRole(theme, "sep", "  ") +
    tmuxRole(theme, "label", `${L.out} `) +
    tmuxRole(theme, "secondary", n(tok.outputTokens)) +
    tmuxRole(theme, "sep", "  ") +
    tmuxRole(theme, "label", `${L.cache} `) +
    tmuxRole(theme, hit >= 90 ? "ok" : "warn", n(tok.cachedReadTokens)) +
    (hit
      ? tmuxRole(theme, "muted", ` ${hit}%`)
      : "") +
    (tok.reasoningTokens > 0 && (tier === "md" || tier === "lg")
      ? tmuxRole(theme, "sep", "  ") +
        tmuxRole(theme, "label", `${L.reason} `) +
        tmuxRole(theme, "secondary", n(tok.reasoningTokens))
      : "");
  return { plain, render };
}

function widthTierLike(cols: number): "xs" | "sm" | "md" | "lg" {
  return widthTier(cols);
}

/**
 * Multi-line tmux status — width-adaptive + typographic hierarchy.
 * Labels: dim italic · primary numbers: bold · secondary: italic · seps: dim
 */
export function formatTmuxStatusLines(
  session: SessionSnapshot,
  usage?: UsageSnapshot | null,
  theme: HudTheme = resolveTheme(),
  cfg: HudDisplayConfig = loadHudConfig(),
  options: { maxWidth?: number } = {},
): string[] {
  const d = cfg.display;
  const L = stringsFromConfig(cfg);
  const cols = options.maxWidth && options.maxWidth > 20 ? options.maxWidth : 100;
  const tier = widthTier(cols);
  const barW = adaptiveBarWidth(
    cols,
    cfg.barWidth && cfg.barWidth > 0 ? cfg.barWidth : 12,
  );
  const rows = adaptiveStatusLines(cols, cfg.statusLines ?? 3);
  // leave 2 cols margin for tmux chrome
  const maxW = Math.max(24, cols - 2);
  const sepR = tmuxRole(theme, "sep", " · ");
  const sepP = " · ";

  // ── Line 0: model (bold) · project (italic) · live (bold accent)
  const l0: FitSegment[] = [];
  if (d.showModel) {
    const t = displayModel(session.model);
    l0.push({
      text: t,
      render: tmuxRole(theme, "accent", t),
      priority: 0,
    });
  }
  if (d.showProject) {
    let plain = projectLabel(session.cwd, cfg.pathLevels);
    if (d.showGit && session.branch) {
      const dirty = d.showGitDirty && session.gitDirty ? "*" : "";
      plain += ` ${session.branch}${dirty}`;
    }
    // short path on narrow
    const shown =
      tier === "xs" ? plain.split("/").pop() || plain : plain;
    l0.push({
      text: shown,
      render: tmuxRole(theme, "secondary", shown),
      priority: 2,
    });
  }
  if (d.showLive) {
    const t = session.live ? "●" : "○";
    l0.push({
      text: t,
      render: session.live
        ? tmuxRole(theme, "live", t)
        : tmuxRole(theme, "muted", t),
      priority: 1,
    });
  }
  if (d.showTitle && session.title && tier === "lg") {
    const t = truncate(session.title, 28);
    l0.push({
      text: t,
      render: tmuxRole(theme, "muted", t),
      priority: 5,
    });
  }
  if (session.reasoningEffort && (tier === "md" || tier === "lg")) {
    const t = session.reasoningEffort;
    l0.push({
      text: t,
      render: tmuxRole(theme, "label", t),
      priority: 6,
    });
  }

  const line0 = fitSegments(l0, maxW, sepP, sepR);

  // ── Line 1: ctx bar + % · tokens · use · meta (priority drop)
  const pct = Math.round(session.contextPercent);
  const l1: FitSegment[] = [];

  {
    const bar = d.showContextBar
      ? miniBar(pct, barW, theme, { bold: true }) + " "
      : "";
    const val =
      tier === "xs" || tier === "sm"
        ? `${pct}%`
        : contextValueText(session, d.contextValue);
    const plain = `${L.ctx} ${val}`;
    const render =
      tmuxRole(theme, "label", `${L.ctx} `) +
      bar +
      tmuxRole(
        theme,
        pct >= 90 ? "crit" : pct >= 70 ? "warn" : "ok",
        val,
      );
    l1.push({ text: plain, render, priority: 0 });
  }

  const cluster = formatTokenCluster(session, theme, cfg, tier);
  if (cluster && tier !== "xs") {
    l1.push({
      text: cluster.plain,
      render: cluster.render,
      priority: tier === "sm" ? 3 : 1,
    });
  }

  if (d.showUsage && usage?.available && usage.percent != null) {
    const q = Math.round(usage.percent);
    const bar = d.showContextBar
      ? miniBar(q, Math.max(6, barW - 2), theme, { bold: true }) + " "
      : "";
    const periodWord =
      usage.period === "weekly"
        ? L.weekly
        : usage.period === "monthly"
          ? L.monthly
          : usage.period ?? "";
    const tail =
      tier === "lg" && usage.resetsIn
        ? ` ${periodWord} ${usage.resetsIn}`.trim()
        : "";
    const plain = `${L.use} ${q}%${tail ? " " + tail : ""}`;
    const render =
      tmuxRole(theme, "label", `${L.use} `) +
      bar +
      tmuxRole(theme, "primary", `${q}%`) +
      (tail ? tmuxRole(theme, "muted", ` ${tail}`) : "");
    l1.push({ text: plain, render, priority: 2 });
  }

  if (d.showTurns && session.turnCount > 0 && tier !== "xs") {
    l1.push({
      text: `${L.turn}${session.turnCount}`,
      render:
        tmuxRole(theme, "label", L.turn) +
        tmuxRole(theme, "primary", String(session.turnCount)),
      priority: 4,
    });
  }
  if (d.showTools && session.toolCallCount > 0 && (tier === "md" || tier === "lg")) {
    l1.push({
      text: `${L.tools}${session.toolCallCount}`,
      render:
        tmuxRole(theme, "label", L.tools) +
        tmuxRole(theme, "secondary", String(session.toolCallCount)),
      priority: 5,
    });
  }
  if (d.showSessionTime && session.durationSeconds > 0 && tier === "lg") {
    const t = formatDuration(session.durationSeconds);
    l1.push({
      text: t,
      render: tmuxRole(theme, "muted", t),
      priority: 7,
    });
  }
  if (
    d.showErrors &&
    (session.errorCount > 0 || session.toolFailureCount > 0)
  ) {
    const n = session.errorCount || session.toolFailureCount;
    l1.push({
      text: `!${n}`,
      render: tmuxRole(theme, "crit", `!${n}`),
      priority: 1,
    });
  }

  const line1 = fitSegments(l1, maxW, sepP, sepR);

  // Single-row windows: merge identity + metrics into one fitted line
  if (rows === 1) {
    const merged = fitSegments(
      [
        ...l0,
        ...l1.filter((s) => s.priority <= 2),
      ],
      maxW,
      sepP,
      sepR,
    );
    return [visibleLen(merged) > maxW ? trimVisible(merged, maxW) : merged];
  }

  const lines: string[] = [line0, line1];

  // ── Line 2: activity (italic) — secondary tools muted
  if (rows >= 3) {
    const bits: FitSegment[] = [];
    // Σ only on large screens (avoid repeating full token wall)
    if (
      d.showTokenBreakdown &&
      tier === "lg" &&
      cfg.display.tokenScope === "both"
    ) {
      const sum = session.sessionTokens;
      const last = session.lastTurnTokens;
      if (
        sum &&
        last &&
        (sum.inputTokens !== last.inputTokens ||
          sum.outputTokens !== last.outputTokens)
      ) {
        const t = `${L.sum} ${L.in} ${fmtTokShort(sum.inputTokens)} ${L.out} ${fmtTokShort(sum.outputTokens)} ${L.cache} ${fmtTokShort(sum.cachedReadTokens)}`;
        bits.push({
          text: t,
          render: tmuxRole(theme, "muted", t),
          priority: 4,
        });
      }
    }
    if (d.showToolActivity) {
      const tl = formatToolLine(session.tools);
      if (tl) {
        // only first tool chunk bold; rest already in formatToolLine — soften whole as secondary
        const short = truncate(tl, tier === "sm" ? 36 : tier === "md" ? 56 : 80);
        bits.push({
          text: short,
          render: tmuxRole(theme, "secondary", short),
          priority: 2,
        });
      }
    }
    if (d.showAgents) {
      const al = formatAgentsLineTmux(session);
      if (al) {
        bits.push({
          text: al,
          render: tmuxRole(theme, "label", truncate(al, 40)),
          priority: 5,
        });
      }
    }
    if (d.showTodos) {
      const td = formatTodosLineTmux(session.todos);
      if (td) {
        bits.push({
          text: td,
          render: tmuxRole(theme, "accent", truncate(td, 36)),
          priority: 3,
        });
      }
    }
    if (bits.length) {
      lines.push(fitSegments(bits, maxW, sepP, sepR));
    }
  }

  // Final safety trim each line to window
  return lines.map((ln) =>
    visibleLen(ln) > maxW ? trimVisible(ln, maxW) : ln,
  );
}

/** Single-line coloured status (fallback / compact). */
export function formatTmuxStatusLine(
  session: SessionSnapshot,
  usage?: UsageSnapshot | null,
  theme: HudTheme = resolveTheme(),
  cfg: HudDisplayConfig = loadHudConfig(),
  options: { maxWidth?: number } = {},
): string {
  const lines = formatTmuxStatusLines(
    session,
    usage,
    theme,
    {
      ...cfg,
      statusLines:
        cfg.lineLayout === "compact" || cfg.statusLines === 1
          ? 1
          : cfg.statusLines,
    },
    options,
  );
  return lines.join("\n");
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
  options: {
    /** Also write under hud/tmux/<name>/ for parallel Terminal isolation. */
    tmuxSession?: string | null;
    /** When false, skip global status.* (only instance dir). Default true. */
    writeGlobal?: boolean;
    /** Terminal/tmux client width for adaptive layout. */
    maxWidth?: number;
    ttyPath?: string | null;
  } = {},
): WriteStatusResult {
  const cfg = loadHudConfig(grokHome);
  const theme = themeForHudConfig(cfg, grokHome);
  const dir = hudDataDir(grokHome);
  fs.mkdirSync(dir, { recursive: true });

  const maxWidth =
    options.maxWidth ??
    resolveDisplayWidth({
      ttyPath: options.ttyPath,
      tmuxSession: options.tmuxSession,
      fallback: 100,
    });

  const compact = formatCompactLine(session, usage, cfg);
  const full = formatStatusBlock(session, usage, cfg);
  const tmuxLines = formatTmuxStatusLines(session, usage, theme, cfg, {
    maxWidth,
  });
  const single = formatTmuxStatusLine(session, usage, theme, cfg, { maxWidth });

  const compactPath = path.join(dir, "status-line.txt");
  const fullPath = path.join(dir, "status.txt");
  const jsonPath = path.join(dir, "status.json");
  const tmuxPath = path.join(dir, "tmux-status.txt");
  const tmuxLinesPath = path.join(dir, "tmux-lines.txt");

  // pad to 3 lines for stable sed -n
  const padded = [...tmuxLines];
  while (padded.length < 3) padded.push("");

  const payload = {
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
    lastTurnTokens: session.lastTurnTokens ?? null,
    sessionTokens: session.sessionTokens ?? null,
    tmuxSession: options.tmuxSession ?? null,
    displayWidth: maxWidth,
    todos: session.todos,
    tools: session.tools,
    agents: session.agents,
    usage: usage ?? null,
    preset: cfg.preset,
    compact,
    full,
    tmuxLines,
  };

  const writeBundle = (targetDir: string) => {
    fs.mkdirSync(targetDir, { recursive: true });
    fs.writeFileSync(path.join(targetDir, "status-line.txt"), compact + "\n", "utf8");
    fs.writeFileSync(path.join(targetDir, "status.txt"), full + "\n", "utf8");
    fs.writeFileSync(path.join(targetDir, "tmux-status.txt"), single + "\n", "utf8");
    fs.writeFileSync(path.join(targetDir, "tmux-lines.txt"), padded.join("\n") + "\n", "utf8");
    fs.writeFileSync(
      path.join(targetDir, "status.json"),
      JSON.stringify(payload, null, 2),
      "utf8",
    );
  };

  if (options.writeGlobal !== false) {
    writeBundle(dir);
  }

  // Per-tmux-session copy (parallel Terminals — independent bars)
  if (options.tmuxSession) {
    const safe = options.tmuxSession.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 60);
    if (safe) {
      writeBundle(path.join(dir, "tmux", safe));
    }
  }

  return {
    dir,
    compactPath,
    fullPath,
    compact,
    full,
    tmuxLines,
  };
}
