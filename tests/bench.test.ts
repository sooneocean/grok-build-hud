import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { runSnapshotBench, formatBenchResult } from "../src/bench.js";

describe("bench", () => {
  it("runs cold/warm loadSnapshot timings on fixture session", () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), "hud-bench-"));
    const sess = path.join(home, "sessions", "demo", "sid-bench");
    fs.mkdirSync(sess, { recursive: true });
    fs.writeFileSync(
      path.join(sess, "signals.json"),
      JSON.stringify({
        contextWindowUsage: 0.3,
        contextTokensUsed: 1500,
        contextWindowTokens: 5000,
        turnCount: 1,
        toolCallCount: 1,
      }),
    );
    fs.writeFileSync(
      path.join(sess, "summary.json"),
      JSON.stringify({
        info: { id: "sid-bench", cwd: home },
        current_model_id: "grok-4.5",
      }),
    );
    const r = runSnapshotBench({
      grokHome: home,
      sessionDir: sess,
      iterations: 10,
    });
    assert.equal(r.sessionId, "sid-bench");
    assert.ok(r.coldMs >= 0);
    assert.ok(r.warmAvgMs >= 0);
    assert.ok(r.warmMinMs <= r.warmMaxMs);
    const text = formatBenchResult(r);
    assert.match(text, /warm avg/);
  });
});
