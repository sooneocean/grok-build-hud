/**
 * HUD palettes follow the active **Grok Build UI theme** (config.toml [ui].theme),
 * so the status strip matches what you see in the TUI — not a generic guess.
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";

export interface HudTheme {
  name: string;
  statusBg: string;
  statusFg: string;
  label: string;
  value: string;
  sep: string;
  mark: string;
  ok: string;
  warn: string;
  crit: string;
  barEmpty: string;
  live: string;
  stale: string;
}

export type ThemeMode = "auto" | "light" | "dark" | string;

const THEME_FILE = () => path.join(os.homedir(), ".grok", "hud", "theme");

/** Tokyo Night — matches Grok `tokyonight` */
export const THEME_TOKYONIGHT: HudTheme = {
  name: "tokyonight",
  statusBg: "default",
  statusFg: "#a9b1d6",
  label: "#565f89",
  value: "#c0caf5",
  sep: "#3b4261",
  mark: "#7aa2f7",
  ok: "#9ece6a",
  warn: "#e0af68",
  crit: "#f7768e",
  barEmpty: "#292e42",
  live: "#7aa2f7",
  stale: "#565f89",
};

/** GrokNight — neutral dark */
export const THEME_GROKNIGHT: HudTheme = {
  name: "groknight",
  statusBg: "default",
  statusFg: "#c8c8c8",
  label: "#7a7a7a",
  value: "#e8e8e8",
  sep: "#3a3a3a",
  mark: "#b267e6",
  ok: "#6dbf6d",
  warn: "#c9a227",
  crit: "#d06060",
  barEmpty: "#2a2a2a",
  live: "#b267e6",
  stale: "#7a7a7a",
};

/** GrokDay — light / 白底黑字 */
export const THEME_GROKDAY: HudTheme = {
  name: "grokday",
  statusBg: "default",
  statusFg: "#2a2a2a",
  label: "#6b6b6b",
  value: "#111111",
  sep: "#c8c8c8",
  mark: "#6C3EB2",
  ok: "#2f7a3e",
  warn: "#8a6a12",
  crit: "#a03030",
  barEmpty: "#dcdcdc",
  live: "#6C3EB2",
  stale: "#8a8a8a",
};

/** Rose Pine Moon */
export const THEME_ROSEPINE: HudTheme = {
  name: "rosepinemoon",
  statusBg: "default",
  statusFg: "#e0def4",
  label: "#6e6a86",
  value: "#e0def4",
  sep: "#393552",
  mark: "#c4a7e7",
  ok: "#9ccfd8",
  warn: "#f6c177",
  crit: "#eb6f92",
  barEmpty: "#2a273f",
  live: "#c4a7e7",
  stale: "#6e6a86",
};

/** Oscura Midnight */
export const THEME_OSCURA: HudTheme = {
  name: "oscuramidnight",
  statusBg: "default",
  statusFg: "#e6e6e6",
  label: "#6a6a6a",
  value: "#f0f0f0",
  sep: "#2a2a2a",
  mark: "#5A72A0",
  ok: "#4a9a6a",
  warn: "#c9a227",
  crit: "#c05050",
  barEmpty: "#1a1a1a",
  live: "#5A72A0",
  stale: "#6a6a6a",
};

/** Generic light (白底) */
export const THEME_CLEAR_LIGHT: HudTheme = {
  name: "light",
  statusBg: "default",
  statusFg: "#3c424a",
  label: "#7a828c",
  value: "#1a1d21",
  sep: "#c5cad1",
  mark: "#5a6570",
  ok: "#3d6b55",
  warn: "#8a6a2e",
  crit: "#8f4040",
  barEmpty: "#d8dce2",
  live: "#3d6b55",
  stale: "#9aa3ad",
};

/** Generic dark */
export const THEME_CLEAR_DARK: HudTheme = {
  name: "dark",
  statusBg: "default",
  statusFg: "#9aa3ad",
  label: "#6b7380",
  value: "#c5ced6",
  sep: "#3a4048",
  mark: "#5a6570",
  ok: "#7d9a8a",
  warn: "#b9a07a",
  crit: "#b07a7a",
  barEmpty: "#2e333a",
  live: "#7d9a8a",
  stale: "#6b7380",
};

export const THEME_DEFAULT: HudTheme = THEME_TOKYONIGHT;

const GROK_THEME_ALIASES: Record<string, string> = {
  tokyonight: "tokyonight",
  "tokyo-night": "tokyonight",
  tokyo_night: "tokyonight",
  groknight: "groknight",
  "grok-night": "groknight",
  dark: "groknight",
  night: "groknight",
  grokday: "grokday",
  "grok-day": "grokday",
  light: "grokday",
  day: "grokday",
  rosepinemoon: "rosepinemoon",
  "rose-pine-moon": "rosepinemoon",
  "rose_pine_moon": "rosepinemoon",
  rosepine: "rosepinemoon",
  "rose-pine": "rosepinemoon",
  oscuramindnight: "oscuramidnight",
  "oscura-midnight": "oscuramidnight",
  oscura: "oscuramidnight",
  auto: "auto",
  system: "auto",
};

