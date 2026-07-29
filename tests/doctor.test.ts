import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { runDoctor, formatDoctorReport } from "../src/doctor.js";
import { saveHudConfig, PRESET_FULL } from "../src/hud-config.js";
import {
  resolveAdaptiveConfig,
  defaultAutoDenseBelow,
} from "../src/adaptive-config.js";
import { applyAesthetic } from "../src/hud-config.js";
import { composeHudLines } from "../src/render/compose.js";
import { emptySessionSnapshot } from "../src/session.js";

describe("doctor", () => {
  it("returns structured checks without throw", () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), "hud-doc-"));
    fs.mkdirSync(path.join(home, "hud"), { recursive: true });
    saveHudConfig({ ...PRESET_FULL, aesthetic: "codex" }, home);
    const report = runDoctor({ grokHome: home });
    assert.ok(report.checks.length >= 6);
    assert.ok(report.summary.length > 0);
    const ids = report.checks.map((c) => c.id);
    assert.ok(ids.includes("node"));
    assert.ok(ids.includes("config"));
    const text = formatDoctorReport(report);
    assert.match(text, /Node/);
    assert.match(text, /doctor --fix/);
  });
});

describe("autoDenseBelow", () => {
  it("defaults: codex 60, classic 0", () => {
    assert.equal(defaultAutoDenseBelow("codex"), 60);
    assert.equal(defaultAutoDenseBelow("classic"), 0);
  });

  it("collapses to dense chip when cols below threshold", () => {
    const base = applyAesthetic("codex", {
      ...PRESET_FULL,
      language: "en",
      autoDenseBelow: 60,
    });
    const wide = resolveAdaptiveConfig(base, 100);
    assert.equal(wide.aesthetic, "codex");
    const narrow = resolveAdaptiveConfig(base, 50);
    assert.equal(narrow.aesthetic, "dense");

    const snap = emptySessionSnapshot({
      model: "grok-4.5",
      cwd: "/tmp/p",
      live: true,
      contextPercent: 30,
    });
    const lines = composeHudLines(snap, null, narrow);
    assert.equal(lines.length, 1);
  });

  it("disabled when autoDenseBelow is 0", () => {
    const base = {
      ...applyAesthetic("codex", { ...PRESET_FULL }),
      autoDenseBelow: 0,
    };
    const n = resolveAdaptiveConfig(base, 40);
    assert.equal(n.aesthetic, "codex");
  });
});
