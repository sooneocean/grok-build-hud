import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  clearSnapshotCache,
  clearSessionDirIndex,
  findSessionDirById,
  loadActiveSessions,
  loadSnapshotFromDir,
  sessionInputFingerprint,
} from "../src/session.js";
import { clearGitInfoCache, readGitInfo } from "../src/git.js";
import { parseUpdatesBundle } from "../src/activity.js";
import { parseTokenUsageFile } from "../src/token-usage.js";
import {
  clearEventsFileCache,
  parseEventsFile,
} from "../src/events.js";
import {
  clearHudConfigCache,
  loadHudConfig,
  saveHudConfig,
  PRESET_FULL,
} from "../src/hud-config.js";
import { clearAllHotPathCaches } from "../src/dashboard.js";

describe("perf caches (1.3)", () => {
  it("sessionInputFingerprint changes when updates grow", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hud-fp-"));
    fs.writeFileSync(path.join(dir, "signals.json"), "{}");
    const a = sessionInputFingerprint(dir);
    fs.writeFileSync(path.join(dir, "updates.jsonl"), "{}\n");
    const b = sessionInputFingerprint(dir);
    assert.notEqual(a, b);
  });

  it("loadSnapshotFromDir cache hit skips re-parse of signals", () => {
    clearSnapshotCache();
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hud-snap-"));
    fs.writeFileSync(
      path.join(dir, "signals.json"),
      JSON.stringify({
        contextWindowUsage: 0.2,
        contextTokensUsed: 1000,
        contextWindowTokens: 5000,
        turnCount: 2,
        toolCallCount: 3,
      }),
    );
    fs.writeFileSync(
      path.join(dir, "summary.json"),
      JSON.stringify({
        info: { id: "sess-perf-1", cwd: dir },
        current_model_id: "grok-4.5",
      }),
    );
    const s1 = loadSnapshotFromDir(dir, { trackSpeed: false })!;
    assert.equal(s1.sessionId, "sess-perf-1");
    assert.ok(s1.contextPercent > 0);
    // mutate signals on disk without waiting — fingerprint changes only if we write
    const s2 = loadSnapshotFromDir(dir, { trackSpeed: false })!;
    assert.equal(s2.sessionId, s1.sessionId);
    assert.equal(s2.contextPercent, s1.contextPercent);
    // bypass sees same data
    const s3 = loadSnapshotFromDir(dir, {
      trackSpeed: false,
      bypassCache: true,
    })!;
    assert.equal(s3.contextPercent, s1.contextPercent);
  });

  it("git cache returns same object stamp within TTL", () => {
    clearGitInfoCache();
    // Use repo root if it's a git checkout
    const cwd = process.cwd();
    if (!fs.existsSync(path.join(cwd, ".git"))) {
      return;
    }
    const a = readGitInfo(cwd);
    const b = readGitInfo(cwd);
    assert.equal(a.branch, b.branch);
    assert.equal(a.dirty, b.dirty);
  });

  it("parseUpdatesBundle matches separate token parse for last turn", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hud-upd-"));
    const p = path.join(dir, "updates.jsonl");
    const line = JSON.stringify({
      params: {
        update: {
          sessionUpdate: "turn_completed",
          usage: {
            inputTokens: 100,
            outputTokens: 20,
            cachedReadTokens: 50,
          },
        },
      },
    });
    fs.writeFileSync(p, line + "\n");
    const bundle = parseUpdatesBundle(p);
    const tok = parseTokenUsageFile(p);
    assert.equal(bundle.turnCount, tok.turnCount);
    assert.equal(bundle.lastTurn?.outputTokens, tok.lastTurn?.outputTokens);
  });
});

