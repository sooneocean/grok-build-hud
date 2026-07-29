import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  sessionRenderKey,
  sessionSourceFingerprint,
  clearDashboardSessionCache,
  dashboardPreKey,
  hudConfigStamp,
} from "../src/dashboard.js";
import { emptySessionSnapshot } from "../src/session.js";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

describe("dashboard session skip (Phase C + 1.4)", () => {
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

  it("dashboardPreKey changes with live or usage or config", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hud-pre-"));
    fs.writeFileSync(path.join(dir, "signals.json"), "{}");
    const a = dashboardPreKey("s1", dir, {
      live: true,
      usageKey: "u1",
      configStamp: "1",
    });
    const b = dashboardPreKey("s1", dir, {
      live: false,
      usageKey: "u1",
      configStamp: "1",
    });
    const c = dashboardPreKey("s1", dir, {
      live: true,
      usageKey: "u2",
      configStamp: "1",
    });
    const d = dashboardPreKey("s1", dir, {
      live: true,
      usageKey: "u1",
      configStamp: "2",
    });
    assert.notEqual(a, b);
    assert.notEqual(a, c);
    assert.notEqual(a, d);
    assert.equal(
      a,
      dashboardPreKey("s1", dir, {
        live: true,
        usageKey: "u1",
        configStamp: "1",
      }),
    );
  });

  it("hudConfigStamp is stable for missing config", () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), "hud-cfg-"));
    assert.equal(hudConfigStamp(home), "0");
  });

  it("clearDashboardSessionCache is safe", () => {
    clearDashboardSessionCache();
    clearDashboardSessionCache();
    assert.ok(true);
  });
});
