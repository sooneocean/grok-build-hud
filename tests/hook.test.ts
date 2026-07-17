import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  parseHookPayload,
  resolveSessionForHook,
  runHookTick,
  shouldEmitAnnotation,
} from "../src/hook.js";
import { findSessionDirById } from "../src/session.js";
import { formatCompactLine, writeStatusFiles } from "../src/status.js";
import { loadSnapshotFromDir } from "../src/session.js";
import { installGlobalHooks, buildHookManifest } from "../src/install.js";

const pkgRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const fixtureSession = path.join(pkgRoot, "fixtures", "session");

describe("hook / live status", () => {
  it("parses hook payload sessionId", () => {
    const p = parseHookPayload(
      JSON.stringify({ sessionId: "abc", cwd: "/tmp/x", hookEventName: "stop" }),
    );
    assert.equal(p.sessionId, "abc");
    assert.equal(p.cwd, "/tmp/x");
  });

  it("formatCompactLine includes context percent from fixture", () => {
    const snap = loadSnapshotFromDir(fixtureSession)!;
    assert.ok(snap);
    const line = formatCompactLine(snap, null);
    assert.match(line, /\[hud\]/);
    assert.match(line, /37%/);
    assert.match(line, /Grok 4\.5|ctx|tools/);
  });

  it("writeStatusFiles creates status-line.txt", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "hud-"));
    const snap = loadSnapshotFromDir(fixtureSession)!;
    const r = writeStatusFiles(snap, null, tmp);
    assert.ok(fs.existsSync(r.compactPath));
    const text = fs.readFileSync(r.compactPath, "utf8");
    assert.match(text, /37%/);
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("runHookTick against fixture via session-dir home layout", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "hud-home-"));
    // Build mini grok home with fixture session
    const sid = "fixture-session-001";
    const dir = path.join(
      tmp,
      "sessions",
      encodeURIComponent("/Users/dex/demo/CoachFlow"),
      sid,
    );
    fs.mkdirSync(dir, { recursive: true });
    for (const f of ["signals.json", "summary.json", "updates.jsonl"]) {
      fs.copyFileSync(path.join(fixtureSession, f), path.join(dir, f));
    }
    fs.writeFileSync(
      path.join(tmp, "active_sessions.json"),
      JSON.stringify([
        {
          session_id: sid,
          pid: process.pid,
          cwd: "/Users/dex/demo/CoachFlow",
        },
      ]),
    );

    const found = findSessionDirById(tmp, sid);
    assert.ok(found);

    const result = await runHookTick({
      payloadRaw: JSON.stringify({ sessionId: sid, hookEventName: "stop" }),
      env: {
        GROK_SESSION_ID: sid,
        GROK_HOOK_EVENT: "stop",
      },
      grokHome: tmp,
      forceAnnotate: true,
      noUsage: true,
    });
    assert.equal(result.code, 0);
    assert.ok(result.compact);
    assert.match(result.compact!, /37%/);
    assert.ok(fs.existsSync(path.join(tmp, "hud", "status-line.txt")));

    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("shouldEmitAnnotation always true for Stop", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "hud-th-"));
    assert.equal(shouldEmitAnnotation("stop", tmp), true);
    assert.equal(shouldEmitAnnotation("Stop", tmp), true);
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("buildHookManifest points at node + hook.js", () => {
    const m = buildHookManifest("/abs/hook.js") as {
      hooks: { Stop: { hooks: { command: string }[] }[] };
    };
    assert.match(m.hooks.Stop[0]!.hooks[0]!.command, /hook\.js/);
  });

  it("installGlobalHooks writes ~/.grok style hooks file", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "hud-inst-"));
    // ensure dist hook exists (built)
    const hookJs = path.join(pkgRoot, "dist", "src", "hook.js");
    assert.ok(fs.existsSync(hookJs), "dist must be built before this test");
    const { hooksPath } = installGlobalHooks({ grokHome: tmp, root: pkgRoot });
    assert.ok(fs.existsSync(hooksPath));
    const body = fs.readFileSync(hooksPath, "utf8");
    assert.match(body, /Stop/);
    assert.match(body, /hook\.js/);
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("resolveSessionForHook uses env session id", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "hud-res-"));
    const sid = "fixture-session-001";
    const dir = path.join(tmp, "sessions", "proj", sid);
    fs.mkdirSync(dir, { recursive: true });
    for (const f of ["signals.json", "summary.json", "updates.jsonl"]) {
      fs.copyFileSync(path.join(fixtureSession, f), path.join(dir, f));
    }
    const snap = resolveSessionForHook(
      {},
      { GROK_SESSION_ID: sid },
      tmp,
    );
    assert.ok(snap);
    assert.equal(snap!.sessionId, sid);
    assert.equal(snap!.contextPercent, 37);
    fs.rmSync(tmp, { recursive: true, force: true });
  });
});
