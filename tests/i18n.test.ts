import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { normalizeLang, t, langLabel } from "../src/i18n.js";
import { setLanguage } from "../src/settings-ui.js";
import { loadHudConfig, PRESET_FULL } from "../src/hud-config.js";
import { formatTmuxStatusLines } from "../src/status.js";
import { THEME_TOKYONIGHT } from "../src/theme.js";
import { stripTmuxStyles } from "../src/layout.js";
import type { SessionSnapshot } from "../src/types.js";

describe("i18n + settings language", () => {
  it("defaults and normalizes languages", () => {
    assert.equal(normalizeLang(undefined), "zh-Hans");
    assert.equal(normalizeLang("zh"), "zh-Hans");
    assert.equal(normalizeLang("en"), "en");
    assert.equal(normalizeLang("tw"), "zh-Hant");
    assert.equal(t("zh-Hans").ctx, "窗");
    assert.equal(t("en").ctx, "ctx");
    assert.match(langLabel("zh-Hans"), /中文/);
  });

  it("setLanguage writes config", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "hud-lang-"));
    fs.mkdirSync(path.join(tmp, "hud"), { recursive: true });
    fs.writeFileSync(
      path.join(tmp, "hud", "config.json"),
      JSON.stringify({ ...PRESET_FULL, language: "en" }, null, 2),
    );
    setLanguage("zh", tmp);
    const cfg = loadHudConfig(tmp);
    assert.equal(cfg.language, "zh-Hans");
    setLanguage("en", tmp);
    assert.equal(loadHudConfig(tmp).language, "en");
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("status labels follow language", () => {
    const session: SessionSnapshot = {
      sessionId: "s",
      sessionDir: "/t",
      cwd: "/Users/dex/demo",
      model: "grok-4.5",
      live: true,
      contextPercent: 20,
      contextTokensUsed: 1000,
      contextWindowTokens: 500000,
      turnCount: 1,
      userMessageCount: 1,
      toolCallCount: 0,
      toolFailureCount: 0,
      errorCount: 0,
      durationSeconds: 10,
      agentLinesAdded: 0,
      agentLinesRemoved: 0,
      compactionCount: 0,
      avgTtftMs: 0,
      lastTurnTokens: {
        inputTokens: 100,
        outputTokens: 20,
        cachedReadTokens: 50,
        reasoningTokens: 0,
        totalTokens: 120,
        modelCalls: 1,
        cacheHitPct: 50,
      },
      tools: [],
      agents: [],
      todos: [],
      signals: {},
    };
    const zh = formatTmuxStatusLines(
      session,
      null,
      THEME_TOKYONIGHT,
      { ...PRESET_FULL, language: "zh-Hans" },
      { maxWidth: 100 },
    )
      .map(stripTmuxStyles)
      .join("\n");
    const en = formatTmuxStatusLines(
      session,
      null,
      THEME_TOKYONIGHT,
      { ...PRESET_FULL, language: "en" },
      { maxWidth: 100 },
    )
      .map(stripTmuxStyles)
      .join("\n");
    assert.match(zh, /窗/);
    assert.match(zh, /入|出|缓/);
    assert.match(en, /ctx/);
    assert.match(en, /\bi |\bo |\bc /);
  });
});
