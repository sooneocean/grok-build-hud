import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  parsePorcelainFileStats,
  formatGitFileStats,
} from "../src/git.js";
import { composeHudLines } from "../src/render/compose.js";
import { PRESET_FULL } from "../src/hud-config.js";
import { emptySessionSnapshot } from "../src/session.js";

describe("git file stats (Phase C)", () => {
  it("parses porcelain M/A/D/?", () => {
    const porcelain = [
      " M src/a.ts",
      "M  src/b.ts",
      "A  src/new.ts",
      " D src/gone.ts",
      "?? scratch.md",
      "?? tmp/x",
    ].join("\n");
    const s = parsePorcelainFileStats(porcelain);
    assert.equal(s.modified, 2);
    assert.equal(s.added, 1);
    assert.equal(s.deleted, 1);
    assert.equal(s.untracked, 2);
  });

  it("formats compact chip omitting zeros", () => {
    assert.equal(
      formatGitFileStats({
        modified: 2,
        added: 0,
        deleted: 1,
        untracked: 3,
      }),
      "!2 ✘1 ?3",
    );
  });

  it("compose shows file stats when opt-in", () => {
    const snap = emptySessionSnapshot({
      model: "grok-4.5",
      cwd: "/tmp/demo",
      branch: "main",
      gitDirty: true,
      gitFileStats: { modified: 2, added: 1, deleted: 0, untracked: 0 },
      live: true,
      contextPercent: 10,
    });
    const off = composeHudLines(snap, null, {
      ...PRESET_FULL,
      display: { ...PRESET_FULL.display, showGitFileStats: false },
    }).join(" ");
    assert.ok(!off.includes("!2"));

    const on = composeHudLines(snap, null, {
      ...PRESET_FULL,
      display: { ...PRESET_FULL.display, showGitFileStats: true },
    }).join(" ");
    assert.match(on, /!2/);
    assert.match(on, /\+1/);
  });

  it("compose shows compaction and speed when opt-in", () => {
    const snap = emptySessionSnapshot({
      model: "grok-4.5",
      cwd: "/tmp/demo",
      live: true,
      contextPercent: 20,
      compactionCount: 2,
      outputTokensPerSecond: 42.5,
    });
    const cfg = {
      ...PRESET_FULL,
      elementOrder: ["project", "context", "meta"] as Array<
        "project" | "context" | "meta"
      >,
      mergeGroups: [["context", "meta"] as Array<"context" | "meta">],
      display: {
        ...PRESET_FULL.display,
        showCompactions: true,
        showSpeed: true,
      },
    };
    const text = composeHudLines(snap, null, cfg).join(" ");
    assert.match(text, /cmp×2|压2/);
    assert.match(text, /tok\/s/);
  });
});
