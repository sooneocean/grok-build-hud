import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  parseEventsLines,
  estimateContextFromSessionDir,
  durationFromSummary,
} from "../src/events.js";
import { projectLabel } from "../src/bar.js";

describe("events metrics", () => {
  it("counts turns and tools from events.jsonl shapes", () => {
    const lines = [
      JSON.stringify({ type: "turn_started", turn_number: 0 }),
      JSON.stringify({ type: "tool_started", tool_name: "read_file" }),
      JSON.stringify({
        type: "tool_completed",
        tool_name: "read_file",
        outcome: "success",
      }),
      JSON.stringify({ type: "tool_started", tool_name: "grep" }),
      JSON.stringify({
        type: "tool_completed",
        tool_name: "grep",
        outcome: "error",
      }),
      JSON.stringify({ type: "turn_started", turn_number: 1 }),
    ];
    const m = parseEventsLines(lines);
    assert.equal(m.turnCount, 2);
    assert.equal(m.toolCallCount, 2);
    assert.equal(m.toolFailureCount, 1);
    assert.ok(m.toolsUsed.includes("read_file"));
    assert.ok(m.toolsUsed.includes("grep"));
  });

  it("estimates context from session file sizes", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hud-events-"));
    try {
      // 100_000 bytes → ~25k tokens at factor 0.25
      fs.writeFileSync(path.join(dir, "chat_history.jsonl"), "x".repeat(100_000));
      fs.writeFileSync(path.join(dir, "prompt_context.json"), "{}");
      const est = estimateContextFromSessionDir(dir, 500_000);
      assert.ok(est.contextTokensUsed > 20_000);
      assert.ok(est.contextTokensUsed < 30_000);
      assert.equal(est.contextWindowTokens, 500_000);
      assert.ok(est.contextPercent > 0);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("durationFromSummary uses created_at", () => {
    const sec = durationFromSummary({
      created_at: "2026-07-29T00:00:00.000Z",
      last_active_at: "2026-07-29T00:10:00.000Z",
    });
    assert.equal(sec, 600);
  });
});

describe("projectLabel", () => {
  it("maps home root to ~", () => {
    const home = process.env.HOME || "/Users/dex";
    assert.equal(projectLabel(home, 2), "~");
  });

  it("maps paths under home with ~/", () => {
    const home = process.env.HOME || "/Users/dex";
    // pathLevels segments still under home → keep ~/
    assert.equal(
      projectLabel(`${home}/AI FILM SPACE/0728`, 2),
      "~/AI FILM SPACE/0728",
    );
    assert.equal(projectLabel(`${home}/demo`, 2), "~/demo");
    // deeper than pathLevels → just the tail (compact)
    assert.equal(projectLabel(`${home}/a/b/c/d`, 2), "c/d");
  });
});
