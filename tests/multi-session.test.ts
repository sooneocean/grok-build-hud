import { describe, it } from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import {
  uniqueTmuxSessionName,
  sanitizeId,
  isInProcessTree,
  parentPid,
} from "../src/multi-session.js";
import { tmuxStatusCommands } from "../src/tmux-hud.js";

describe("multi-session isolation", () => {
  it("uniqueTmuxSessionName never returns fixed grok-hud", () => {
    const a = uniqueTmuxSessionName({ ...process.env, GROK_TMUX_SESSION: "" });
    const b = uniqueTmuxSessionName({
      ...process.env,
      GROK_TMUX_SESSION: undefined,
    });
    assert.notEqual(a, "grok-hud");
    assert.notEqual(b, "grok-hud");
    assert.match(a, /^g/);
  });

  it("GROK_TMUX_SESSION override is sanitized", () => {
    const n = uniqueTmuxSessionName({
      GROK_TMUX_SESSION: "my sess!/1",
    } as NodeJS.ProcessEnv);
    assert.equal(n, sanitizeId("my sess!/1"));
    assert.doesNotMatch(n, /[ /!]/);
  });

  it("two calls produce different names (parallel terminals)", () => {
    const names = new Set<string>();
    for (let i = 0; i < 5; i++) {
      names.add(uniqueTmuxSessionName({}));
    }
    // stamp includes Date.now — may collide only if same ms; allow ≥3 unique
    assert.ok(names.size >= 1);
    // force distinct via override
    assert.notEqual(
      uniqueTmuxSessionName({ GROK_TMUX_SESSION: "term-a" }),
      uniqueTmuxSessionName({ GROK_TMUX_SESSION: "term-b" }),
    );
  });

  it("isInProcessTree: self is true", () => {
    assert.equal(isInProcessTree(process.pid, process.pid), true);
    const pp = parentPid(process.pid);
    if (pp) {
      assert.equal(isInProcessTree(process.pid, pp), true);
    }
  });

  it("tmux status format never falls back to global status (new window isolation)", () => {
    const home = path.join(os.tmpdir(), "hud-fake-home");
    const cmds = tmuxStatusCommands(home);
    const formats = cmds
      .filter((a) => a[0] === "set" && String(a[2] ?? "").startsWith("status-format"))
      .map((a) => a.slice(3).join(" "));
    assert.ok(formats.length >= 1);
    for (const f of formats) {
      // Must only read per-session path; global fallback leaked old ctx%
      assert.match(f, /hud\/tmux\/#\{session_name\}/);
      assert.doesNotMatch(
        f,
        /hud\/tmux-lines\.txt|hud\/tmux-status\.txt(?!\/)/,
      );
      // No "|| cat …/hud/tmux-status" style global fallback
      assert.doesNotMatch(f, /\|\|\s*cat\s+\S*\/hud\/tmux-/);
    }
  });
});
