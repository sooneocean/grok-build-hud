import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { atomicWriteFile, writeStatusFiles } from "../src/status.js";
import { emptySessionSnapshot } from "../src/session.js";
import {
  touchDashboardHeartbeat,
  inspectDashboardHeartbeat,
  dashboardHeartbeatPath,
  clearStaleDashboardState,
  ensureDashboardDaemon,
  stopDashboard,
  isDashboardRunning,
} from "../src/dashboard.js";

describe("I/O integrity (1.10)", () => {
  it("atomicWriteFile replaces target without leaving .tmp", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hud-atom-"));
    const p = path.join(dir, "out.txt");
    atomicWriteFile(p, "hello\n");
    assert.equal(fs.readFileSync(p, "utf8"), "hello\n");
    atomicWriteFile(p, "world\n");
    assert.equal(fs.readFileSync(p, "utf8"), "world\n");
    const leftovers = fs.readdirSync(dir).filter((n) => n.includes(".tmp"));
    assert.equal(leftovers.length, 0);
  });

  it("writeStatusFiles produces readable status bundle", () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), "hud-io-st-"));
    const snap = emptySessionSnapshot({
      sessionId: "sid-io",
      live: true,
      contextPercent: 42,
      model: "grok-4.5",
      cwd: home,
    });
    writeStatusFiles(snap, null, home, { writeGlobal: true });
    const status = fs.readFileSync(path.join(home, "hud", "status.txt"), "utf8");
    assert.ok(status.length > 0);
    const json = JSON.parse(
      fs.readFileSync(path.join(home, "hud", "status.json"), "utf8"),
    ) as { sessionId: string };
    assert.equal(json.sessionId, "sid-io");
    assert.ok(fs.existsSync(path.join(home, "hud", ".content-fp")));
  });

  it("heartbeat fresh then stale", () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), "hud-hb-"));
    fs.mkdirSync(path.join(home, "hud"), { recursive: true });
    const t0 = 1_700_000_000_000;
    touchDashboardHeartbeat(home, { now: t0, pid: 42 });
    const fresh = inspectDashboardHeartbeat(home, {
      now: t0 + 5_000,
      maxAgeMs: 30_000,
    });
    assert.equal(fresh.fresh, true);
    assert.equal(fresh.pid, 42);
    const stale = inspectDashboardHeartbeat(home, {
      now: t0 + 60_000,
      maxAgeMs: 30_000,
    });
    assert.equal(stale.fresh, false);
    assert.match(stale.detail, /stale/);
    assert.ok(fs.existsSync(dashboardHeartbeatPath(home)));
  });

  it("clearStale before ensure does not throw on empty home", () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), "hud-ens-"));
    fs.mkdirSync(path.join(home, "hud"), { recursive: true });
    fs.writeFileSync(path.join(home, "hud", "dashboard.pid"), "99999999\n");
    const cleared = clearStaleDashboardState(home);
    assert.equal(cleared.clearedPid, true);
    // ensure with missing entry should not crash
    const r = ensureDashboardDaemon({
      grokHome: home,
      entryJs: path.join(home, "missing-entry.js"),
      intervalMs: 2000,
    });
    // may start a dying child or fail — just must not throw; clean up
    assert.equal(typeof r.started, "boolean");
    stopDashboard(home);
    assert.equal(isDashboardRunning(home), false);
  });
});
