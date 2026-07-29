import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  clearSnapshotCache,
  loadSnapshotFromDir,
  rebindSnapshotRuntime,
  sessionInputFingerprint,
  emptySessionSnapshot,
  clearSessionDirIndex,
  findSessionDirById,
} from "../src/session.js";
import {
  appendDashboardError,
  clearDashboardErrorLogState,
  sessionRenderKey,
} from "../src/dashboard.js";
import { clearGitInfoCache } from "../src/git.js";
import { clearEventsFileCache, parseEventsFile } from "../src/events.js";

describe("stability (1.7)", () => {
  it("sessionInputFingerprint tracks chat_history growth (estimate inputs)", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hud-stab-fp-"));
    fs.writeFileSync(path.join(dir, "signals.json"), "{}");
    const a = sessionInputFingerprint(dir);
    fs.writeFileSync(
      path.join(dir, "chat_history.jsonl"),
      JSON.stringify({ role: "user", content: "hi" }) + "\n",
    );
    const b = sessionInputFingerprint(dir);
    assert.notEqual(a, b);
    fs.appendFileSync(
      path.join(dir, "chat_history.jsonl"),
      JSON.stringify({ role: "assistant", content: "yo" }) + "\n",
    );
    const c = sessionInputFingerprint(dir);
    assert.notEqual(b, c);
  });

  it("loadSnapshot estimate moves when chat_history grows without signals ctx", () => {
    clearSnapshotCache();
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hud-stab-est-"));
    fs.writeFileSync(
      path.join(dir, "summary.json"),
      JSON.stringify({
        info: { id: "sid-est", cwd: dir },
        current_model_id: "grok-4.5",
      }),
    );
    // no signals → estimate path
    fs.writeFileSync(
      path.join(dir, "chat_history.jsonl"),
      "x".repeat(4_000) + "\n",
    );
    const s1 = loadSnapshotFromDir(dir, {
      trackSpeed: false,
      active: [{ session_id: "sid-est", pid: process.pid }],
    })!;
    assert.ok(s1.contextTokensUsed > 0);
    const used1 = s1.contextTokensUsed;
    fs.appendFileSync(path.join(dir, "chat_history.jsonl"), "y".repeat(8_000) + "\n");
    const s2 = loadSnapshotFromDir(dir, {
      trackSpeed: false,
      active: [{ session_id: "sid-est", pid: process.pid }],
    })!;
    assert.ok(
      s2.contextTokensUsed > used1,
      `expected estimate to grow ${used1} → ${s2.contextTokensUsed}`,
    );
  });

  it("rebindSnapshotRuntime refreshes git without changing sessionId", () => {
    clearGitInfoCache();
    const snap = emptySessionSnapshot({
      sessionId: "sid-rb",
      cwd: process.cwd(),
      live: true,
      pid: process.pid,
      gitDirty: false,
    });
    const out = rebindSnapshotRuntime(snap, {
      active: [{ session_id: "sid-rb", pid: process.pid, cwd: process.cwd() }],
    });
    assert.equal(out.sessionId, "sid-rb");
    assert.equal(out.live, true);
    assert.equal(out.pid, process.pid);
    // git fields are bound (branch may be undefined outside git repo)
    assert.equal(typeof out.gitDirty, "boolean");
  });

  it("sessionRenderKey changes when gitDirty flips (paint after rebind)", () => {
    const a = emptySessionSnapshot({
      sessionId: "s",
      live: true,
      gitDirty: false,
    });
    const b = { ...a, gitDirty: true };
    assert.notEqual(sessionRenderKey(a, "u"), sessionRenderKey(b, "u"));
  });

  it("appendDashboardError rate-limits and writes log", () => {
    clearDashboardErrorLogState();
    const home = fs.mkdtempSync(path.join(os.tmpdir(), "hud-stab-log-"));
    fs.mkdirSync(path.join(home, "hud"), { recursive: true });
    const t0 = 1_000_000;
    appendDashboardError(home, new Error("boom-1"), {
      now: t0,
      minIntervalMs: 5_000,
    });
    appendDashboardError(home, new Error("boom-2"), {
      now: t0 + 100,
      minIntervalMs: 5_000,
    });
    const log = fs.readFileSync(path.join(home, "hud", "dashboard.log"), "utf8");
    assert.match(log, /boom-1/);
    assert.equal(log.includes("boom-2"), false);
    appendDashboardError(home, new Error("boom-3"), {
      now: t0 + 6_000,
      minIntervalMs: 5_000,
    });
    const log2 = fs.readFileSync(path.join(home, "hud", "dashboard.log"), "utf8");
    assert.match(log2, /boom-3/);
  });

  it("parseEventsFile drops cache entry when file deleted", () => {
    clearEventsFileCache();
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hud-stab-ev-"));
    const p = path.join(dir, "events.jsonl");
    fs.writeFileSync(
      p,
      JSON.stringify({ type: "turn_started" }) + "\n",
    );
    const a = parseEventsFile(p);
    assert.equal(a.turnCount, 1);
    fs.unlinkSync(p);
    const b = parseEventsFile(p);
    assert.equal(b.turnCount, 0);
  });

  it("findSessionDirById sees nested session under existing workspace parent", () => {
    clearSessionDirIndex();
    const home = fs.mkdtempSync(path.join(os.tmpdir(), "hud-stab-idx-"));
    const ws = path.join(home, "sessions", "ws-enc");
    const s1 = path.join(ws, "sid-old");
    fs.mkdirSync(s1, { recursive: true });
    fs.writeFileSync(path.join(s1, "signals.json"), "{}");
    assert.equal(findSessionDirById(home, "sid-old"), s1);
    // new session under same parent — stamp should move via parent mtime
    const s2 = path.join(ws, "sid-new");
    fs.mkdirSync(s2, { recursive: true });
    fs.writeFileSync(path.join(s2, "signals.json"), "{}");
    // touch parent to mimic real FS after mkdir
    try {
      const now = new Date();
      fs.utimesSync(ws, now, now);
    } catch {
      /* best effort */
    }
    assert.equal(findSessionDirById(home, "sid-new"), s2);
    clearSessionDirIndex();
  });
});
