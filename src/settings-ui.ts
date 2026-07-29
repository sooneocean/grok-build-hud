/**
 * Interactive settings UI for language / preset / rows.
 * Default language: English; switchable to 简体中文 / 繁體.
 */
import * as readline from "node:readline";
import {
  applyAesthetic,
  applyPreset,
  loadHudConfig,
  saveHudConfig,
  type HudAesthetic,
  type HudDisplayConfig,
  type HudPreset,
} from "./hud-config.js";
import {
  langLabel,
  normalizeLang,
  t,
  type HudLang,
} from "./i18n.js";
import { previewHud } from "./render/compose.js";
import { defaultGrokHome, emptySessionSnapshot } from "./session.js";
import { ensureFollowMode } from "./theme.js";
import type { UsageSnapshot } from "./types.js";

export interface SettingsUiOptions {
  grokHome?: string;
  /** Non-interactive: set language and exit */
  language?: string;
  stdin?: NodeJS.ReadableStream;
  stdout?: NodeJS.WritableStream;
}

function ask(
  rl: readline.Interface,
  prompt: string,
): Promise<string> {
  return new Promise((resolve) => {
    rl.question(prompt, (ans) => resolve((ans || "").trim()));
  });
}

function printMenu(cfg: HudDisplayConfig, out: (s: string) => void): void {
  const s = t(cfg.language);
  const lang = normalizeLang(cfg.language);
  out("");
  out(`┌─ ${s.settingsTitle} ─────────────────────`);
  out(`│  ${s.settingsHint}`);
  out(`│`);
  out(
    `│  1) ${s.lang.padEnd(14)}  [${langLabel(lang, lang)}]`,
  );
  out(
    `│  2) ${s.preset.padEnd(14)}  [${cfg.preset}]  ${
      cfg.preset === "full"
        ? s.presetFull
        : cfg.preset === "essential"
          ? s.presetEssential
          : s.presetMinimal
    }`,
  );
  out(
    `│  3) ${s.statusLines.padEnd(14)}  [${cfg.statusLines} ${s.rows}]`,
  );
  out(
    `│  4) ${s.tokenBreakdown.padEnd(14)}  [${
      cfg.display.showTokenBreakdown ? s.on : s.off
    }]`,
  );
  out(`│  5) ${s.themeFollow.padEnd(14)}  ${s.themeFollowHint}`);
  out(
    `│  6) ${s.alignLabels.padEnd(14)}  [${cfg.alignLabels !== false ? s.on : s.off}]`,
  );
  out(
    `│  7) ${s.usageRemaining.padEnd(14)}  [${
      cfg.display.usageValue === "remaining" ? s.on : s.off
    }]`,
  );
  out(`│  8) ${s.preview.padEnd(14)}  ${s.previewHint}`);
  const aest = cfg.aesthetic ?? "classic";
  out(
    `│  9) ${s.aesthetic.padEnd(14)}  [${aest}]  ${
      aest === "codex"
        ? s.aestheticCodex
        : aest === "dense"
          ? s.aestheticDense
          : s.aestheticClassic
    }`,
  );
  out(`│`);
  out(`│  ${s.extrasHint}`);
  out(
    `│  a) ${s.gitFileStats.padEnd(14)}  [${cfg.display.showGitFileStats ? s.on : s.off}]`,
  );
  out(
    `│  b) ${s.showCompactions.padEnd(14)}  [${cfg.display.showCompactions ? s.on : s.off}]`,
  );
  out(
    `│  c) ${s.showSpeed.padEnd(14)}  [${cfg.display.showSpeed ? s.on : s.off}]`,
  );
  out(
    `│  d) ${s.showAheadBehind.padEnd(14)}  [${
      cfg.display.showGitAheadBehind !== false ? s.on : s.off
    }]`,
  );
  out(`│`);
  out(`│  0) ${s.saveExit}`);
  out(`│  q) ${s.quitNoSave}`);
  out(`└──────────────────────────────────────`);
  out("");
}

async function pickAesthetic(
  rl: readline.Interface,
  cfg: HudDisplayConfig,
  out: (s: string) => void,
): Promise<HudAesthetic> {
  const s = t(cfg.language);
  out(`  1) classic  — ${s.aestheticClassic}`);
  out(`  2) codex    — ${s.aestheticCodex}`);
  out(`  3) dense    — ${s.aestheticDense}`);
  out(`  b) ${s.back}`);
  const ans = await ask(rl, `  ${s.choose}: `);
  if (ans === "1" || ans === "classic") return "classic";
  if (ans === "2" || ans === "codex") return "codex";
  if (ans === "3" || ans === "dense") return "dense";
  return cfg.aesthetic ?? "classic";
}

