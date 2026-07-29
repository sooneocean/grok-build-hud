/**
 * Grok Build HUD display config + presets.
 * Stored at ~/.grok/hud/config.json
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

export type HudPreset = "full" | "essential" | "minimal";
export type LineLayout = "expanded" | "compact";
/** Visual language inspired by Codex App calm chrome. */
export type HudAesthetic = "classic" | "codex" | "dense";
export type HudDensity = "comfortable" | "compact" | "dense";
export type SeparatorStyle = "middot" | "pipe" | "space";
export type BarStyle = "block" | "thin" | "dot";
export type TimeFormatMode = "relative" | "absolute" | "both";

/** Orderable body elements (Claude-HUD style). */
export type HudElement =
  | "project"
  | "context"
  | "usage"
  | "tokens"
  | "meta"
  | "tools"
  | "agents"
  | "todos";

/** First-line segments (identity row). */
export type FirstLineSegment =
  | "model"
  | "project"
  | "live"
  | "title"
  | "effort";

export type ContextValueMode = "percent" | "tokens" | "remaining" | "both";
export type UsageValueMode = "percent" | "remaining";

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
  /**
   * Expanded-mode element order. Omitted elements are hidden even if show* is true
   * when elementOrder is explicitly set; default order uses show* flags only.
   */
  elementOrder?: HudElement[];
  /**
   * Groups of elements that share one line when adjacent in elementOrder.
   * Default: context + usage (+ tokens + meta) on one metrics line.
   */
  mergeGroups?: HudElement[][];
  /** Optional reorder of first-line segments; visibility still from display.show*. */
  projectLineOrder?: FirstLineSegment[];
  /** Pad 窗/额 labels to the same visual width before bars. */
  alignLabels?: boolean;
  /**
   * Visual language: classic (0.4.x default), codex (calm Codex-app-like),
   * dense (chip-like, narrow windows).
   */
  aesthetic?: HudAesthetic;
  /** Spacing / bar / token density. Overridden by aesthetic presets unless set. */
  density?: HudDensity;
  /** Field separator on plain lines. */
  separator?: SeparatorStyle;
  /** Progress track glyph style. */
  barStyle?: BarStyle;
  /**
   * Hide exact token breakdown until context % reaches this (codex calm).
   * 0 = always show when showTokenBreakdown. Default 0 for classic, 70 for codex.
   */
  tokenRevealAtContextPercent?: number;
  /**
   * Optional palette overrides (hex or named). Merged onto resolved theme.
   * Keys: ok, warn, crit, label, value, sep, mark, live, stale, barEmpty, statusBg, statusFg
   */
  colors?: Partial<{
    ok: string;
    warn: string;
    crit: string;
    label: string;
    value: string;
    sep: string;
    mark: string;
    live: string;
    stale: string;
    barEmpty: string;
    statusBg: string;
    statusFg: string;
  }>;
  /**
   * Usage reset display: relative countdown, wall clock, or both.
   */
  timeFormat?: TimeFormatMode;
  /**
   * Only apply warn/crit emphasis to usage when used% ≥ this (codex calm).
   * Context always uses warningThreshold/criticalThreshold.
   * Default 0 = always emphasize by ladder; codex uses 80.
   */
  usageEmphasisThreshold?: number;
  /** Read usage from this sidecar JSON if billing misses (optional). */
  externalUsagePath?: string;
  /** Write billing usage snapshot here (absolute .json); default ~/.grok/hud/usage-sidecar.json */
  externalUsageWritePath?: string;
  /** Sidecar max age ms (default 300000). */
  externalUsageFreshnessMs?: number;
  /**
   * When terminal width (cols) is below this, render dense chip for this paint.
   * 0 = disabled. codex/dense defaults to 60 if unset in config file.
   */
  autoDenseBelow?: number;
  display: {
    showModel: boolean;
    showProject: boolean;
    showGit: boolean;
    showGitDirty: boolean;
    /** Show ↑N ↓N ahead/behind remote (default true for classic full). */
    showGitAheadBehind: boolean;
    /** Show porcelain file counts `!M +A ✘D ?U` (opt-in, default false). */
    showGitFileStats: boolean;
    showContextBar: boolean;
    /** percent | tokens | remaining | both */
    contextValue: ContextValueMode;
    showUsage: boolean;
    /** percent | remaining — remaining = 100 - used% */
    usageValue: UsageValueMode;
    showProductBreakdown: boolean;
    showSessionTime: boolean;
    showTurns: boolean;
    showTools: boolean;
    showToolActivity: boolean;
    showAgents: boolean;
    showTodos: boolean;
    showErrors: boolean;
    showDiffStats: boolean;
    /** Session compaction count from signals (opt-in; hidden until >0). */
    showCompactions: boolean;
    /** Output tok/s from successive samples (opt-in). */
    showSpeed: boolean;
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

export const DEFAULT_ELEMENT_ORDER: HudElement[] = [
  "project",
  "context",
  "usage",
  "tokens",
  "meta",
  "tools",
  "agents",
  "todos",
];

export const DEFAULT_MERGE_GROUPS: HudElement[][] = [
  ["context", "usage", "tokens", "meta"],
];

export const DEFAULT_PROJECT_LINE_ORDER: FirstLineSegment[] = [
  "model",
  "project",
  "live",
  "title",
  "effort",
];

export const PRESET_FULL: HudDisplayConfig = {
  preset: "full",
  lineLayout: "expanded",
  pathLevels: 2,
  /** Default UI language: English (switch to 中文 in settings) */
  language: "en",
  statusLines: 3,
  bold: true,
  barWidth: 14,
  elementOrder: [...DEFAULT_ELEMENT_ORDER],
  mergeGroups: DEFAULT_MERGE_GROUPS.map((g) => [...g]),
  projectLineOrder: [...DEFAULT_PROJECT_LINE_ORDER],
  alignLabels: true,
  aesthetic: "classic",
  density: "comfortable",
  separator: "pipe",
  barStyle: "block",
  tokenRevealAtContextPercent: 0,
  timeFormat: "relative",
  usageEmphasisThreshold: 0,
  autoDenseBelow: 0,
  display: {
    showModel: true,
    showProject: true,
    showGit: true,
    showGitDirty: true,
    showGitAheadBehind: true,
    showGitFileStats: false,
    showContextBar: true,
    contextValue: "both",
    showUsage: true,
    usageValue: "percent",
    showProductBreakdown: true,
    showSessionTime: true,
    showTurns: true,
    showTools: true,
    showToolActivity: true,
    showAgents: true,
    showTodos: true,
    showErrors: true,
    showDiffStats: true,
    showCompactions: false,
    showSpeed: false,
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
  barWidth: 12,
  density: "compact",
  separator: "middot",
  tokenRevealAtContextPercent: 70,
  projectLineOrder: ["model", "project", "live"],
  elementOrder: [
    "project",
    "context",
    "usage",
    "tools",
    "agents",
    "todos",
  ],
  mergeGroups: [["context", "usage"]],
  display: {
    ...PRESET_FULL.display,
    showProductBreakdown: true,
    showTodos: true,
    showAgents: true,
    showDiffStats: false,
    showGitFileStats: false,
    showGitAheadBehind: false,
    showCompactions: false,
    showSpeed: false,
    showTitle: false,
    contextValue: "percent",
    usageValue: "percent",
    showTokenBreakdown: true,
    tokenScope: "last",
    tokenDigits: "short",
    showSessionTime: false,
    showTurns: false,
    showTools: false,
  },
};

export const PRESET_MINIMAL: HudDisplayConfig = {
  ...PRESET_FULL,
  preset: "minimal",
  lineLayout: "compact",
  statusLines: 1,
  bold: true,
  barWidth: 14,
  elementOrder: ["project", "context", "usage"],
  mergeGroups: [["context", "usage"]],
  alignLabels: false,
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
    showGitFileStats: false,
    showGitAheadBehind: false,
    showCompactions: false,
    showSpeed: false,
    showTitle: false,
    contextValue: "percent",
    usageValue: "percent",
    showTokenBreakdown: true,
    tokenScope: "last",
    tokenDigits: "short",
  },
};

const VALID_ELEMENTS = new Set<string>(DEFAULT_ELEMENT_ORDER);
const VALID_SEGMENTS = new Set<string>(DEFAULT_PROJECT_LINE_ORDER);

function sanitizeElementOrder(raw: unknown): HudElement[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: HudElement[] = [];
  for (const x of raw) {
    if (typeof x === "string" && VALID_ELEMENTS.has(x) && !out.includes(x as HudElement)) {
      out.push(x as HudElement);
    }
  }
  return out.length ? out : undefined;
}

function sanitizeMergeGroups(raw: unknown): HudElement[][] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const groups: HudElement[][] = [];
  for (const g of raw) {
    if (!Array.isArray(g)) continue;
    const row: HudElement[] = [];
    for (const x of g) {
      if (typeof x === "string" && VALID_ELEMENTS.has(x) && !row.includes(x as HudElement)) {
        row.push(x as HudElement);
      }
    }
    if (row.length) groups.push(row);
  }
  return groups;
}

