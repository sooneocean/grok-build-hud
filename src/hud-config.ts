/**
 * Claude-HUD-compatible display config + presets.
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
  };
  warningThreshold: number;
  criticalThreshold: number;
}

export const PRESET_FULL: HudDisplayConfig = {
  preset: "full",
  lineLayout: "expanded",
  pathLevels: 2,
  language: "en",
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
      bold: raw.bold ?? base.bold ?? true,
      barWidth: raw.barWidth ?? base.barWidth ?? 14,
      statusLines: raw.statusLines ?? base.statusLines ?? 3,
      display: { ...base.display, ...(raw.display ?? {}) },
    };
  } catch {
    return {
      ...PRESET_FULL,
      display: { ...PRESET_FULL.display },
    };
  }
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

/** Claude-HUD option name → Grok HUD config path (migration map). */
export const CLAUDE_HUD_MIGRATION: Record<string, string> = {
  "display.showModel": "display.showModel",
  "display.showContextBar": "display.showContextBar",
  "display.contextValue": "display.contextValue",
  "display.showUsage": "display.showUsage",
  "display.showSessionTime / sessionTime": "display.showSessionTime",
  "gitStatus.enabled": "display.showGit",
  "gitStatus.showDirty": "display.showGitDirty",
  "display tools activity": "display.showToolActivity",
  "display agents": "display.showAgents",
  "display todos": "display.showTodos",
  lineLayout: "lineLayout",
  pathLevels: "pathLevels",
  language: "language",
  "presets Full/Essential/Minimal": "preset",
};