function samplePreview(cfg: HudDisplayConfig): string {
  const snap = emptySessionSnapshot({
    sessionId: "preview",
    model: "grok-4.5",
    cwd: "/Users/dex/demo/CoachFlow",
    live: true,
    contextPercent: 42,
    contextTokensUsed: 210_000,
    contextWindowTokens: 500_000,
    turnCount: 4,
    toolCallCount: 18,
    durationSeconds: 900,
    title: "Preview HUD layout",
    branch: "main",
    gitDirty: true,
    gitAhead: 1,
    gitFileStats: { modified: 2, added: 1, deleted: 0, untracked: 1 },
    compactionCount: 1,
    outputTokensPerSecond: 38.2,
    tools: [
      {
        id: "1",
        name: "read_file",
        status: "running",
        detail: "auth.ts",
      },
      { id: "2", name: "grep", status: "completed", count: 3 },
    ],
    agents: [
      {
        id: "a1",
        title: "Explore project",
        status: "active",
        detail: "scout",
      },
    ],
    todos: [
      { content: "Ship compose pipeline", status: "in_progress" },
      { content: "Write tests", status: "completed" },
    ],
    lastTurnTokens: {
      inputTokens: 120_000,
      outputTokens: 800,
      cachedReadTokens: 100_000,
      reasoningTokens: 200,
      totalTokens: 120_800,
      modelCalls: 2,
      cacheHitPct: 83,
    },
  });
  const usage: UsageSnapshot = {
    available: true,
    percent: 24,
    used: 36_000,
    limit: 150_000,
    period: "weekly",
    resetsIn: "3h",
    message: "GrokBuild 12%",
  };
  return previewHud(snap, usage, cfg);
}

async function pickLanguage(
  rl: readline.Interface,
  cfg: HudDisplayConfig,
  out: (s: string) => void,
): Promise<HudLang> {
  const s = t(cfg.language);
  out(`  1) ${s.langEn}  (default)`);
  out(`  2) ${s.langZh}`);
  out(`  3) ${s.langZhHant}`);
  out(`  b) ${s.back}`);
  const ans = await ask(rl, `  ${s.choose}: `);
  if (ans === "1" || ans === "en") return "en";
  if (ans === "2" || ans === "zh" || ans === "cn") return "zh-Hans";
  if (ans === "3" || ans === "tw" || ans === "hant") return "zh-Hant";
  return normalizeLang(cfg.language);
}

async function pickPreset(
  rl: readline.Interface,
  cfg: HudDisplayConfig,
  out: (s: string) => void,
): Promise<HudPreset> {
  const s = t(cfg.language);
  out(`  1) full       — ${s.presetFull}`);
  out(`  2) essential  — ${s.presetEssential}`);
  out(`  3) minimal    — ${s.presetMinimal}`);
  out(`  b) ${s.back}`);
  const ans = await ask(rl, `  ${s.choose}: `);
  if (ans === "1" || ans === "full") return "full";
  if (ans === "2" || ans === "essential") return "essential";
  if (ans === "3" || ans === "minimal") return "minimal";
  return cfg.preset;
}

async function pickRows(
  rl: readline.Interface,
  cfg: HudDisplayConfig,
  out: (s: string) => void,
): Promise<1 | 2 | 3> {
  const s = t(cfg.language);
  out(`  1) 1 ${s.rows}`);
  out(`  2) 2 ${s.rows}`);
  out(`  3) 3 ${s.rows}`);
  out(`  b) ${s.back}`);
  const ans = await ask(rl, `  ${s.choose}: `);
  if (ans === "1") return 1;
  if (ans === "2") return 2;
  if (ans === "3") return 3;
  return cfg.statusLines;
}

/**
 * Interactive settings loop. Returns saved config or null if cancelled.
 */
