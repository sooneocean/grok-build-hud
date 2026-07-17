import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  titleLine,
  refreshDashboard,
  runDashboardLoop,
  ttyForPid,
} from "../src/dashboard.js";
import { loadSnapshotFromDir } from "../src/session.js";

const pkgRoot = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);
const fixtureSession = path.join(pkgRoot, "fixtures", "session");

describe("dashboard", () => {
  it("titleLine includes ctx percent", () => {
    const snap = loadSnapshotFromDir(fixtureSession)!;
    const t = titleLine(snap, {
      available: true,
      percent: 22,
      period: "weekly",
      used: 17510,
      limit: 150000,
    });
    assert.match(t, /◆/);
    assert.match(t, /37%/);
    assert.match(t, /22%|quota/);
  });

  it("ttyForPid returns null for bogus pid", () => {
    assert.equal(ttyForPid(99999999), null);
  });

  it("refreshDashboard writes status files for fixture home", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "hud-dash-"));
    const sid = "fixture-session-001";
    const dir = path.join(tmp, "sessions", "proj", sid);
    fs.mkdirSync(dir, { recursive: true });
    for (const f of ["signals.json", "summary.json", "updates.jsonl"]) {
      fs.copyFileSync(path.join(fixtureSession, f), path.join(dir, f));
    }
    fs.writeFileSync(
      path.join(tmp, "active_sessions.json"),
      JSON.stringify([
        { session_id: sid, pid: process.pid, cwd: "/Users/dex/demo/CoachFlow" },
      ]),
    );

    const r = await refreshDashboard({ grokHome: tmp, noUsage: true });
    assert.ok(r.session);
    assert.match(r.title, /37%/);
    assert.ok(fs.existsSync(path.join(tmp, "hud", "status-line.txt")));
    assert.ok(fs.existsSync(path.join(tmp, "hud", "tmux-status.txt")));

    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("runDashboardLoop respects maxIterations", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "hud-loop-"));
    const sid = "fixture-session-001";
    const dir = path.join(tmp, "sessions", "proj", sid);
    fs.mkdirSync(dir, { recursive: true });
    for (const f of ["signals.json", "summary.json", "updates.jsonl"]) {
      fs.copyFileSync(path.join(fixtureSession, f), path.join(dir, f));
    }
    const code = await runDashboardLoop({
      grokHome: tmp,
      intervalMs: 1,
      maxIterations: 2,
      noUsage: true,
      writePid: true,
      sleep: async () => {},
    });
    assert.equal(code, 0);
    fs.rmSync(tmp, { recursive: true, force: true });
  });
});
