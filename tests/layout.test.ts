import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  adaptiveBarWidth,
  adaptiveStatusLines,
  fitSegments,
  stripTmuxStyles,
  trimVisible,
  visibleLen,
  widthTier,
} from "../src/layout.js";
import { formatTmuxStatusLines } from "../src/status.js";
import { THEME_TOKYONIGHT } from "../src/theme.js";
import { PRESET_FULL } from "../src/hud-config.js";
import type { SessionSnapshot } from "../src/types.js";

const baseSession: SessionSnapshot = {
  sessionId: "s1",
  sessionDir: "/tmp/s1",
  cwd: "/Users/dex/AI FILM SPACE/0717",
  model: "grok-4.5",
  live: true,
  contextPercent: 38,
  contextTokensUsed: 192000,
  contextWindowTokens: 500000,
  turnCount: 4,
  userMessageCount: 4,
  toolCallCount: 20,
  toolFailureCount: 0,
  errorCount: 0,
  durationSeconds: 600,
  agentLinesAdded: 10,
  agentLinesRemoved: 2,
  compactionCount: 0,
  avgTtftMs: 0,
  lastTurnTokens: {
    inputTokens: 1622446,
    outputTokens: 16409,
    cachedReadTokens: 1592960,
    reasoningTokens: 15453,
    totalTokens: 1638855,
    modelCalls: 3,
    cacheHitPct: 98,
  },
  sessionTokens: null,
  tools: [{ id: "1", name: "read_file", status: "completed", count: 2 }],
  agents: [],
  todos: [],
  signals: {},
};

describe("layout", () => {
  it("width tiers and bar adapt", () => {
    assert.equal(widthTier(40), "xs");
    assert.equal(widthTier(70), "sm");
    assert.equal(widthTier(100), "md");
    assert.equal(widthTier(140), "lg");
    assert.equal(adaptiveBarWidth(50), 6);
    assert.equal(adaptiveStatusLines(50, 3), 1);
    assert.equal(adaptiveStatusLines(90, 3), 3);
  });

  it("visibleLen strips tmux styles", () => {
    const s = "#[bold,fg=#fff]hi#[default] there";
    assert.equal(visibleLen(s), "hi there".length);
    assert.equal(stripTmuxStyles(s), "hi there");
  });

  it("trimVisible respects max columns", () => {
    const s = "#[fg=#aaa]" + "x".repeat(50) + "#[default]";
    const t = trimVisible(s, 10);
    assert.ok(visibleLen(t) <= 10);
  });

  it("fitSegments drops low-priority first", () => {
    const out = fitSegments(
      [
        { text: "A", render: "A", priority: 0 },
        { text: "BBBBBBBBBB", render: "BBBBBBBBBB", priority: 9 },
        { text: "C", render: "C", priority: 1 },
      ],
      8,
      " ",
      " ",
    );
    assert.ok(!out.includes("BBBBBBBBBB") || visibleLen(out) <= 8);
    assert.ok(out.includes("A"));
  });

  it("narrow window produces shorter HUD than wide", () => {
    const narrow = formatTmuxStatusLines(
      baseSession,
      { available: true, percent: 24, period: "weekly" },
      THEME_TOKYONIGHT,
      PRESET_FULL,
      { maxWidth: 50 },
    );
    const wide = formatTmuxStatusLines(
      baseSession,
      { available: true, percent: 24, period: "weekly", resetsIn: "4d" },
      THEME_TOKYONIGHT,
      PRESET_FULL,
      { maxWidth: 140 },
    );
    assert.ok(narrow.length <= wide.length);
    for (const ln of narrow) {
      assert.ok(visibleLen(ln) <= 50, `line too long: ${visibleLen(ln)} ${stripTmuxStyles(ln)}`);
    }
    // hierarchy styles present on wide (default language 中文 labels)
    const joined = wide.join("\n");
    assert.match(joined, /italics|dim|bold/);
    assert.match(joined, /入 |出 |缓 |窗 /);
  });
});
