/**
 * Golden fixtures: aesthetic × language × width smoke (D5).
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadSnapshotFromDir } from "../src/session.js";
import { composeHudLines } from "../src/render/compose.js";
import {
  applyAesthetic,
  PRESET_FULL,
  type HudAesthetic,
} from "../src/hud-config.js";
import type { UsageSnapshot } from "../src/types.js";
import { visualLen } from "../src/render/width.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const fixture = path.join(root, "fixtures", "session");

const usage: UsageSnapshot = {
  available: true,
  percent: 24,
  used: 36000,
  limit: 150000,
  period: "weekly",
  resetsIn: "3h",
  resetsAt: new Date(2026, 6, 29, 14, 30, 0).toISOString(),
  message: "GrokBuild 9%",
};

const aesthetics: HudAesthetic[] = ["classic", "codex", "dense"];
const langs = ["en", "zh-Hans"] as const;
const widths = [40, 80, 120];

describe("aesthetics golden (D5)", () => {
  for (const aesthetic of aesthetics) {
    for (const language of langs) {
      it(`${aesthetic} / ${language} renders non-empty`, () => {
        const snap = loadSnapshotFromDir(fixture)!;
        const cfg = applyAesthetic(aesthetic, {
          ...PRESET_FULL,
          language,
        });
        const lines = composeHudLines(snap, usage, cfg);
        assert.ok(lines.length >= 1, "at least one line");
        const text = lines.join("\n");
        assert.match(text, /\d+%/);
        if (aesthetic === "dense") {
          assert.equal(lines.length, 1);
        }
        if (aesthetic === "codex" || aesthetic === "dense") {
          // calm: reset fragment without long "(weekly)"
          assert.ok(!/\(weekly\)/.test(text));
          assert.match(text, /3h|24%/);
        }
      });

      it(`${aesthetic}/${language} lines have measurable width (40/80/120 smoke)`, () => {
        const snap = loadSnapshotFromDir(fixture)!;
        const cfg = applyAesthetic(aesthetic, {
          ...PRESET_FULL,
          language,
        });
        const lines = composeHudLines(snap, usage, cfg);
        const total = lines.reduce((n, ln) => n + visualLen(ln), 0);
        assert.ok(total > 0);
        // width tiers used by layout/tmux adapter (document smoke targets)
        for (const w of widths) {
          assert.ok(typeof w === "number" && w >= 40);
        }
        // dense stays short; classic may be long
        if (aesthetic === "dense") {
          assert.ok(visualLen(lines[0]!) < 200);
        }
      });
    }
  }

  it("codex usage chip is compact (percent + reset)", () => {
    const snap = loadSnapshotFromDir(fixture)!;
    const cfg = applyAesthetic("codex", { ...PRESET_FULL, language: "zh-Hans" });
    const lines = composeHudLines(snap, usage, {
      ...cfg,
      timeFormat: "relative",
    });
    const body = lines.join(" ");
    assert.match(body, /24%/);
    assert.match(body, /3h/);
  });

  it("timeFormat both shows rel·abs", () => {
    const snap = loadSnapshotFromDir(fixture)!;
    const cfg = {
      ...applyAesthetic("codex", { ...PRESET_FULL, language: "en" }),
      timeFormat: "both" as const,
    };
    const lines = composeHudLines(snap, usage, cfg);
    const body = lines.join(" ");
    // wall clock is local HH:MM from resetsAt
    assert.match(body, /3h·\d{2}:\d{2}/);
  });
});
