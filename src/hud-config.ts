/**
 * Grok Build HUD display config + presets.
 * Stored at ~/.grok/hud/config.json
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

export type HudPreset = "full" | "essential" | "minimal";
export type LineLayout = "expanded" | "compact";

export interface HudDisplayConfig {
  preset: HudPreset;
  lineLayout: LineLayout;
  pathLevels: 1 | 2 | 3;
  language: "en" | "zh-Hans" | "zh-Hant";
  /** Multi-line tmux status rows (1–3). Expanded default 3. */
  statusLines: 1 | 2 | 3;
  /** Bold labels/values in tmux status (default true — easier to read). */
  bold: boolean;
  /** Context/usage bar width in cells (default 12). */
  barWidth: number;
  display: {
    showModel: boolean;
    showProject: boolean;
    showGit: boolean;
    showGitDirty: boolean;
    showContextBar: boolean;
    /** percent | tokens | both */
    contextValue: "percent" | "tokens" | "both";
    showUsage: boolean;
    showProductBreakdown: boolean;
    showSessionTime: boolean;
    showTurns: boolean;
    showTools: boolean;
    showToolActivity: boolean;
    showAgents: boolean;
    showTodos: boolean;
    showErrors: boolean;
    showDiffStats: boolean;
    showLive: boolean;
    showTitle: boolean;
    /** Show input/output/cache token breakdown (exact integers). */
    showTokenBreakdown: boolean;
    /**
     * Which token totals to show: last completed turn, session sum, or both.
     * Default "last" (most relevant); full status.txt also prints session sum.
     */
    tokenScope: "last" | "session" | "both";
    /** exact = 974,820 full digits; short = 974.8k */
    tokenDigits: "exact" | "short";
  };
  warningThreshold: number;
  criticalThreshold: number;
}

export const PRESET_FULL: HudDisplayConfig = {
  preset: "full",
  lineLayout: "expanded",
  pathLevels: 2,
  /** Default UI language: 简体中文 (switch to en in settings) */
  language: "zh-Hans",
  statusLines: 3,
  bold: true,
  barWidth: 14,
  display: {
    showModel: true,
    showProject: true,
    showGit: true,
    showGitDirty: true,
    showContextBar: true,
    contextValue: "both",
    showUsage: true,
    showProductBreakdown: true,
    showSessionTime: true,
    showTurns: true,
    showTools: true,
    showToolActivity: true,
    showAgents: true,
    showTodos: true,
    showErrors: true,
    showDiffStats: true,
    showLive: true,
    showTitle: true,
    showTokenBreakdown: true,
    tokenScope: "both",
    tokenDigits: "exact",
  },
  warningThreshold: 70,
  criticalThreshold: 90,
};

export const PRESET_ESSENTIAL: HudDisplayConfig = {
  ...PRESET_FULL,
  preset: "essential",
  statusLines: 2,
  bold: true,
  barWidth: 14,
  display: {
    ...PRESET_FULL.display,
    showProductBreakdown: false,
    showTodos: true,
    showAgents: true,
    showDiffStats: false,
    showTitle: false,
    contextValue: "percent",
    showTokenBreakdown: true,
    tokenScope: "last",
    tokenDigits: "exact",
  },
};

export const PRESET_MINIMAL: HudDisplayConfig = {
  ...PRESET_FULL,
  preset: "minimal",
  lineLayout: "compact",
  statusLines: 1,
  bold: true,
  barWidth: 14,
  display: {
    ...PRESET_FULL.display,
    showGit: true,
    showGitDirty: true,
    showProductBreakdown: false,
    showSessionTime: false,
    showTurns: false,
    showTools: false,
    showToolActivity: false,
    showAgents: false,
    showTodos: false,
    showErrors: false,
    showDiffStats: false,
    showTitle: false,
    contextValue: "percent",
    showTokenBreakdown: true,
    tokenScope: "last",
    tokenDigits: "short",
  },
};

export function configPath(grokHome = path.join(os.homedir(), ".grok")): string {
  return path.join(grokHome, "hud", "config.json");
}

export function loadHudConfig(
  grokHome = path.join(os.homedir(), ".grok"),
): HudDisplayConfig {
  try {
    const p = configPath(grokHome);
    if (!fs.existsSync(p)) {
      return {
        ...PRESET_FULL,
        language: "zh-Hans",
        display: { ...PRESET_FULL.display },
      };
    }
    const raw = JSON.parse(fs.readFileSync(p, "utf8")) as Partial<HudDisplayConfig>;
    const base =
      raw.preset === "minimal"
        ? PRESET_MINIMAL
        : raw.preset === "essential"
          ? PRESET_ESSENTIAL
          : PRESET_FULL;
    return {
      ...base,
      ...raw,
      // Prefer saved language; default 中文 when missing
      language: raw.language ?? base.language ?? "zh-Hans",
      bold: raw.bold ?? base.bold ?? true,
      barWidth: raw.barWidth ?? base.barWidth ?? 14,
      statusLines: raw.statusLines ?? base.statusLines ?? 3,
      display: { ...base.display, ...(raw.display ?? {}) },
    };
  } catch {
    return {
      ...PRESET_FULL,
      language: "zh-Hans",
      display: { ...PRESET_FULL.display },
    };
  }
}

/** Ensure config exists with Chinese default (idempotent). */
export function ensureDefaultConfig(
  grokHome = path.join(os.homedir(), ".grok"),
): HudDisplayConfig {
  const p = configPath(grokHome);
  if (!fs.existsSync(p)) {
    const cfg = {
      ...PRESET_FULL,
      language: "zh-Hans" as const,
      display: { ...PRESET_FULL.display },
    };
    saveHudConfig(cfg, grokHome);
    return cfg;
  }
  return loadHudConfig(grokHome);
}

export function saveHudConfig(
  cfg: HudDisplayConfig,
  grokHome = path.join(os.homedir(), ".grok"),
): string {
  const p = configPath(grokHome);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(cfg, null, 2) + "\n", "utf8");
  return p;
}

export function applyPreset(preset: HudPreset): HudDisplayConfig {
  if (preset === "minimal") return { ...PRESET_MINIMAL, display: { ...PRESET_MINIMAL.display } };
  if (preset === "essential")
    return { ...PRESET_ESSENTIAL, display: { ...PRESET_ESSENTIAL.display } };
  return { ...PRESET_FULL, display: { ...PRESET_FULL.display } };
}

/** Documented display option keys (for settings / docs). */
export const DISPLAY_OPTION_KEYS = [
  "display.showModel",
  "display.showContextBar",
  "display.contextValue",
  "display.showUsage",
  "display.showSessionTime",
  "display.showGit",
  "display.showGitDirty",
  "display.showToolActivity",
  "display.showAgents",
  "display.showTodos",
  "display.showTokenBreakdown",
  "lineLayout",
  "pathLevels",
  "language",
  "preset",
] as const;
