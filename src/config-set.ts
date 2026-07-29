/**
 * Non-interactive config mutations: grok-hud set key=value
 */
import path from "node:path";
import {
  applyAesthetic,
  applyPreset,
  configPath,
  loadHudConfig,
  parseElementOrderCsv,
  parseMergeGroupsCsv,
  parseProjectLineCsv,
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
  if (k === "bold") {
    const b = parseBool(v);
    if (b == null) return { cfg, error: "bold needs true|false" };
    return { cfg: { ...cfg, bold: b } };
  }
  if (k === "density") {
    if (v !== "comfortable" && v !== "compact" && v !== "dense") {
      return { cfg, error: "density must be comfortable|compact|dense" };
    }
    return { cfg: { ...cfg, density: v } };
  }
  if (k === "barwidth") {
    const n = Number(v);
    if (!Number.isFinite(n) || n < 4 || n > 32) {
      return { cfg, error: "barWidth must be 4–32" };
    }
    return { cfg: { ...cfg, barWidth: Math.floor(n) } };
  }
  if (k === "pathlevels") {
    const n = Number(v);
    if (n !== 1 && n !== 2 && n !== 3) {
      return { cfg, error: "pathLevels must be 1|2|3" };
    }
    return { cfg: { ...cfg, pathLevels: n as 1 | 2 | 3 } };
  }
  if (k === "tokenrevealatcontextpercent" || k === "tokenreveal") {
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0 || n > 100) {
      return { cfg, error: "tokenRevealAtContextPercent must be 0–100" };
    }
    return { cfg: { ...cfg, tokenRevealAtContextPercent: n } };
  }
  if (k === "warningthreshold" || k === "warn") {
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0 || n > 100) {
      return { cfg, error: "warningThreshold must be 0–100" };
    }
    return { cfg: { ...cfg, warningThreshold: n } };
  }
  if (k === "criticalthreshold" || k === "crit") {
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0 || n > 100) {
      return { cfg, error: "criticalThreshold must be 0–100" };
    }
    return { cfg: { ...cfg, criticalThreshold: n } };
  }
  if (k === "tokendigits") {
    if (v !== "exact" && v !== "short") {
      return { cfg, error: "tokenDigits must be exact|short" };
    }
    return {
      cfg: {
        ...cfg,
        display: { ...cfg.display, tokenDigits: v },
      },
    };
  }
  if (k === "tokenscope") {
    if (v !== "last" && v !== "session" && v !== "both") {
      return { cfg, error: "tokenScope must be last|session|both" };
    }
    return {
      cfg: {
        ...cfg,
        display: { ...cfg.display, tokenScope: v },
      },
    };
  }
  if (k === "contextvalue") {
    if (
      v !== "percent" &&
      v !== "tokens" &&
      v !== "both" &&
      v !== "remaining"
    ) {
      return {
        cfg,
        error: "contextValue must be percent|tokens|both|remaining",
      };
    }
    return {
      cfg: {
        ...cfg,
        display: { ...cfg.display, contextValue: v },
      },
    };
  }
  if (k === "usagevalue") {
    if (v !== "percent" && v !== "remaining") {
      return { cfg, error: "usageValue must be percent|remaining" };
    }
    return {
      cfg: {
        ...cfg,
        display: { ...cfg.display, usageValue: v },
      },
    };
  }
  if (k === "elementorder" || k === "elements") {
    const order = parseElementOrderCsv(v);
    if (!order?.length) {
      return {
        cfg,
        error:
          "elementOrder needs comma list: project,context,usage,tokens,meta,tools,agents,todos",
      };
    }
    return { cfg: { ...cfg, elementOrder: order } };
  }
  if (k === "projectlineorder" || k === "projectline") {
    const order = parseProjectLineCsv(v);
    if (!order?.length) {
      return {
        cfg,
        error: "projectLineOrder needs: model,project,live,title,effort",
      };
    }
    return { cfg: { ...cfg, projectLineOrder: order } };
  }
  if (k === "mergegroups" || k === "merge") {
    if (v === "" || v === "[]" || v === "none" || v === "off") {
      return { cfg: { ...cfg, mergeGroups: [] } };
    }
    const groups = parseMergeGroupsCsv(v);
    if (!groups?.length) {
      return {
        cfg,
        error: "mergeGroups e.g. context,usage;tools,agents  (or none)",
      };
    }
    return { cfg: { ...cfg, mergeGroups: groups } };
  }
  if (k === "linelayout") {
    if (v !== "expanded" && v !== "compact") {
      return { cfg, error: "lineLayout must be expanded|compact" };
    }
    return { cfg: { ...cfg, lineLayout: v } };
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
    error: `unknown key "${key}". Try: aesthetic, preset, language, autoDenseBelow, barWidth, showGitFileStats, showCompactions, showSpeed, …  (grok-hud get --keys)`,
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
grok-hud get [key]            # print one value or full JSON
grok-hud get --keys           # list settable keys

Examples:
  grok-hud set aesthetic=codex
  grok-hud set language=zh showSpeed=on
  grok-hud set autoDenseBelow=60 barWidth=10
  grok-hud set showGitFileStats=true showCompactions=on
  grok-hud get aesthetic
  grok-hud get display.showSpeed

Keys: aesthetic | preset | language | density | autoDenseBelow | timeFormat
      usageEmphasisThreshold | statusLines | separator | barStyle | barWidth
      pathLevels | tokenReveal | warningThreshold | criticalThreshold
      alignLabels | bold | tokenDigits | tokenScope | contextValue | usageValue
      elementOrder | projectLineOrder | mergeGroups | lineLayout
      showGitFileStats | showCompactions | showSpeed | showGitAheadBehind
      showDiffStats | showTokenBreakdown | showTitle | showLive | …

elementOrder:  project,context,usage,tools
mergeGroups:   context,usage;tools,agents   (or none)
projectLine:   model,project,live

Config: ${path.join("~/.grok/hud", "config.json")}
Privacy: no telemetry — only local files + your Grok auth for quota API.`;
}

/** Dot-path get: aesthetic | display.showSpeed | … */
export function getConfigValue(
  cfg: HudDisplayConfig,
  key?: string,
): { ok: boolean; text: string; error?: string } {
  if (!key || key === "--all" || key === "all") {
    return { ok: true, text: JSON.stringify(cfg, null, 2) };
  }
  if (key === "--keys" || key === "keys") {
    return {
      ok: true,
      text: [
        "aesthetic",
        "preset",
        "language",
        "density",
        "autoDenseBelow",
        "timeFormat",
        "usageEmphasisThreshold",
        "statusLines",
        "separator",
        "barStyle",
        "barWidth",
        "pathLevels",
        "tokenRevealAtContextPercent",
        "warningThreshold",
        "criticalThreshold",
        "alignLabels",
        "bold",
        "tokenDigits",
        "tokenScope",
        "contextValue",
        "usageValue",
        "elementOrder",
        "projectLineOrder",
        "mergeGroups",
        "lineLayout",
        ...Object.values(DISPLAY_BOOL).map((f) => `display.${f}`),
      ].join("\n"),
    };
  }

  const raw = key.trim();
  // display.foo
  if (raw.toLowerCase().startsWith("display.")) {
    const field = raw.slice("display.".length);
    const d = cfg.display as Record<string, unknown>;
    // case-insensitive match
    const hit = Object.keys(d).find(
      (k) => k.toLowerCase() === field.toLowerCase(),
    );
    if (!hit) {
      return { ok: false, text: "", error: `unknown display field: ${field}` };
    }
    return { ok: true, text: String(d[hit]) };
  }

  const k = normKey(raw);
  const top: Record<string, unknown> = {
    aesthetic: cfg.aesthetic,
    preset: cfg.preset,
    language: cfg.language,
    density: cfg.density,
    autodensebelow: cfg.autoDenseBelow,
    timeformat: cfg.timeFormat,
    usageemphasisthreshold: cfg.usageEmphasisThreshold,
    statuslines: cfg.statusLines,
    separator: cfg.separator,
    barstyle: cfg.barStyle,
    barwidth: cfg.barWidth,
    pathlevels: cfg.pathLevels,
    tokenrevealatcontextpercent: cfg.tokenRevealAtContextPercent,
    tokenreveal: cfg.tokenRevealAtContextPercent,
    warningthreshold: cfg.warningThreshold,
    criticalthreshold: cfg.criticalThreshold,
    alignlabels: cfg.alignLabels,
    bold: cfg.bold,
  };
  if (k in top) {
    return { ok: true, text: String(top[k] ?? "") };
  }
  // display bool aliases
  const df = DISPLAY_BOOL[k];
  if (df) {
    return { ok: true, text: String(cfg.display[df]) };
  }
  if (k === "tokendigits") {
    return { ok: true, text: String(cfg.display.tokenDigits) };
  }
  if (k === "tokenscope") {
    return { ok: true, text: String(cfg.display.tokenScope) };
  }
  if (k === "contextvalue") {
    return { ok: true, text: String(cfg.display.contextValue) };
  }
  if (k === "usagevalue") {
    return { ok: true, text: String(cfg.display.usageValue) };
  }
  if (k === "elementorder" || k === "elements") {
    return {
      ok: true,
      text: (cfg.elementOrder ?? []).join(","),
    };
  }
  if (k === "projectlineorder" || k === "projectline") {
    return {
      ok: true,
      text: (cfg.projectLineOrder ?? []).join(","),
    };
  }
  if (k === "mergegroups" || k === "merge") {
    const g = cfg.mergeGroups ?? [];
    return {
      ok: true,
      text: g.map((row) => row.join(",")).join(";"),
    };
  }
  if (k === "linelayout") {
    return { ok: true, text: String(cfg.lineLayout ?? "") };
  }

  return {
    ok: false,
    text: "",
    error: `unknown key "${key}" — try grok-hud get --keys`,
  };
}
