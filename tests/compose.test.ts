import { describe, it } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadSnapshotFromDir } from "../src/session.js";
import { composeHudLines, composeHudText } from "../src/render/compose.js";
import { formatStatusBlock } from "../src/status.js";
import { renderHud } from "../src/render.js";
import {
  PRESET_FULL,
  PRESET_MINIMAL,
  type HudDisplayConfig,
} from "../src/hud-config.js";
import { visualLen, truncateVisible } from "../src/render/width.js";
import { alignedLabel, progressLabelWidth } from "../src/render/label-align.js";
import type { UsageSnapshot } from "../src/types.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const fixture = path.join(root, "fixtures", "session");

const usage: UsageSnapshot = {
  available: true,
  percent: 22,
  used: 17510,
  limit: 150000,
  period: "weekly",
  message: "GrokBuild 9%",
};

describe("compose pipeline", () => {
  it("compose and formatStatusBlock are identical", () => {
    const snap = loadSnapshotFromDir(fixture)!;
    const a = composeHudText(snap, usage, PRESET_FULL);
    const b = formatStatusBlock(snap, usage, PRESET_FULL);
    assert.equal(a, b);
  });

  it("renderHud (no color) shows context percent", () => {
    const snap = loadSnapshotFromDir(fixture)!;
    const rendered = renderHud(snap, usage, {
      color: false,
      pathLevels: 2,
      compact: false,
    });
    assert.match(rendered, /37%/);
    assert.match(rendered, /Grok 4\.5/);
  });

  it("full preset has identity + metrics lines", () => {
    const snap = loadSnapshotFromDir(fixture)!;
    const lines = composeHudLines(snap, usage, PRESET_FULL);
    assert.ok(lines.length >= 2);
    assert.match(lines[0]!, /Grok 4\.5/);
    assert.match(lines[1]!, /37%/);
    assert.match(lines[1]!, /22%/);
  });

  it("minimal compact collapses", () => {
    const snap = loadSnapshotFromDir(fixture)!;
    const lines = composeHudLines(snap, usage, {
      ...PRESET_MINIMAL,
      lineLayout: "compact",
    });
    assert.equal(lines.length, 1);
  });

  it("elementOrder can drop title and todos", () => {
    const snap = loadSnapshotFromDir(fixture)!;
    snap.title = "Should Not Appear";
    snap.todos = [{ content: "hidden todo", status: "pending" }];
    const cfg: HudDisplayConfig = {
      ...PRESET_FULL,
      elementOrder: ["project", "context", "usage"],
      projectLineOrder: ["model", "project", "live"],
      display: {
        ...PRESET_FULL.display,
        showTitle: true,
        showTodos: true,
        showTokenBreakdown: false,
        showSessionTime: false,
        showTurns: false,
        showTools: false,
        showToolActivity: false,
        showAgents: false,
        showDiffStats: false,
        showProductBreakdown: false,
      },
    };
    const text = composeHudText(snap, usage, cfg);
    assert.doesNotMatch(text, /Should Not Appear/);
    assert.doesNotMatch(text, /hidden todo/);
    assert.match(text, /37%/);
  });

  it("mergeGroups false puts context and usage on separate lines", () => {
    const snap = loadSnapshotFromDir(fixture)!;
    const cfg: HudDisplayConfig = {
      ...PRESET_FULL,
      elementOrder: ["project", "context", "usage"],
      mergeGroups: [],
      display: {
        ...PRESET_FULL.display,
        showTokenBreakdown: false,
        showSessionTime: false,
        showTurns: false,
        showTools: false,
        showToolActivity: false,
        showAgents: false,
        showTodos: false,
        showDiffStats: false,
        showProductBreakdown: false,
      },
    };
    const lines = composeHudLines(snap, usage, cfg);
    // project + context + usage = 3 lines
    assert.ok(lines.length >= 3);
    assert.match(lines[1]!, /37%|ctx|窗/);
    assert.match(lines[2]!, /22%|use|额/);
  });

  it("usageValue remaining shows leftover percent", () => {
    const snap = loadSnapshotFromDir(fixture)!;
    const cfg: HudDisplayConfig = {
      ...PRESET_FULL,
      display: {
        ...PRESET_FULL.display,
        usageValue: "remaining",
        showTokenBreakdown: false,
        showSessionTime: false,
        showTurns: false,
        showTools: false,
        showProductBreakdown: false,
      },
    };
    const text = composeHudText(snap, usage, cfg);
    // 100 - 22 = 78 remaining
    assert.match(text, /78%/);
  });

  it("contextValue remaining shows free window", () => {
    const snap = loadSnapshotFromDir(fixture)!;
    const cfg: HudDisplayConfig = {
      ...PRESET_FULL,
      display: {
        ...PRESET_FULL.display,
        contextValue: "remaining",
        showUsage: false,
        showTokenBreakdown: false,
        showSessionTime: false,
        showTurns: false,
        showTools: false,
        showProductBreakdown: false,
      },
    };
    const text = composeHudText(snap, usage, cfg);
    // 100 - 37 = 63
    assert.match(text, /63%/);
  });

  it("subagent agents render with type detail", () => {
    const snap = loadSnapshotFromDir(fixture)!;
    snap.agents = [
      {
        id: "s1",
        title: "Explore project status",
        status: "active",
        detail: "scout",
      },
    ];
    const text = composeHudText(snap, usage, PRESET_FULL);
    assert.match(text, /Explore project status/);
    assert.match(text, /scout/);
  });
});

describe("visual width + label align", () => {
  it("ASCII length equals string length", () => {
    assert.equal(visualLen("hello"), 5);
  });

  it("CJK counts as 2 cells", () => {
    assert.equal(visualLen("窗"), 2);
    assert.equal(visualLen("额度"), 4);
  });

  it("truncateVisible respects cells", () => {
    const s = truncateVisible("窗上下文很长很长很长", 6);
    assert.ok(visualLen(s) <= 6);
  });

  it("alignedLabel pads short labels to max width", () => {
    const L = { ctx: "窗", use: "额" };
    assert.equal(progressLabelWidth(L), 2);
    // both single CJK — already equal
    assert.equal(alignedLabel("窗", L, true), "窗");
    const L2 = { ctx: "ctx", use: "use" };
    assert.equal(progressLabelWidth(L2), 3);
    assert.equal(alignedLabel("ctx", L2, true), "ctx");
    assert.equal(alignedLabel("use", L2, true), "use");
  });
});