export function normalizeGrokThemeName(raw: string): string {
  const k = raw.trim().toLowerCase().replace(/\s+/g, "");
  return GROK_THEME_ALIASES[k] ?? k;
}

export function paletteForGrokTheme(rawName: string): HudTheme {
  const name = normalizeGrokThemeName(rawName);
  switch (name) {
    case "tokyonight":
      return THEME_TOKYONIGHT;
    case "groknight":
      return THEME_GROKNIGHT;
    case "grokday":
      return THEME_GROKDAY;
    case "rosepinemoon":
      return THEME_ROSEPINE;
    case "oscuramidnight":
      return THEME_OSCURA;
    case "light":
      return THEME_CLEAR_LIGHT;
    case "dark":
      return THEME_CLEAR_DARK;
    default:
      // unknown → dark-neutral, still cohesive
      return { ...THEME_GROKNIGHT, name };
  }
}

export interface GrokUiConfig {
  theme: string;
  autoDarkTheme: string;
  autoLightTheme: string;
}

/** Parse ~/.grok/config.toml [ui] theme fields (minimal TOML reader). */
export function readGrokUiConfig(
  grokHome = path.join(os.homedir(), ".grok"),
): GrokUiConfig {
  const defaults: GrokUiConfig = {
    theme: "groknight",
    autoDarkTheme: "groknight",
    autoLightTheme: "grokday",
  };
  try {
    const p = path.join(grokHome, "config.toml");
    if (!fs.existsSync(p)) return defaults;
    const text = fs.readFileSync(p, "utf8");
    let inUi = false;
    const cfg = { ...defaults };
    for (const rawLine of text.split(/\r?\n/)) {
      const line = rawLine.replace(/#.*$/, "").trim();
      if (!line) continue;
      if (line.startsWith("[")) {
        inUi = line === "[ui]" || line.startsWith("[ui.");
        continue;
      }
      if (!inUi) continue;
      const m = line.match(/^([a-zA-Z0-9_]+)\s*=\s*"([^"]*)"/);
      if (!m) continue;
      const key = m[1]!;
      const val = m[2]!;
      if (key === "theme") cfg.theme = val;
      if (key === "auto_dark_theme") cfg.autoDarkTheme = val;
      if (key === "auto_light_theme") cfg.autoLightTheme = val;
    }
    return cfg;
  } catch {
    return defaults;
  }
}

function readThemeFile(): string | null {
  try {
    const p = THEME_FILE();
    if (!fs.existsSync(p)) return null;
    return fs.readFileSync(p, "utf8").trim().split(/\s+/)[0] || null;
  } catch {
    return null;
  }
}

export function luminanceFromRgb65535(r: number, g: number, b: number): number {
  const R = clamp01(r / 65535);
  const G = clamp01(g / 65535);
  const B = clamp01(b / 65535);
  const lin = (c: number) =>
    c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  return 0.2126 * lin(R) + 0.7152 * lin(G) + 0.0722 * lin(B);
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

export function appearanceFromLuminance(lum: number): "light" | "dark" {
  return lum >= 0.45 ? "light" : "dark";
}

let appearanceCache: { at: number; appearance: "light" | "dark" } | null = null;

export function clearAppearanceCache(): void {
  appearanceCache = null;
}

export function detectSystemAppearance(
  options: { now?: number; ttlMs?: number } = {},
): "light" | "dark" {
  const now = options.now ?? Date.now();
  const ttl = options.ttlMs ?? 5000;
  if (appearanceCache && now - appearanceCache.at < ttl) {
    return appearanceCache.appearance;
  }
  // macOS system appearance
  if (process.platform === "darwin") {
    try {
      const out = execFileSync(
        "defaults",
        ["read", "-g", "AppleInterfaceStyle"],
        { encoding: "utf8", timeout: 1500, stdio: ["ignore", "pipe", "ignore"] },
      ).trim();
      if (/dark/i.test(out)) {
        appearanceCache = { at: now, appearance: "dark" };
        return "dark";
      }
    } catch {
      // key missing → light mode on macOS
      appearanceCache = { at: now, appearance: "light" };
      return "light";
    }
  }
  appearanceCache = { at: now, appearance: "dark" };
  return "dark";
}

/**
 * Resolve HUD palette.
 * Priority:
 *  1. explicit CLI / GROK_HUD_THEME (if not auto)
 *  2. ~/.grok/hud/theme file (if not auto)
 *  3. Grok [ui].theme from config.toml  ← main source of truth
 *  4. if Grok theme is auto → system light/dark → auto_light/dark_theme
 */
export function resolveTheme(
  name?: string | null,
  env: NodeJS.ProcessEnv = process.env,
  options: { grokHome?: string } = {},
): HudTheme {
  const grokHome = options.grokHome ?? path.join(os.homedir(), ".grok");
  const ui = readGrokUiConfig(grokHome);

  const override = (
    name ||
    env.GROK_HUD_THEME ||
    env.GROK_BUILD_HUD_THEME ||
    readThemeFile() ||
    ""
  )
    .toString()
    .trim()
    .toLowerCase();

  // Explicit lock to a known palette name
  if (override && override !== "auto" && override !== "system") {
    return paletteForGrokTheme(override);
  }

  // Follow Grok's active theme (what the TUI paints)
  const grokTheme = normalizeGrokThemeName(ui.theme || "groknight");
  if (grokTheme === "auto") {
    const sys = detectSystemAppearance();
    const mapped =
      sys === "dark"
        ? ui.autoDarkTheme || "groknight"
        : ui.autoLightTheme || "grokday";
    const theme = paletteForGrokTheme(mapped);
    writeAppearanceSnapshot({
      appearance: sys,
      source: "grok-auto+" + sys,
      grokTheme: ui.theme,
      mappedTheme: mapped,
      hudPalette: theme.name,
    });
    return theme;
  }

  const theme = paletteForGrokTheme(grokTheme);
  writeAppearanceSnapshot({
    appearance: theme.name === "grokday" || theme.name === "light" ? "light" : "dark",
    source: "grok-config",
    grokTheme: ui.theme,
    mappedTheme: grokTheme,
    hudPalette: theme.name,
  });
  return theme;
}

function writeAppearanceSnapshot(data: Record<string, unknown>): void {
  try {
    const dir = path.join(os.homedir(), ".grok", "hud");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, "appearance.json"),
      JSON.stringify({ ...data, at: new Date().toISOString() }, null, 2) + "\n",
    );
  } catch {
    /* ignore */
  }
}