export async function runSettingsUi(
  options: SettingsUiOptions = {},
): Promise<HudDisplayConfig | null> {
  const grokHome = options.grokHome ?? defaultGrokHome();
  const stdout = options.stdout ?? process.stdout;
  const out = (s: string) => {
    stdout.write(s + (s.endsWith("\n") ? "" : "\n"));
  };

  let cfg = loadHudConfig(grokHome);
  // Non-interactive language set
  if (options.language) {
    cfg = {
      ...cfg,
      language: normalizeLang(options.language),
    };
    const path = saveHudConfig(cfg, grokHome);
    const s = t(cfg.language);
    out(
      `${s.languageSet} ${langLabel(normalizeLang(cfg.language), normalizeLang(cfg.language))}`,
    );
    out(`  → ${path}`);
    return cfg;
  }

  // Default to Chinese if somehow empty
  if (!cfg.language) {
    cfg = { ...cfg, language: "en" };
  }

  const rl = readline.createInterface({
    input: options.stdin ?? process.stdin,
    output: stdout,
    terminal: true,
  });

  let dirty = false;
  try {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      printMenu(cfg, out);
      const s = t(cfg.language);
      const ans = await ask(rl, `  > `);
      if (ans === "0" || ans === "s" || ans === "save") {
        ensureFollowMode(grokHome);
        const path = saveHudConfig(cfg, grokHome);
        out(`${s.saved}: ${path}`);
        out(
          `  ${s.lang}: ${langLabel(normalizeLang(cfg.language), normalizeLang(cfg.language))} · ${s.preset}: ${cfg.preset} · ${s.statusLines}: ${cfg.statusLines}`,
        );
        return cfg;
      }
      if (ans === "q" || ans === "quit" || ans === "exit") {
        out(dirty ? s.cancelled : s.quitNoSave);
        return null;
      }
      if (ans === "1" || ans === "lang" || ans === "language") {
        const next = await pickLanguage(rl, cfg, out);
        if (next !== cfg.language) {
          cfg = { ...cfg, language: next };
          dirty = true;
        }
        continue;
      }
      if (ans === "2" || ans === "preset") {
        const p = await pickPreset(rl, cfg, out);
        if (p !== cfg.preset) {
          const lang = cfg.language;
          const next = applyPreset(p);
          // Keep user's language when switching preset
          cfg = { ...next, language: lang };
          dirty = true;
        }
        continue;
      }
      if (ans === "3" || ans === "rows" || ans === "lines") {
        const rows = await pickRows(rl, cfg, out);
        if (rows !== cfg.statusLines) {
          cfg = { ...cfg, statusLines: rows };
          dirty = true;
        }
        continue;
      }
      if (ans === "4" || ans === "token" || ans === "tokens") {
        cfg = {
          ...cfg,
          display: {
            ...cfg.display,
            showTokenBreakdown: !cfg.display.showTokenBreakdown,
          },
        };
        dirty = true;
        continue;
      }
      if (ans === "5" || ans === "theme") {
        ensureFollowMode(grokHome);
        out(`  ✓ ${t(cfg.language).themeFollowHint}`);
        continue;
      }
      if (ans === "6" || ans === "align") {
        cfg = { ...cfg, alignLabels: cfg.alignLabels === false };
        dirty = true;
        continue;
      }
      if (ans === "7" || ans === "remaining" || ans === "usage") {
        const next =
          cfg.display.usageValue === "remaining" ? "percent" : "remaining";
        cfg = {
          ...cfg,
          display: { ...cfg.display, usageValue: next },
        };
        dirty = true;
        continue;
      }
      if (ans === "8" || ans === "preview" || ans === "p") {
        out("");
        out(`  ── ${s.preview} ──`);
        for (const line of samplePreview(cfg).split("\n")) {
          out(`  ${line}`);
        }
        out(`  ────────────`);
        out("");
        continue;
      }
      if (ans === "9" || ans === "aesthetic" || ans === "style") {
        const next = await pickAesthetic(rl, cfg, out);
        if (next !== (cfg.aesthetic ?? "classic")) {
          cfg = applyAesthetic(next, cfg);
          dirty = true;
          out(`  → ${next}`);
          out(`  ── ${s.preview} ──`);
          for (const line of samplePreview(cfg).split("\n")) {
            out(`  ${line}`);
          }
        }
        continue;
      }
      // Phase C opt-in chips (a–d)
      if (ans === "a" || ans === "gitstats" || ans === "files") {
        cfg = {
          ...cfg,
          display: {
            ...cfg.display,
            showGitFileStats: !cfg.display.showGitFileStats,
          },
        };
        dirty = true;
        continue;
      }
      if (ans === "b" || ans === "compact" || ans === "compactions") {
        cfg = {
          ...cfg,
          display: {
            ...cfg.display,
            showCompactions: !cfg.display.showCompactions,
          },
        };
        dirty = true;
        continue;
      }
      if (ans === "c" || ans === "speed") {
        cfg = {
          ...cfg,
          display: {
            ...cfg.display,
            showSpeed: !cfg.display.showSpeed,
          },
        };
        dirty = true;
        continue;
      }
      if (ans === "d" || ans === "ahead" || ans === "behind") {
        cfg = {
          ...cfg,
          display: {
            ...cfg.display,
            showGitAheadBehind: cfg.display.showGitAheadBehind === false,
          },
        };
        dirty = true;
        continue;
      }
      out(`  ${t(cfg.language).invalid}`);
    }
  } finally {
    rl.close();
  }
}

/** One-shot: set language without menu. */
export function setLanguage(
  lang: string,
  grokHome = defaultGrokHome(),
): HudDisplayConfig {
  const cfg = loadHudConfig(grokHome);
  const next = { ...cfg, language: normalizeLang(lang) };
  saveHudConfig(next, grokHome);
  return next;
}
