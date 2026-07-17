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

  it("new window: old live session with fresher signals mtime does not steal primary", async () => {
    // Repro: old tab still live and signals.json keeps updating; new tab has
    // later opened_at but no/low context — must pick new (ctx ~0), not old 78%.
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "hud-newwin-"));
    const cwd = "/Users/dex/AI FILM SPACE/0717";
    const oldId = "old-busy-78";
    const newId = "new-window-zero";
    const enc = encodeURIComponent(cwd);
    const oldDir = path.join(tmp, "sessions", enc, oldId);
    const newDir = path.join(tmp, "sessions", enc, newId);
    fs.mkdirSync(oldDir, { recursive: true });
    fs.mkdirSync(newDir, { recursive: true });

    const oldSignals = {
      contextWindowUsage: 78,
      contextTokensUsed: 392180,
      contextWindowTokens: 500000,
      turnCount: 18,
      toolCallCount: 344,
      primaryModelId: "grok-4.5",
    };
    fs.writeFileSync(path.join(oldDir, "signals.json"), JSON.stringify(oldSignals));
    fs.writeFileSync(
      path.join(oldDir, "summary.json"),
      JSON.stringify({
        info: { id: oldId, cwd },
        last_active_at: "2026-07-17T06:00:00.000Z",
        updated_at: "2026-07-17T06:00:00.000Z",
        created_at: "2026-07-17T04:00:00.000Z",
        current_model_id: "grok-4.5",
      }),
    );
    // Touch signals again so mtime is "now" (old session keepalive)
    const now = Date.now();
    fs.utimesSync(path.join(oldDir, "signals.json"), new Date(now), new Date(now));

    fs.writeFileSync(
      path.join(newDir, "summary.json"),
      JSON.stringify({
        info: { id: newId, cwd },
        last_active_at: "2026-07-17T08:00:00.000Z",
        updated_at: "2026-07-17T08:00:00.000Z",
        created_at: "2026-07-17T08:00:00.000Z",
        current_model_id: "grok-4.5",
      }),
    );
    // Explicit empty/low context for new window
    fs.writeFileSync(
      path.join(newDir, "signals.json"),
      JSON.stringify({
        contextWindowUsage: 0,
        contextTokensUsed: 0,
        contextWindowTokens: 500000,
        turnCount: 0,
        toolCallCount: 0,
        primaryModelId: "grok-4.5",
      }),
    );

    fs.writeFileSync(
      path.join(tmp, "active_sessions.json"),
      JSON.stringify([
        {
          session_id: oldId,
          pid: process.pid,
          cwd,
          opened_at: "2026-07-17T04:00:00.000Z",
        },
        {
          session_id: newId,
          pid: process.pid,
          cwd,
          opened_at: "2026-07-17T08:00:00.000Z",
        },
      ]),
    );

    const r = await refreshDashboard({ grokHome: tmp, noUsage: true });
    assert.ok(r.session);
    assert.equal(r.session!.sessionId, newId);
    assert.ok(
      Math.round(r.session!.contextPercent) < 5,
      `new window must be ~0% ctx, got ${r.session!.contextPercent}`,
    );
    assert.doesNotMatch(r.title, /78%/);

    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("after /new: prefers newest active session, not first-listed old 78%", async () => {
    // Repro: active_sessions keeps old tab first; new tab second with low/no signals.
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "hud-new-"));
    const cwd = "/Users/dex/AI FILM SPACE/0717";
    const oldId = "old-session-78pct";
    const newId = "new-session-after-new";
    const enc = encodeURIComponent(cwd);
    const oldDir = path.join(tmp, "sessions", enc, oldId);
    const newDir = path.join(tmp, "sessions", enc, newId);
    fs.mkdirSync(oldDir, { recursive: true });
    fs.mkdirSync(newDir, { recursive: true });

    fs.writeFileSync(
      path.join(oldDir, "signals.json"),
      JSON.stringify({
        contextWindowUsage: 78,
        contextTokensUsed: 392180,
        contextWindowTokens: 500000,
        turnCount: 18,
        toolCallCount: 344,
        primaryModelId: "grok-4.5",
      }),
    );
    fs.writeFileSync(
      path.join(oldDir, "summary.json"),
      JSON.stringify({
        info: { id: oldId, cwd },
        last_active_at: "2026-07-17T06:00:00.000Z",
        updated_at: "2026-07-17T06:00:00.000Z",
        current_model_id: "grok-4.5",
      }),
    );
    // New session often has summary+updates before signals.json exists
    fs.writeFileSync(
      path.join(newDir, "summary.json"),
      JSON.stringify({
        info: { id: newId, cwd },
        last_active_at: "2026-07-17T07:43:00.000Z",
        updated_at: "2026-07-17T07:43:00.000Z",
        created_at: "2026-07-17T07:43:00.000Z",
        current_model_id: "grok-4.5",
      }),
    );
    fs.writeFileSync(path.join(newDir, "updates.jsonl"), "");
    // active list: OLD first (insertion order) — bug used to pick this always
    fs.writeFileSync(
      path.join(tmp, "active_sessions.json"),
      JSON.stringify([
        {
          session_id: oldId,
          pid: process.pid,
          cwd,
          opened_at: "2026-07-17T04:00:00.000Z",
        },
        {
          session_id: newId,
          pid: process.pid,
          cwd,
          opened_at: "2026-07-17T07:43:00.000Z",
        },
      ]),
    );

    const r = await refreshDashboard({ grokHome: tmp, noUsage: true });
    assert.ok(r.session);
    assert.equal(r.session!.sessionId, newId);
    assert.ok(
      Math.round(r.session!.contextPercent) < 10,
      `expected low ctx after /new, got ${r.session!.contextPercent}`,
    );
    assert.doesNotMatch(r.title, /78%/);

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
