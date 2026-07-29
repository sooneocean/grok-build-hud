import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  clearStaleDashboardState,
  rotateDashboardLogIfNeeded,
  dashboardPidPath,
  dashboardLockPath,
  dashboardLogPath,
  DASHBOARD_LOG_MAX_BYTES,
} from "../src/dashboard.js";
import {
  repairInvalidHudConfig,
  probeHudConfig,
  clearHudConfigCache,
  configPath,
  PRESET_FULL,
  saveHudConfig,
} from "../src/hud-config.js";
import { runDoctorFix } from "../src/doctor.js";

describe("doctor fix helpers (1.9)", () => {
  it("clearStaleDashboardState removes dead pid + lock", () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), "hud-fix-stale-"));
    fs.mkdirSync(path.join(home, "hud"), { recursive: true });
    fs.writeFileSync(dashboardPidPath(home), "99999999\n");
    fs.writeFileSync(dashboardLockPath(home), "99999999\n123\n");
    const r = clearStaleDashboardState(home);
    assert.equal(r.clearedPid, true);
    assert.equal(r.clearedLock, true);
    assert.equal(fs.existsSync(dashboardPidPath(home)), false);
    assert.equal(fs.existsSync(dashboardLockPath(home)), false);
  });

  it("rotateDashboardLogIfNeeded archives oversized log", () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), "hud-fix-rot-"));
    fs.mkdirSync(path.join(home, "hud"), { recursive: true });
    const log = dashboardLogPath(home);
    fs.writeFileSync(log, "x".repeat(2000));
    const small = rotateDashboardLogIfNeeded(home, { maxBytes: 5000 });
    assert.equal(small.rotated, false);
    const big = rotateDashboardLogIfNeeded(home, { maxBytes: 500 });
    assert.equal(big.rotated, true);
    assert.ok(big.archived);
    assert.equal(fs.existsSync(log), false);
    assert.equal(fs.existsSync(big.archived!), true);
  });

  it("repairInvalidHudConfig quarantines bad JSON", () => {
    clearHudConfigCache();
    const home = fs.mkdtempSync(path.join(os.tmpdir(), "hud-fix-cfg-"));
    fs.mkdirSync(path.join(home, "hud"), { recursive: true });
    const p = configPath(home);
    fs.writeFileSync(p, "{broken", "utf8");
    const r = repairInvalidHudConfig(home);
    assert.equal(r.repaired, true);
    assert.ok(r.backupPath && fs.existsSync(r.backupPath));
    assert.equal(probeHudConfig(home).status, "ok");
    assert.ok(fs.existsSync(p));
  });

  it("repairInvalidHudConfig is no-op when valid", () => {
    clearHudConfigCache();
    const home = fs.mkdtempSync(path.join(os.tmpdir(), "hud-fix-ok-"));
    fs.mkdirSync(path.join(home, "hud"), { recursive: true });
    saveHudConfig({ ...PRESET_FULL, aesthetic: "codex" }, home);
    const r = repairInvalidHudConfig(home);
    assert.equal(r.repaired, false);
    assert.equal(probeHudConfig(home).status, "ok");
  });

  it("runDoctorFix reports stale-state and log-rotate actions", async () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), "hud-fix-run-"));
    fs.mkdirSync(path.join(home, "hud"), { recursive: true });
    fs.writeFileSync(dashboardPidPath(home), "88888888\n");
    fs.writeFileSync(dashboardLockPath(home), "88888888\n");
    fs.writeFileSync(
      dashboardLogPath(home),
      "y".repeat(DASHBOARD_LOG_MAX_BYTES + 10),
    );
    const report = await runDoctorFix({ grokHome: home });
    const ids = report.actions.map((a) => a.id);
    assert.ok(ids.includes("stale-state"));
    assert.ok(ids.includes("log-rotate"));
    assert.ok(ids.includes("config"));
    const stale = report.actions.find((a) => a.id === "stale-state");
    assert.ok(stale?.ok);
    assert.match(stale?.detail ?? "", /stale|removed/i);
    const rot = report.actions.find((a) => a.id === "log-rotate");
    assert.ok(rot?.ok);
    assert.match(rot?.detail ?? "", /rotated/);
    // log moved to .1; current log may be recreated empty by later steps
    assert.ok(fs.existsSync(`${dashboardLogPath(home)}.1`));
    // stop any daemon fix started against this temp home
    try {
      const { stopDashboard } = await import("../src/dashboard.js");
      stopDashboard(home);
    } catch {
      /* ignore */
    }
  });
});

