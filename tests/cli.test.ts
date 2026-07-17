import { describe, it } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs, runCli, helpText } from "../src/index.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const fixtureSession = path.join(root, "fixtures", "session");

describe("cli", () => {
  it("parseArgs handles watch and session-dir", () => {
    const o = parseArgs([
      "--watch",
      "--session-dir",
      "/tmp/x",
      "--no-usage",
      "--max-iterations",
      "2",
    ]);
    assert.equal(o.watch, true);
    assert.equal(o.sessionDir, "/tmp/x");
    assert.equal(o.noUsage, true);
    assert.equal(o.maxIterations, 2);
  });

  it("runCli one-shot against fixture exits 0 with context", async () => {
    const chunks: string[] = [];
    const code = await runCli(
      ["--once", "--session-dir", fixtureSession, "--no-usage", "--no-color"],
      {
        stdout: (s) => chunks.push(s),
        stderr: () => {},
      },
    );
    assert.equal(code, 0);
    const text = chunks.join("\n");
    assert.match(text, /Context/);
    assert.match(text, /37%/);
    assert.match(text, /190k|500k/);
  });

  it("runCli watch with max-iterations produces frames", async () => {
    const chunks: string[] = [];
    const code = await runCli(
      [
        "--watch",
        "--session-dir",
        fixtureSession,
        "--no-usage",
        "--no-color",
        "--max-iterations",
        "2",
        "--interval",
        "10",
      ],
      {
        stdout: (s) => chunks.push(s),
        stderr: () => {},
        sleep: async () => {},
      },
    );
    assert.equal(code, 0);
    const text = chunks.join("\n");
    assert.match(text, /37%/);
    // at least two frames
    const hits = text.match(/37%/g) ?? [];
    assert.ok(hits.length >= 2, `expected ≥2 frames, got ${hits.length}`);
  });

  it("help is non-empty", () => {
    assert.match(helpText(), /grok-build-hud/);
  });
});
