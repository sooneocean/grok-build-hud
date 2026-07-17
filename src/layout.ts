/**
 * Width-aware HUD layout + visible-length helpers (tmux style codes stripped).
 */
import fs from "node:fs";
import { execFileSync } from "node:child_process";

export type WidthTier = "xs" | "sm" | "md" | "lg";

export function stripTmuxStyles(s: string): string {
  return s
    .replace(/#\[[^\]]*\]/g, "")
    .replace(/\x1b\[[0-9;]*m/g, "");
}

export function visibleLen(s: string): number {
  return stripTmuxStyles(s).length;
}

/** Truncate styled string to max visible columns (keeps leading styles). */
export function trimVisible(s: string, max: number): string {
  if (max <= 0) return "";
  if (visibleLen(s) <= max) return s;
  // Walk, counting only visible chars; drop trailing incomplete style safely
  let vis = 0;
  let out = "";
  let i = 0;
  while (i < s.length && vis < max - 1) {
    if (s[i] === "#" && s[i + 1] === "[") {
      const end = s.indexOf("]", i + 2);
      if (end === -1) break;
      out += s.slice(i, end + 1);
      i = end + 1;
      continue;
    }
    if (s[i] === "\x1b" && s[i + 1] === "[") {
      const end = s.indexOf("m", i + 2);
      if (end === -1) break;
      out += s.slice(i, end + 1);
      i = end + 1;
      continue;
    }
    out += s[i];
    vis += 1;
    i += 1;
  }
  return out + "…#[default]";
}

export function widthTier(cols: number): WidthTier {
  if (cols < 56) return "xs";
  if (cols < 80) return "sm";
  if (cols < 120) return "md";
  return "lg";
}

/** Progress bar cell count from window width. */
export function adaptiveBarWidth(cols: number, preferred = 12): number {
  if (cols < 56) return 6;
  if (cols < 80) return 8;
  if (cols < 100) return 10;
  if (cols < 140) return preferred;
  return Math.min(16, preferred + 2);
}

/** How many status rows to use for this width. */
export function adaptiveStatusLines(
  cols: number,
  configured: 1 | 2 | 3,
): 1 | 2 | 3 {
  if (cols < 56) return 1;
  if (cols < 80) return Math.min(2, configured) as 1 | 2;
  return configured;
}

export function terminalColsForTty(ttyPath: string | null | undefined): number {
  if (!ttyPath) return 100;
  const dev = ttyPath.startsWith("/dev/") ? ttyPath : `/dev/${ttyPath}`;
  try {
    if (!fs.existsSync(dev)) return 100;
    // stty size prints "rows cols"
    const out = execFileSync(
      "/bin/bash",
      ["-c", `stty size < ${JSON.stringify(dev)} 2>/dev/null`],
      { encoding: "utf8", timeout: 800, stdio: ["ignore", "pipe", "ignore"] },
    ).trim();
    const parts = out.split(/\s+/);
    const cols = Number(parts[1] ?? parts[0]);
    if (Number.isFinite(cols) && cols >= 30) return Math.floor(cols);
  } catch {
    /* ignore */
  }
  return 100;
}

export function tmuxClientWidth(sessionName?: string | null): number | null {
  try {
    const args = sessionName
      ? (["display-message", "-t", sessionName, "-p", "#{client_width}"] as string[])
      : (["display-message", "-p", "#{client_width}"] as string[]);
    const n = Number(
      execFileSync("tmux", args, {
        encoding: "utf8",
        timeout: 800,
        stdio: ["ignore", "pipe", "ignore"],
      }).trim(),
    );
    return Number.isFinite(n) && n >= 30 ? Math.floor(n) : null;
  } catch {
    return null;
  }
}

/** Best-effort width for a live Grok session. */
export function resolveDisplayWidth(options: {
  ttyPath?: string | null;
  tmuxSession?: string | null;
  fallback?: number;
}): number {
  const fromTmux = tmuxClientWidth(options.tmuxSession);
  if (fromTmux) return fromTmux;
  const fromTty = terminalColsForTty(options.ttyPath);
  if (fromTty && fromTty !== 100) return fromTty;
  // stty often returns 100 as our default — still try tty
  if (options.ttyPath) {
    const c = terminalColsForTty(options.ttyPath);
    if (c >= 30) return c;
  }
  return options.fallback ?? 100;
}

export interface FitSegment {
  /** Visible plain text */
  text: string;
  /** Rendered with styles */
  render: string;
  /** Lower = keep first when space is tight */
  priority: number;
}

/**
 * Join segments with sep until max visible width; drop low-priority first.
 */
export function fitSegments(
  segs: FitSegment[],
  maxWidth: number,
  sepPlain = " · ",
  sepRender = " · ",
): string {
  if (maxWidth < 8) return "";
  // Sort copy by priority for dropping, but preserve original order in output
  const active = [...segs];
  const tryJoin = (list: FitSegment[]): { plain: number; render: string } => {
    const plain = list.map((s) => s.text).join(sepPlain);
    const render = list.map((s) => s.render).join(sepRender);
    return { plain: plain.length, render };
  };

  let result = tryJoin(active);
  if (result.plain <= maxWidth) return result.render;

  // Drop highest priority numbers first (least important)
  const byDrop = [...active].sort((a, b) => b.priority - a.priority);
  const dropSet = new Set<FitSegment>();
  for (const cand of byDrop) {
    if (result.plain <= maxWidth) break;
    dropSet.add(cand);
    const kept = active.filter((s) => !dropSet.has(s));
    if (!kept.length) break;
    result = tryJoin(kept);
  }
  if (result.plain <= maxWidth) return result.render;
  return trimVisible(result.render, maxWidth);
}