function sanitizeProjectLineOrder(raw: unknown): FirstLineSegment[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: FirstLineSegment[] = [];
  for (const x of raw) {
    if (
      typeof x === "string" &&
      VALID_SEGMENTS.has(x) &&
      !out.includes(x as FirstLineSegment)
    ) {
      out.push(x as FirstLineSegment);
    }
  }
  return out.length ? out : undefined;
}

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
        language: "en",
        elementOrder: [...DEFAULT_ELEMENT_ORDER],
        mergeGroups: DEFAULT_MERGE_GROUPS.map((g) => [...g]),
        projectLineOrder: [...DEFAULT_PROJECT_LINE_ORDER],
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
    const elementOrder =
      sanitizeElementOrder(raw.elementOrder) ??
      (base.elementOrder ? [...base.elementOrder] : [...DEFAULT_ELEMENT_ORDER]);
    const mergeGroups =
      sanitizeMergeGroups(raw.mergeGroups) ??
      (base.mergeGroups
        ? base.mergeGroups.map((g) => [...g])
        : DEFAULT_MERGE_GROUPS.map((g) => [...g]));
    const projectLineOrder =
      sanitizeProjectLineOrder(raw.projectLineOrder) ??
      (base.projectLineOrder
        ? [...base.projectLineOrder]
        : [...DEFAULT_PROJECT_LINE_ORDER]);
    const aesthetic = normalizeAesthetic(raw.aesthetic ?? base.aesthetic);
    const calmAesthetic = aesthetic === "codex" || aesthetic === "dense";
    return {
      ...base,
      ...raw,
      language: raw.language ?? base.language ?? "en",
      bold: raw.bold ?? base.bold ?? true,
      barWidth: raw.barWidth ?? base.barWidth ?? 14,
      statusLines: raw.statusLines ?? base.statusLines ?? 3,
      elementOrder,
      mergeGroups,
      projectLineOrder,
      alignLabels: raw.alignLabels ?? base.alignLabels ?? true,
      aesthetic,
      density: normalizeDensity(raw.density ?? base.density),
      separator: normalizeSeparator(raw.separator ?? base.separator),
      barStyle: normalizeBarStyle(raw.barStyle ?? base.barStyle),
      tokenRevealAtContextPercent:
        typeof raw.tokenRevealAtContextPercent === "number"
          ? raw.tokenRevealAtContextPercent
          : calmAesthetic
            ? (base.tokenRevealAtContextPercent ?? 70)
            : (base.tokenRevealAtContextPercent ?? 0),
      colors: {
        ...(base.colors ?? {}),
        ...((raw.colors as HudDisplayConfig["colors"]) ?? {}),
      },
      warningThreshold:
        typeof raw.warningThreshold === "number"
          ? raw.warningThreshold
          : (base.warningThreshold ?? 70),
      criticalThreshold:
        typeof raw.criticalThreshold === "number"
          ? raw.criticalThreshold
          : (base.criticalThreshold ?? 90),
      timeFormat: normalizeTimeFormat(
        raw.timeFormat ?? base.timeFormat ?? "relative",
      ),
      usageEmphasisThreshold:
        typeof raw.usageEmphasisThreshold === "number"
          ? raw.usageEmphasisThreshold
          : calmAesthetic
            ? 80
            : (base.usageEmphasisThreshold ?? 0),
      // Explicit 0 in JSON disables; missing field → 60 for codex/dense, else 0
      autoDenseBelow:
        typeof raw.autoDenseBelow === "number"
          ? raw.autoDenseBelow
          : calmAesthetic
            ? 60
            : (base.autoDenseBelow ?? 0),
      externalUsagePath: raw.externalUsagePath ?? base.externalUsagePath,
      externalUsageWritePath:
        raw.externalUsageWritePath ?? base.externalUsageWritePath,
      externalUsageFreshnessMs:
        typeof raw.externalUsageFreshnessMs === "number"
          ? raw.externalUsageFreshnessMs
          : (base.externalUsageFreshnessMs ?? 300_000),
      display: {
        ...base.display,
        ...(raw.display ?? {}),
        usageValue:
          raw.display?.usageValue === "remaining" ||
          raw.display?.usageValue === "percent"
            ? raw.display.usageValue
            : base.display.usageValue ?? "percent",
        contextValue: normalizeContextValue(
          raw.display?.contextValue ?? base.display.contextValue,
        ),
      },
    };
  } catch {
    return {
      ...PRESET_FULL,
      language: "en",
      elementOrder: [...DEFAULT_ELEMENT_ORDER],
      mergeGroups: DEFAULT_MERGE_GROUPS.map((g) => [...g]),
      projectLineOrder: [...DEFAULT_PROJECT_LINE_ORDER],
      display: { ...PRESET_FULL.display },
    };
  }
}

