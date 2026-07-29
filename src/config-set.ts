/**
 * Non-interactive config mutations: grok-hud set key=value
 */
import path from "node:path";
import {
  applyAesthetic,
  applyPreset,
  configPath,
  loadHudConfig,
  saveHudConfig,
  type HudAesthetic,
  type HudDisplayConfig,
  type HudPreset,
} from "./hud-config.js";
import { normalizeLang } from "./i18n.js";

export interface SetResult {
  ok: boolean;
  key: string;
  value: string;
  path?: string;
  error?: string;
}

const BOOL_TRUE = new Set(["1", "true", "on", "yes", "y"]);
const BOOL_FALSE = new Set(["0", "false", "off", "no", "n"]);

function parseBool(raw: string): boolean | null {
  const s = raw.trim().toLowerCase();
  if (BOOL_TRUE.has(s)) return true;
  if (BOOL_FALSE.has(s)) return false;
  return null;
}

/** Parse `key=value` or `key value` pairs from argv tokens after `set`. */
export function parseSetPairs(
  tokens: string[],
): Array<{ key: string; value: string }> {
  const out: Array<{ key: string; value: string }> = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]!;
    if (t.includes("=")) {
      const eq = t.indexOf("=");
      const key = t.slice(0, eq).trim();
      const value = t.slice(eq + 1).trim();
      if (key) out.push({ key, value });
      continue;
    }
    const next = tokens[i + 1];
    if (next != null && !next.includes("=")) {
      out.push({ key: t, value: next });
      i += 1;
    }
  }
  return out;
}

const DISPLAY_BOOL: Record<string, keyof HudDisplayConfig["display"]> = {
  showgitfilestats: "showGitFileStats",
  gitfilestats: "showGitFileStats",
  showcompactions: "showCompactions",
  compactions: "showCompactions",
  showspeed: "showSpeed",
  speed: "showSpeed",
  showgitaheadbehind: "showGitAheadBehind",
  aheadbehind: "showGitAheadBehind",
  showdiffstats: "showDiffStats",
  showtokenbreakdown: "showTokenBreakdown",
  tokens: "showTokenBreakdown",
  showgit: "showGit",
  showgitdirty: "showGitDirty",
  showusage: "showUsage",
  showtoolactivity: "showToolActivity",
  showagents: "showAgents",
  showtodos: "showTodos",
  showtitle: "showTitle",
  showlive: "showLive",
};

function normKey(key: string): string {
  return key.trim().toLowerCase().replace(/[_\s]/g, "");
}

/**
 * Apply one key=value onto config (in memory).
 */
export function applyConfigSet(
  cfg: HudDisplayConfig,
  key: string,
  value: string,
): { cfg: HudDisplayConfig; error?: string } {
  const k = normKey(key.replace(/^display\./i, ""));
  const v = value.trim();

  if (k === "aesthetic" || k === "style") {
    if (v !== "classic" && v !== "codex" && v !== "dense") {
      return { cfg, error: "aesthetic must be classic|codex|dense" };
    }
    return { cfg: applyAesthetic(v as HudAesthetic, cfg) };
  }
  if (k === "preset") {
    if (v !== "full" && v !== "essential" && v !== "minimal") {
      return { cfg, error: "preset must be full|essential|minimal" };
    }
    const lang = cfg.language;
    const next = applyPreset(v as HudPreset);
    return { cfg: { ...next, language: lang } };
  }
  if (k === "language" || k === "lang") {
    return { cfg: { ...cfg, language: normalizeLang(v) } };
  }
  if (k === "autodensebelow" || k === "autodense") {
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0) {
      return { cfg, error: "autoDenseBelow must be a number ≥ 0" };
    }
    return { cfg: { ...cfg, autoDenseBelow: Math.floor(n) } };
  }
  if (k === "timeformat") {
    if (v !== "relative" && v !== "absolute" && v !== "both") {
      return { cfg, error: "timeFormat must be relative|absolute|both" };
    }
    return { cfg: { ...cfg, timeFormat: v } };
  }
  if (k === "usageemphasisthreshold" || k === "usageemphasis") {
    const n = Number(v);
    if (!Number.isFinite(n)) {
      return { cfg, error: "usageEmphasisThreshold must be a number" };
    }
    return { cfg: { ...cfg, usageEmphasisThreshold: n } };
  }
  if (k === "statuslines" || k === "rows") {
    const n = Number(v);
    if (n !== 1 && n !== 2 && n !== 3) {
      return { cfg, error: "statusLines must be 1|2|3" };
    }
    return { cfg: { ...cfg, statusLines: n as 1 | 2 | 3 } };
  }
  if (k === "separator") {
    if (v !== "middot" && v !== "pipe" && v !== "space") {
      return { cfg, error: "separator must be middot|pipe|space" };
    }
    return { cfg: { ...cfg, separator: v } };
  }
  if (k === "barstyle") {
    if (v !== "block" && v !== "thin" && v !== "dot") {
      return { cfg, error: "barStyle must be block|thin|dot" };
    }
    return { cfg: { ...cfg, barStyle: v } };
  }
  if (k === "alignlabels" || k === "align") {
    const b = parseBool(v);
    if (b == null) return { cfg, error: "alignLabels needs true|false" };
    return { cfg: { ...cfg, alignLabels: b } };
  }

  const field = DISPLAY_BOOL[k];
  if (field) {
    const b = parseBool(v);
    if (b == null) {
      return { cfg, error: `${field} needs true|false|on|off` };
    }
    return {
      cfg: {
        ...cfg,
        display: { ...cfg.display, [field]: b },
      },
    };
  }

  return {
    cfg,
    error: `unknown key "${key}". Try: aesthetic, preset, language, autoDenseBelow, showGitFileStats, showCompactions, showSpeed, …`,
  };
}

export function applyConfigSets(
  grokHome: string,
  pairs: Array<{ key: string; value: string }>,
): { ok: boolean; results: SetResult[]; cfg: HudDisplayConfig; path: string } {
  let cfg = loadHudConfig(grokHome);
  const results: SetResult[] = [];
  let ok = true;
  for (const { key, value } of pairs) {
    const r = applyConfigSet(cfg, key, value);
    if (r.error) {
      ok = false;
      results.push({ ok: false, key, value, error: r.error });
    } else {
      cfg = r.cfg;
      results.push({ ok: true, key, value });
    }
  }
  const p = configPath(grokHome);
  if (ok) {
    saveHudConfig(cfg, grokHome);
    for (const r of results) r.path = p;
  }
  return { ok, results, cfg, path: p };
}

export function formatSetHelp(): string {
  return `grok-hud set key=value [key=value …]

Examples:
  grok-hud set aesthetic=codex
  grok-hud set language=zh showSpeed=on
  grok-hud set autoDenseBelow=60
  grok-hud set showGitFileStats=true showCompactions=on

Keys: aesthetic | preset | language | autoDenseBelow | timeFormat
      usageEmphasisThreshold | statusLines | separator | barStyle | alignLabels
      showGitFileStats | showCompactions | showSpeed | showGitAheadBehind
      showDiffStats | showTokenBreakdown | showTitle | …

Config: ${path.join("~/.grok/hud", "config.json")}`;
}
