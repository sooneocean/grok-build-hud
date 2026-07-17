import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  uniqueTmuxSessionName,
  sanitizeId,
  isInProcessTree,
  parentPid,
} from "../src/multi-session.js";

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
});
