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

/**
 * GrokDay — light / paper strip.
 * High contrast on white: never rely on terminal "dim" (washes out on light bg).
 * Solid soft statusBg so text isn't lost against mixed terminal backgrounds.
 */
export const THEME_GROKDAY: HudTheme = {
  name: "grokday",
  // Warm paper bar — separates HUD from Grok content, readable black on cream
  statusBg: "#f4f1ea",
  statusFg: "#1c1917",
  // Labels: slate, dark enough without dim
  label: "#57534e",
  // Primary numbers: near-black ink
  value: "#0c0a09",
  // Separators: visible mid grey (not #c8c8c8 on white)
  sep: "#a8a29e",
  // Accent purple — deeper for WCAG-ish contrast on paper
  mark: "#5b21b6",
  ok: "#166534",
  warn: "#a16207",
  crit: "#b91c1c",
  barEmpty: "#d6d3d1",
  live: "#5b21b6",
  stale: "#78716c",
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

/** Generic light (白底) — high contrast */
export const THEME_CLEAR_LIGHT: HudTheme = {
  name: "light",
  statusBg: "#f1f5f9",
  statusFg: "#0f172a",
  label: "#475569",
  value: "#020617",
  sep: "#94a3b8",
  mark: "#1e3a5f",
  ok: "#15803d",
  warn: "#a16207",
  crit: "#b91c1c",
  barEmpty: "#cbd5e1",
  live: "#1d4ed8",
  stale: "#64748b",
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

/**
 * Codex calm — zinc neutrals + single emerald accent (Codex App / CodexBar vibe).
 * Semantic severity only for ok/warn/crit; not a rainbow strip.
 */
export const THEME_CODEX: HudTheme = {
  name: "codex",
  statusBg: "default",
  statusFg: "#e5e7eb",
  label: "#6b7280",
  value: "#e5e7eb",
  sep: "#3f3f46",
  mark: "#34d399",
  ok: "#4ade80",
  warn: "#fbbf24",
  crit: "#f87171",
  barEmpty: "#27272a",
  live: "#34d399",
  stale: "#52525b",
};

/** Codex calm light — paper strip, deep ink, emerald accent only for live/ok. */
export const THEME_CODEX_LIGHT: HudTheme = {
  name: "codex-light",
  statusBg: "#f4f4f5",
  statusFg: "#18181b",
  label: "#52525b",
  value: "#09090b",
  sep: "#a1a1aa",
  mark: "#059669",
  ok: "#15803d",
  warn: "#b45309",
  crit: "#b91c1c",
  barEmpty: "#d4d4d8",
  live: "#059669",
  stale: "#71717a",
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
  codex: "codex",
  "codex-calm": "codex",
  "codex-light": "codex-light",
  codexlight: "codex-light",
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
    case "codex":
      return THEME_CODEX;
    case "codex-light":
      return THEME_CODEX_LIGHT;
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
 * Resolve HUD palette from Grok's theme — never lock to one palette by default.
 *
 * Default (follow):
 *   ~/.grok/config.toml [ui].theme
 *   → if "auto"/"system": OS light/dark → auto_light_theme / auto_dark_theme
 *
 * Optional lock (explicit only):
 *   GROK_HUD_LOCK=1 plus CLI `--theme X` / env GROK_HUD_THEME=X
 *   (without LOCK, file/env "auto" is ignored and we still follow Grok)
 */
export function resolveTheme(
  name?: string | null,
  env: NodeJS.ProcessEnv = process.env,
  options: { grokHome?: string } = {},
): HudTheme {
  const grokHome = options.grokHome ?? path.join(os.homedir(), ".grok");
  const ui = readGrokUiConfig(grokHome);
  const lock =
    env.GROK_HUD_LOCK === "1" ||
    env.GROK_HUD_LOCK === "true" ||
    Boolean(name && name !== "auto" && name !== "system");

  // Explicit CLI name (e.g. --theme tokyonight) = temporary override for that command
  const cliName = (name || "").toString().trim().toLowerCase();
  if (cliName && cliName !== "auto" && cliName !== "system") {
    const theme = paletteForGrokTheme(cliName);
    writeAppearanceSnapshot({
      appearance: isLightTheme(theme) ? "light" : "dark",
      source: "cli-override",
      grokTheme: ui.theme,
      mappedTheme: theme.name,
      hudPalette: theme.name,
      follow: false,
    });
    return theme;
  }

  // Locked env/file palette only when GROK_HUD_LOCK=1
  if (lock && !cliName) {
    const locked = (
      env.GROK_HUD_THEME ||
      env.GROK_BUILD_HUD_THEME ||
      readThemeFile() ||
      ""
    )
      .toString()
      .trim()
      .toLowerCase();
    if (locked && locked !== "auto" && locked !== "system") {
      const theme = paletteForGrokTheme(locked);
      writeAppearanceSnapshot({
        appearance: isLightTheme(theme) ? "light" : "dark",
        source: "locked",
        grokTheme: ui.theme,
        mappedTheme: theme.name,
        hudPalette: theme.name,
        follow: false,
      });
      return theme;
    }
  }

  // ── Follow Grok [ui].theme (default path) ──
  return resolveFromGrokUi(ui, grokHome);
}

/** Map Grok config.toml [ui] → HUD palette (live follow). */
export function resolveFromGrokUi(
  ui: GrokUiConfig,
  grokHome?: string,
): HudTheme {
  const grokTheme = normalizeGrokThemeName(ui.theme || "groknight");
  if (grokTheme === "auto") {
    // Poll system appearance with short TTL so OS toggle tracks quickly
    const sys = detectSystemAppearance({ ttlMs: 1500 });
    const mappedRaw =
      sys === "dark"
        ? ui.autoDarkTheme || "groknight"
        : ui.autoLightTheme || "grokday";
    const mapped = normalizeGrokThemeName(mappedRaw);
    const theme = paletteForGrokTheme(mapped);
    writeAppearanceSnapshot({
      appearance: sys,
      source: "follow-grok-auto+" + sys,
      grokTheme: ui.theme,
      autoDarkTheme: ui.autoDarkTheme,
      autoLightTheme: ui.autoLightTheme,
      mappedTheme: mapped,
      hudPalette: theme.name,
      follow: true,
      grokHome: grokHome ?? null,
    });
    return theme;
  }

  const theme = paletteForGrokTheme(grokTheme);
  writeAppearanceSnapshot({
    appearance: isLightTheme(theme) ? "light" : "dark",
    source: "follow-grok-config",
    grokTheme: ui.theme,
    mappedTheme: grokTheme,
    hudPalette: theme.name,
    follow: true,
  });
  return theme;
}

/**
 * Fingerprint for dashboard: any Grok theme / OS / mapping change rewrites tmux.
 * Not just palette name — so auto light↔dark always refreshes.
 */
export function themeFingerprint(
  theme: HudTheme,
  ui?: GrokUiConfig | null,
  env: NodeJS.ProcessEnv = process.env,
): string {
  const u = ui ?? { theme: "?", autoDarkTheme: "?", autoLightTheme: "?" };
  const sys =
    normalizeGrokThemeName(u.theme || "") === "auto"
      ? detectSystemAppearance({ ttlMs: 1500 })
      : "-";
  return [
    theme.name,
    u.theme,
    u.autoDarkTheme,
    u.autoLightTheme,
    sys,
    env.GROK_HUD_LOCK || "0",
  ].join("|");
}

/** Ensure ~/.grok/hud/theme is "auto" (follow mode). */
export function ensureFollowMode(grokHome = path.join(os.homedir(), ".grok")): string {
  const dir = path.join(grokHome, "hud");
  fs.mkdirSync(dir, { recursive: true });
  const p = path.join(dir, "theme");
  fs.writeFileSync(p, "auto\n", "utf8");
  return p;
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

export type SeverityLevel = "ok" | "warn" | "crit";

/**
 * Unified severity for context % and usage % (same ladder).
 * Defaults match classic 70 / 90; callers should pass config thresholds.
 */
export function severityLevel(
  percent: number,
  warningThreshold = 70,
  criticalThreshold = 90,
): SeverityLevel {
  const p = Math.max(0, Math.min(100, percent));
  if (p >= criticalThreshold) return "crit";
  if (p >= warningThreshold) return "warn";
  return "ok";
}

export function severityColor(
  percent: number,
  theme: HudTheme,
  warningThreshold = 70,
  criticalThreshold = 90,
): string {
  const level = severityLevel(percent, warningThreshold, criticalThreshold);
  if (level === "crit") return theme.crit;
  if (level === "warn") return theme.warn;
  return theme.ok;
}

export function severityRole(
  percent: number,
  warningThreshold = 70,
  criticalThreshold = 90,
): "ok" | "warn" | "crit" {
  return severityLevel(percent, warningThreshold, criticalThreshold);
}

/** Merge user colors.* overrides onto a palette (hex / named strings). */
export function applyColorOverrides(
  theme: HudTheme,
  colors?: Partial<Record<keyof HudTheme, string>> | null,
): HudTheme {
  if (!colors || typeof colors !== "object") return theme;
  const next = { ...theme };
  for (const key of Object.keys(colors) as (keyof HudTheme)[]) {
    const v = colors[key];
    if (typeof v === "string" && v.trim()) {
      (next as Record<string, string>)[key] = v.trim();
    }
  }
  return next;
}

/**
 * Progress bar — glyphs depend on barStyle (block/thin/dot).
 */
export function miniBar(
  percent: number,
  width = 12,
  theme: HudTheme = THEME_DEFAULT,
  options: {
    bold?: boolean;
    filledChar?: string;
    emptyChar?: string;
    warningThreshold?: number;
    criticalThreshold?: number;
  } = {},
): string {
  const p = Math.max(0, Math.min(100, percent));
  const filled = Math.round((p / 100) * width);
  const empty = Math.max(0, width - filled);
  const fg = severityColor(
    p,
    theme,
    options.warningThreshold ?? 70,
    options.criticalThreshold ?? 90,
  );
  const bold = options.bold !== false ? "bold," : "";
  const f = options.filledChar ?? "█";
  const e = options.emptyChar ?? "░";
  return `#[${bold}fg=${fg}]${f.repeat(filled)}#[fg=${theme.barEmpty}]${e.repeat(empty)}#[default]`;
}

export interface TmuxStyleOpts {
  bold?: boolean;
  /** Italics — hierarchy for labels / secondary facts */
  italics?: boolean;
  /** Dim — de-emphasize separators and labels */
  dim?: boolean;
  underscore?: boolean;
}

/** Tmux styled span. Mix bold / italics / dim for scannable hierarchy. */
export function tmuxFg(
  color: string,
  text: string,
  options: TmuxStyleOpts = {},
): string {
  const attrs: string[] = [];
  if (options.bold) attrs.push("bold");
  if (options.italics) attrs.push("italics");
  if (options.dim) attrs.push("dim");
  if (options.underscore) attrs.push("underscore");
  // no attributes → still set fg
  const head = attrs.length ? attrs.join(",") + "," : "";
  return `#[${head}fg=${color}]${text}#[default]`;
}

/** Light / paper palettes — dim attribute destroys contrast on light bg. */
export function isLightTheme(theme: HudTheme): boolean {
  const n = (theme.name || "").toLowerCase();
  if (
    n === "grokday" ||
    n === "light" ||
    n === "day" ||
    n === "codex-light" ||
    n === "codexlight"
  ) {
    return true;
  }
  // Heuristic: explicit light status background hex
  const bg = (theme.statusBg || "").toLowerCase();
  if (bg.startsWith("#")) {
    const hex = bg.slice(1);
    if (hex.length >= 6) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      // relative luminance approx
      const L = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
      return L > 0.72;
    }
  }
  return false;
}

/** Semantic text roles for the HUD strip (light-safe: no dim on paper). */
export function tmuxRole(
  theme: HudTheme,
  role:
    | "label"
    | "primary"
    | "secondary"
    | "accent"
    | "muted"
    | "ok"
    | "warn"
    | "crit"
    | "live"
    | "sep",
  text: string,
): string {
  const light = isLightTheme(theme);
  switch (role) {
    case "label":
      // Light: italic only (no dim). Dark: dim+italic OK.
      return tmuxFg(theme.label, text, {
        italics: true,
        dim: !light,
        bold: light, // slightly stronger labels on paper
      });
    case "primary":
      return tmuxFg(theme.value, text, { bold: true });
    case "secondary":
      // Path / tools — italic, full ink on light (statusFg is dark)
      return tmuxFg(theme.statusFg, text, {
        italics: true,
        bold: light,
      });
    case "accent":
      return tmuxFg(theme.mark, text, { bold: true });
    case "muted":
      return tmuxFg(theme.label, text, {
        italics: true,
        dim: !light,
      });
    case "ok":
      return tmuxFg(theme.ok, text, { bold: true });
    case "warn":
      return tmuxFg(theme.warn, text, { bold: true });
    case "crit":
      return tmuxFg(theme.crit, text, { bold: true });
    case "live":
      // Calm pulse: accent ink, bold only on dark (paper already high contrast)
      return tmuxFg(theme.live, text, { bold: !light });
    case "sep":
      // Never dim seps on light — they vanish on white
      return tmuxFg(theme.sep, text, { dim: !light });
    default:
      return tmuxFg(theme.value, text, { bold: true });
  }
}

/** Quiet live/stale markers (no blink; codex aesthetic prefers stillness). */
export function tmuxLiveMark(
  theme: HudTheme,
  live: boolean,
  options: { calm?: boolean } = {},
): string {
  const mark = live ? "●" : "○";
  if (!live) {
    return tmuxFg(theme.stale, mark, {
      dim: !isLightTheme(theme),
      italics: true,
    });
  }
  // calm: solid accent without extra flash attributes
  return tmuxFg(theme.live, mark, {
    bold: !options.calm && !isLightTheme(theme),
  });
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
  const light = isLightTheme(theme);
  // Light: solid paper bg + dark ink. Dark: default/transparent + nobold base.
  const statusStyle = light
    ? `bg=${theme.statusBg},fg=${theme.statusFg},nobold`
    : `bg=${theme.statusBg === "default" ? "default" : theme.statusBg},fg=${theme.statusFg},nobold`;
  return {
    statusStyle,
    statusLeft: "",
    statusRightTemplate: (filePath: string) =>
      `#(cat ${filePath} 2>/dev/null)`,
    statusInterval: "1",
    // allow strip to use full client width (was 0 / cramped)
    statusRightLength: "500",
    statusLeftLength: "500",
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