describe("perf caches (1.6 deep)", () => {
  it("parseUpdatesBundle multi-turn session sum matches token file", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hud-upd2-"));
    const p = path.join(dir, "updates.jsonl");
    const turns = [
      { inputTokens: 10, outputTokens: 2, cachedReadTokens: 1 },
      { inputTokens: 30, outputTokens: 5, cachedReadTokens: 10 },
    ];
    const lines = turns.map((usage) =>
      JSON.stringify({
        params: {
          update: { sessionUpdate: "turn_completed", usage },
        },
      }),
    );
    fs.writeFileSync(p, lines.join("\n") + "\n");
    const bundle = parseUpdatesBundle(p);
    const tok = parseTokenUsageFile(p);
    assert.equal(bundle.turnCount, 2);
    assert.equal(bundle.turnCount, tok.turnCount);
    assert.equal(bundle.session.inputTokens, tok.session.inputTokens);
    assert.equal(bundle.session.outputTokens, 7);
    assert.equal(bundle.lastTurn?.outputTokens, 5);
  });

  it("loadHudConfig mtime cache returns same object until file changes", () => {
    clearHudConfigCache();
    const home = fs.mkdtempSync(path.join(os.tmpdir(), "hud-cfg-"));
    fs.mkdirSync(path.join(home, "hud"), { recursive: true });
    saveHudConfig(
      {
        ...PRESET_FULL,
        language: "zh-Hans",
        aesthetic: "codex",
      },
      home,
    );
    const a = loadHudConfig(home);
    const b = loadHudConfig(home);
    assert.equal(a, b);
    assert.equal(a.language, "zh-Hans");
    // rewrite bumps mtime
    const next = { ...a, language: "en" as const };
    saveHudConfig(next, home);
    const c = loadHudConfig(home);
    assert.equal(c.language, "en");
    assert.notEqual(c, a);
    clearHudConfigCache();
  });

  it("parseEventsFile caches by mtime+size", () => {
    clearEventsFileCache();
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hud-ev-"));
    const p = path.join(dir, "events.jsonl");
    fs.writeFileSync(
      p,
      JSON.stringify({
        type: "turn_completed",
        data: { duration_ms: 1200 },
      }) + "\n",
    );
    const a = parseEventsFile(p);
    const b = parseEventsFile(p);
    assert.equal(a, b);
    clearEventsFileCache();
    const c = parseEventsFile(p);
    assert.notEqual(c, a);
    assert.deepEqual(c, a);
  });

  it("findSessionDirById indexes nested session dirs", () => {
    clearSessionDirIndex();
    const home = fs.mkdtempSync(path.join(os.tmpdir(), "hud-idx-"));
    const sess = path.join(home, "sessions", "ws", "sid-idx-1");
    fs.mkdirSync(sess, { recursive: true });
    fs.writeFileSync(path.join(sess, "signals.json"), "{}");
    const a = findSessionDirById(home, "sid-idx-1");
    assert.equal(a, sess);
    const b = findSessionDirById(home, "sid-idx-1");
    assert.equal(b, sess);
    assert.equal(findSessionDirById(home, "missing-id"), null);
    clearSessionDirIndex();
  });

  it("loadActiveSessions caches until mtime changes", () => {
    clearSessionDirIndex();
    const home = fs.mkdtempSync(path.join(os.tmpdir(), "hud-as-"));
    const p = path.join(home, "active_sessions.json");
    fs.writeFileSync(
      p,
      JSON.stringify([{ session_id: "s1", pid: 1 }]),
    );
    const a = loadActiveSessions(home);
    const b = loadActiveSessions(home);
    assert.equal(a, b);
    assert.equal(a.length, 1);
    assert.equal(a[0]?.session_id, "s1");
    fs.writeFileSync(
      p,
      JSON.stringify([
        { session_id: "s1", pid: 1 },
        { session_id: "s2", pid: 2 },
      ]),
    );
    const c = loadActiveSessions(home);
    assert.equal(c.length, 2);
    clearSessionDirIndex();
  });

  it("clearAllHotPathCaches is safe to call twice", () => {
    clearAllHotPathCaches();
    clearAllHotPathCaches();
  });
});
