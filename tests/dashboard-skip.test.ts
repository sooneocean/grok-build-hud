import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  sessionRenderKey,
  sessionSourceFingerprint,
  clearDashboardSessionCache,
} from "../src/dashboard.js";
import { emptySessionSnapshot } from "../src/session.js";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

describe("dashboard session skip (Phase C)", () => {
  it("sessionRenderKey changes when live or ctx changes", () => {
    const a = emptySessionSnapshot({
      sessionId: "s1",
      live: true,
      contextPercent: 10,
      toolCallCount: 1,
    });
    const b = { ...a, live: false };
    const c = { ...a, contextPercent: 11 };
    assert.notEqual(sessionRenderKey(a, "u"), sessionRenderKey(b, "u"));
    assert.notEqual(sessionRenderKey(a, "u"), sessionRenderKey(c, "u"));
    assert.equal(sessionRenderKey(a, "u"), sessionRenderKey(a, "u"));
  });

  it("sessionSourceFingerprint tracks mtimes", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hud-fp-src-"));
    fs.writeFileSync(path.join(dir, "signals.json"), "{}");
    const f1 = sessionSourceFingerprint(dir);
    fs.writeFileSync(path.join(dir, "signals.json"), '{"x":1}');
    const f2 = sessionSourceFingerprint(dir);
    assert.notEqual(f1, f2);
  });

  it("clearDashboardSessionCache is safe", () => {
    clearDashboardSessionCache();
    clearDashboardSessionCache();
    assert.ok(true);
  });
});