function normalizeContextValue(v: unknown): ContextValueMode {
  if (v === "percent" || v === "tokens" || v === "remaining" || v === "both") {
    return v;
  }
  return "percent";
}

function normalizeAesthetic(v: unknown): HudAesthetic {
  if (v === "codex" || v === "dense" || v === "classic") return v;
  return "classic";
}

function normalizeDensity(v: unknown): HudDensity {
  if (v === "compact" || v === "dense" || v === "comfortable") return v;
  return "comfortable";
}

function normalizeSeparator(v: unknown): SeparatorStyle {
  if (v === "pipe" || v === "space" || v === "middot") return v;
  return "pipe";
}

function normalizeBarStyle(v: unknown): BarStyle {
  if (v === "thin" || v === "dot" || v === "block") return v;
  return "block";
}

function normalizeTimeFormat(v: unknown): TimeFormatMode {
  if (v === "absolute" || v === "both" || v === "relative") return v;
  return "relative";
}

/** Ensure config exists with English default (idempotent). */
export function ensureDefaultConfig(
  grokHome = path.join(os.homedir(), ".grok"),
): HudDisplayConfig {
  const p = configPath(grokHome);
  if (!fs.existsSync(p)) {
    const cfg = {
      ...PRESET_FULL,
      language: "en" as const,
      elementOrder: [...DEFAULT_ELEMENT_ORDER],
      mergeGroups: DEFAULT_MERGE_GROUPS.map((g) => [...g]),
      projectLineOrder: [...DEFAULT_PROJECT_LINE_ORDER],
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
  if (preset === "minimal") {
    return {
      ...PRESET_MINIMAL,
      elementOrder: PRESET_MINIMAL.elementOrder
        ? [...PRESET_MINIMAL.elementOrder]
        : undefined,
      mergeGroups: PRESET_MINIMAL.mergeGroups?.map((g) => [...g]),
      projectLineOrder: PRESET_MINIMAL.projectLineOrder
        ? [...PRESET_MINIMAL.projectLineOrder]
        : undefined,
      display: { ...PRESET_MINIMAL.display },
    };
  }
  if (preset === "essential") {
    return {
      ...PRESET_ESSENTIAL,
      elementOrder: PRESET_ESSENTIAL.elementOrder
        ? [...PRESET_ESSENTIAL.elementOrder]
        : undefined,
      mergeGroups: PRESET_ESSENTIAL.mergeGroups?.map((g) => [...g]),
      projectLineOrder: PRESET_ESSENTIAL.projectLineOrder
        ? [...PRESET_ESSENTIAL.projectLineOrder]
        : undefined,
      display: { ...PRESET_ESSENTIAL.display },
    };
  }
  return {
    ...PRESET_FULL,
    elementOrder: [...DEFAULT_ELEMENT_ORDER],
    mergeGroups: DEFAULT_MERGE_GROUPS.map((g) => [...g]),
    projectLineOrder: [...DEFAULT_PROJECT_LINE_ORDER],
    display: { ...PRESET_FULL.display },
  };
}

/** Codex-app-like calm defaults layered on a base config (keeps language). */
export function applyAesthetic(
  aesthetic: HudAesthetic,
  base?: HudDisplayConfig,
): HudDisplayConfig {
  const lang = base?.language ?? "en";
  const root =
    base ??
    ({
      ...PRESET_FULL,
      elementOrder: [...DEFAULT_ELEMENT_ORDER],
      mergeGroups: DEFAULT_MERGE_GROUPS.map((g) => [...g]),
      projectLineOrder: [...DEFAULT_PROJECT_LINE_ORDER],
      display: { ...PRESET_FULL.display },
    } as HudDisplayConfig);

  if (aesthetic === "classic") {
    return {
      ...root,
      language: lang,
      aesthetic: "classic",
      density: "comfortable",
      separator: "pipe",
      barStyle: "block",
      barWidth: 14,
      tokenRevealAtContextPercent: 0,
      alignLabels: true,
      display: {
        ...root.display,
        contextValue: "both",
        tokenDigits: "exact",
        showTitle: true,
      },
    };
  }

  if (aesthetic === "dense") {
    return {
      ...root,
      language: lang,
      aesthetic: "dense",
      density: "dense",
      separator: "space",
      barStyle: "dot",
      barWidth: 6,
      statusLines: 1,
      lineLayout: "compact",
      tokenRevealAtContextPercent: 85,
      timeFormat: "relative",
      usageEmphasisThreshold: 80,
      autoDenseBelow: 60,
      alignLabels: false,
      projectLineOrder: ["model", "project", "live"],
      elementOrder: ["project", "context", "usage", "meta", "tools"],
      mergeGroups: [["context", "usage", "meta"]],
      display: {
        ...root.display,
        contextValue: "percent",
        usageValue: "percent",
        tokenDigits: "short",
        showTitle: false,
        showSessionTime: false,
        showTurns: false,
        showTools: false,
        showTokenBreakdown: false,
        showProductBreakdown: false,
        showDiffStats: false,
        showCompactions: false,
        showSpeed: false,
        showGitFileStats: false,
        showGitAheadBehind: false,
        showTodos: false,
        showAgents: false,
        showToolActivity: true,
      },
    };
  }

  // codex — recommended calm strip (D1: health line = 窗+额 only)
  return {
    ...root,
    language: lang,
    aesthetic: "codex",
    density: "compact",
    separator: "middot",
    barStyle: "thin",
    barWidth: 10,
    statusLines: 2,
    tokenRevealAtContextPercent: 70,
    timeFormat: "relative",
    usageEmphasisThreshold: 80,
    autoDenseBelow: 60,
    alignLabels: true,
    projectLineOrder: ["model", "project", "live"],
    elementOrder: [
      "project",
      "context",
      "usage",
      "meta",
      "tools",
      "agents",
      "todos",
    ],
    mergeGroups: [["context", "usage", "meta"]],
    display: {
      ...root.display,
      contextValue: "percent",
      usageValue: "percent",
      tokenDigits: "short",
      tokenScope: "last",
      showTitle: false,
      showTokenBreakdown: true,
      showProductBreakdown: true,
      showSessionTime: false,
      showTurns: false,
      showTools: false,
      showDiffStats: false,
      showCompactions: false,
      showSpeed: false,
      showGitFileStats: false,
      showErrors: false,
      showToolActivity: true,
      showAgents: true,
      showTodos: true,
    },
  };
}

export function separatorString(style?: SeparatorStyle): string {
  if (style === "pipe") return " │ ";
  if (style === "space") return "  ";
  return " · "; // middot default for codex calm
}

export function barChars(style?: BarStyle): { filled: string; empty: string } {
  if (style === "thin") return { filled: "━", empty: "─" };
  if (style === "dot") return { filled: "●", empty: "○" };
  return { filled: "█", empty: "░" };
}

/** Documented display option keys (for settings / docs). */
export const DISPLAY_OPTION_KEYS = [
  "display.showModel",
  "display.showContextBar",
  "display.contextValue",
  "display.usageValue",
  "display.showUsage",
  "display.showSessionTime",
  "display.showGit",
  "display.showGitDirty",
  "display.showToolActivity",
  "display.showAgents",
  "display.showTodos",
  "display.showTokenBreakdown",
  "elementOrder",
  "mergeGroups",
  "alignLabels",
  "lineLayout",
  "pathLevels",
  "language",
  "preset",
] as const;
