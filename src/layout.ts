/**
 * Width-aware HUD layout + visible-length helpers (tmux style codes stripped).
 * D3: CJK-aware measurement via render/width.ts after stripping styles.
 */
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { visualLen as plainVisualLen } from "./render/width.js";

export type WidthTier = "xs" | "sm" | "md" | "lg";

export function stripTmuxStyles(s: string): string {
  return s
    .replace(/#\[[^\]]*\]/g, "")
    .replace(/\x1b\[[0-9;]*m/g, "");
}

/** Visible cell width after stripping tmux/ANSI (CJK = 2 cells). */
export function visibleLen(s: string): number {
  return plainVisualLen(stripTmuxStyles(s));
}

/**
 * Truncate styled string to max visible *cells* (CJK-aware).
 * Keeps leading tmux/ANSI styles; appends …#[default].
 */
export function trimVisible(s: string, max: number): string {
  if (max <= 0) return "";
  if (visibleLen(s) <= max) return s;
  const budget = Math.max(1, max - 1); // room for …
  let vis = 0;
  let out = "";
  let i = 0;
  while (i < s.length && vis < budget) {
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
    // Grapheme-ish: take one code point (enough for BMP CJK)
    const cp = s.codePointAt(i)!;
    const ch = String.fromCodePoint(cp);
    const w = plainVisualLen(ch);
    if (vis + w > budget) break;
    out += ch;
    vis += w;
    i += ch.length;
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

/** Last stable width per key — ignore ±hysteresis jitter from resize. */
const widthStable = new Map<string, number>();

/**
 * Hysteresis: only accept a new width when it moves by ≥ hysteresis cells.
 * Prevents strip thrashing while the user slowly resizes the window.
 */
export function stabilizeWidth(
  key: string,
  measured: number,
  hysteresis = 2,
): number {
  const m = Math.max(30, Math.floor(measured));
  const prev = widthStable.get(key);
  if (prev == null) {
    widthStable.set(key, m);
    return m;
  }
  if (Math.abs(m - prev) < hysteresis) return prev;
  widthStable.set(key, m);
  return m;
}

/** Clear width cache (tests). */
export function clearWidthStableCache(): void {
  widthStable.clear();
}

/** Best-effort width for a live Grok session. */
export function resolveDisplayWidth(options: {
  ttyPath?: string | null;
  tmuxSession?: string | null;
  fallback?: number;
  /** Disable hysteresis (tests). */
  raw?: boolean;
}): number {
  let measured = options.fallback ?? 100;
  const fromTmux = tmuxClientWidth(options.tmuxSession);
  if (fromTmux) measured = fromTmux;
  else {
    const fromTty = terminalColsForTty(options.ttyPath);
    if (fromTty && fromTty !== 100) measured = fromTty;
    else if (options.ttyPath) {
      const c = terminalColsForTty(options.ttyPath);
      if (c >= 30) measured = c;
    }
  }
  if (options.raw) return measured;
  const key =
    options.tmuxSession ||
    options.ttyPath ||
    "default";
  return stabilizeWidth(key, measured, 2);
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
  const active = [...segs];
  const tryJoin = (list: FitSegment[]): { plain: number; render: string } => {
    const plain = list.map((s) => s.text).join(sepPlain);
    const render = list.map((s) => s.render).join(sepRender);
    return { plain: plainVisualLen(plain), render };
  };

  let result = tryJoin(active);
  if (result.plain <= maxWidth) return result.render;

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
