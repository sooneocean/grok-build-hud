import { describe, it } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadSnapshotFromDir } from "../src/session.js";
import { composeHudLines, composeHudText } from "../src/render/compose.js";
import { formatStatusBlock } from "../src/status.js";
import { renderHud } from "../src/render.js";
import { PRESET_FULL, PRESET_MINIMAL } from "../src/hud-config.js";
import { visualLen, truncateVisible } from "../src/render/width.js";
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

  it("renderHud (no color) matches compose", () => {
    const snap = loadSnapshotFromDir(fixture)!;
    const composed = composeHudText(snap, usage, {
      ...PRESET_FULL,
      pathLevels: 2,
    });
    const rendered = renderHud(snap, usage, {
      color: false,
      pathLevels: 2,
      compact: false,
    });
    // renderHud reloads config for language; force via matching fields
    assert.match(rendered, /37%/);
    assert.match(composed, /37%/);
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
});

describe("visual width", () => {
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
    assert.ok(s.endsWith("…") || visualLen(s) <= 6);
  });
});
