import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  clearSnapshotCache,
  loadSnapshotFromDir,
  sessionInputFingerprint,
} from "../src/session.js";
import { clearGitInfoCache, readGitInfo } from "../src/git.js";
import { parseUpdatesBundle } from "../src/activity.js";
import { parseTokenUsageFile } from "../src/token-usage.js";

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
