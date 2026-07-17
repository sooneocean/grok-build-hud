/**
 * Interactive settings UI for language / preset / rows.
 * Default language: English; switchable to 简体中文 / 繁體.
 */
import * as readline from "node:readline";
import {
  applyPreset,
  loadHudConfig,
  saveHudConfig,
  type HudDisplayConfig,
  type HudPreset,
} from "./hud-config.js";
import {
  langLabel,
  normalizeLang,
  t,
  type HudLang,
} from "./i18n.js";
import { defaultGrokHome } from "./session.js";
import { ensureFollowMode } from "./theme.js";

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
  out(`│`);
  out(`│  0) ${s.saveExit}`);
  out(`│  q) ${s.quitNoSave}`);
  out(`└──────────────────────────────────────`);
  out("");
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