export function resolveThemeMode(
  name?: string | null,
  env: NodeJS.ProcessEnv = process.env,
): string {
  const raw = (
    name ||
    env.GROK_HUD_THEME ||
    env.GROK_BUILD_HUD_THEME ||
    readThemeFile() ||
    "auto"
  )
    .toString()
    .trim()
    .toLowerCase();
  return raw || "auto";
}

export function persistTheme(name: string): string {
  const dir = path.join(os.homedir(), ".grok", "hud");
  fs.mkdirSync(dir, { recursive: true });
  const p = THEME_FILE();
  fs.writeFileSync(p, name + "\n", "utf8");
  return p;
}

export function severityColor(percent: number, theme: HudTheme): string {
  if (percent >= 90) return theme.crit;
  if (percent >= 70) return theme.warn;
  return theme.ok;
}

/**
 * Progress bar — heavy block glyphs for readability on Terminal.app.
 * filled: █ (solid), empty: ░ (light track)
 */
export function miniBar(
  percent: number,
  width = 12,
  theme: HudTheme = THEME_DEFAULT,
  options: { bold?: boolean } = {},
): string {
  const p = Math.max(0, Math.min(100, percent));
  const filled = Math.round((p / 100) * width);
  const empty = Math.max(0, width - filled);
  const fg = severityColor(p, theme);
  const bold = options.bold !== false ? "bold," : "";
  return `#[${bold}fg=${fg}]${"█".repeat(filled)}#[fg=${theme.barEmpty}]${"░".repeat(empty)}#[default]`;
}

/** Tmux styled span. Values default to bold for readability. */
export function tmuxFg(
  color: string,
  text: string,
  options: { bold?: boolean } = {},
): string {
  const bold = options.bold ? "bold," : "";
  return `#[${bold}fg=${color}]${text}#[default]`;
}

export function tmuxStatusChrome(theme: HudTheme = THEME_DEFAULT): {
  statusStyle: string;
  statusLeft: string;
  statusRightTemplate: (filePath: string) => string;
  statusInterval: string;
  statusRightLength: string;
  statusLeftLength: string;
  statusPosition: string;
} {
  return {
    // bold + slightly brighter default fg for the whole strip
    statusStyle: `bg=${theme.statusBg},fg=${theme.statusFg},bold`,
    statusLeft: "",
    statusRightTemplate: (filePath: string) =>
      `#(cat ${filePath} 2>/dev/null)`,
    statusInterval: "1",
    statusRightLength: "200",
    statusLeftLength: "0",
    statusPosition: "bottom",
  };
}

// Back-compat helpers
export function appearanceFromProfileName(
  name: string,
): "light" | "dark" | null {
  const n = name.toLowerCase();
  if (/light|paper|white|basic|novel|day/.test(n)) return "light";
  if (/dark|pro|homebrew|night|tokyo|oscura|pine/.test(n)) return "dark";
  return null;
}
export function appearanceFromColorFgBg(
  colorFgBg: string | undefined,
): "light" | "dark" | null {
  if (!colorFgBg) return null;
  const parts = colorFgBg.split(";");
  if (parts.length < 2) return null;
  const bg = Number(parts[parts.length - 1]);
  if (!Number.isFinite(bg)) return null;
  if (bg >= 7 && bg !== 8) return "light";
  if (bg <= 1 || bg === 8) return "dark";
  return bg >= 7 ? "light" : "dark";
}
export function detectTerminalAppearance(): {
  appearance: "light" | "dark";
  source: string;
} {
  return {
    appearance: detectSystemAppearance(),
    source: "system",
  };
}
