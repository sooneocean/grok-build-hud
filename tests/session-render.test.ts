import { describe, it } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadSnapshotFromDir } from "../src/session.js";
import { renderHud, renderTmux } from "../src/render.js";
import { composeHudText } from "../src/render/compose.js";
import { PRESET_FULL } from "../src/hud-config.js";
import { contextPercentFromSignals } from "../src/bar.js";
import type { UsageSnapshot } from "../src/types.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const fixtureSession = path.join(root, "fixtures", "session");

describe("session + render", () => {
  it("loads fixture session with known context values", () => {
    const snap = loadSnapshotFromDir(fixtureSession);
    assert.ok(snap);
    assert.equal(snap!.sessionId, "fixture-session-001");
    assert.equal(snap!.model, "grok-4.5");
    assert.equal(snap!.cwd, "/Users/dex/demo/CoachFlow");
    assert.equal(snap!.contextPercent, 37);
    assert.equal(snap!.contextTokensUsed, 190000);
    assert.equal(snap!.contextWindowTokens, 500000);
    // Must use same formula as production bar module
    assert.equal(
      snap!.contextPercent,
      contextPercentFromSignals(snap!.signals),
    );
    assert.ok(snap!.tools.length > 0);
  });

  it("renders HUD with context bar matching fixture percent", () => {
    const snap = loadSnapshotFromDir(fixtureSession)!;
    const usage: UsageSnapshot = {
      available: true,
      percent: 22,
      used: 17510,
      limit: 150000,
      period: "weekly",
      message: "GrokBuild 9%",
    };
    // Pin classic full config so machine ~/.grok/hud aesthetic doesn't affect tests
    const text = composeHudText(snap, usage, PRESET_FULL);
    assert.match(text, /ctx|Context|窗/);
    assert.match(text, /37%/);
    assert.match(text, /190k\/500k|190\.0k\/500k/);
    assert.match(text, /use|Usage|Quota|额|22%/);
    assert.match(text, /22%/);
    assert.match(text, /Grok|grok/i);
    assert.match(text, /CoachFlow/);
  });

  it("renders when usage unavailable without crash", () => {
    const snap = loadSnapshotFromDir(fixtureSession)!;
    const text = composeHudText(
      snap,
      { available: false, message: "usage unavailable" },
      PRESET_FULL,
    );
    assert.match(text, /37%/);
    assert.match(text, /unavailable/i);
  });

  it("tmux line includes context percent", () => {
    const snap = loadSnapshotFromDir(fixtureSession)!;
    const line = renderTmux(snap, null, {
      color: false,
      tmux: true,
      compact: false,
      pathLevels: 2,
      warningThreshold: 70,
      criticalThreshold: 90,
    });
    assert.match(line, /ctx 37%/);
  });
});
