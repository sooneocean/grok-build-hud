import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  visibleLen,
  trimVisible,
  fitSegments,
  stabilizeWidth,
  clearWidthStableCache,
  stripTmuxStyles,
} from "../src/layout.js";
import {
  composeDenseChip,
  composeHudLines,
  displayModelShort,
} from "../src/render/compose.js";
import { applyAesthetic, PRESET_FULL } from "../src/hud-config.js";
import { emptySessionSnapshot } from "../src/session.js";

describe("layout CJK + hysteresis", () => {
  it("visibleLen counts CJK as 2 after stripping styles", () => {
    assert.equal(visibleLen("窗"), 2);
    assert.equal(visibleLen("#[fg=#fff]窗#[default]"), 2);
    assert.equal(visibleLen("ab"), 2);
  });

  it("trimVisible respects CJK budget", () => {
    const s = trimVisible("窗窗窗窗", 5); // 4 CJK = 8 cells, budget 4 + …
    assert.ok(visibleLen(stripTmuxStyles(s)) <= 5);
    assert.match(s, /…/);
  });

  it("stabilizeWidth ignores ±1 jitter", () => {
    clearWidthStableCache();
    assert.equal(stabilizeWidth("t1", 100), 100);
    assert.equal(stabilizeWidth("t1", 101), 100); // jitter
    assert.equal(stabilizeWidth("t1", 103), 103); // real resize
  });

  it("fitSegments drops low-priority first", () => {
    const out = fitSegments(
      [
        { text: "A", render: "A", priority: 0 },
        { text: "BBBBBBBBBB", render: "BBBBBBBBBB", priority: 5 },
        { text: "C", render: "C", priority: 1 },
      ],
      8,
      " ",
      " ",
    );
    assert.match(out, /A/);
    assert.doesNotMatch(stripTmuxStyles(out), /BBBBBBBBBB/);
  });
});

describe("dense chip", () => {
  it("displayModelShort shortens grok models", () => {
    assert.equal(displayModelShort("grok-4.5"), "G4.5");
    assert.equal(displayModelShort("Grok 4.5"), "G4.5");
  });

  it("composeDenseChip is one scannable line", () => {
    const snap = emptySessionSnapshot({
      model: "grok-4.5",
      cwd: "/Users/dex/AI FILM SPACE/0729",
      live: true,
      contextPercent: 42,
      tools: [{ id: "1", name: "read_file", status: "running", detail: "x" }],
    });
    const cfg = applyAesthetic("dense", PRESET_FULL);
    const line = composeDenseChip(
      snap,
      { available: true, percent: 24, period: "weekly" },
      cfg,
    );
    assert.match(line, /\[G4\.5\]/);
    assert.match(line, /42%/);
    assert.match(line, /24%/);
    assert.match(line, /read_file|◐/);
    assert.doesNotMatch(line, /\n/);
  });

  it("composeHudLines dense returns single chip", () => {
    const snap = emptySessionSnapshot({
      model: "grok-4.5",
      cwd: "/tmp/p",
      contextPercent: 10,
      live: true,
    });
    const lines = composeHudLines(
      snap,
      { available: true, percent: 5 },
      applyAesthetic("dense", PRESET_FULL),
    );
    assert.equal(lines.length, 1);
  });
});
