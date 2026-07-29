import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs, runCli, helpText } from "../src/index.js";
import { PRESET_FULL, saveHudConfig } from "../src/hud-config.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const fixtureSession = path.join(root, "fixtures", "session");

function tempGrokHome(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hud-cli-"));
  fs.mkdirSync(path.join(dir, "hud"), { recursive: true });
  // Isolate from developer ~/.grok aesthetic
  saveHudConfig({ ...PRESET_FULL, language: "en", display: { ...PRESET_FULL.display } }, dir);
  return dir;
}

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
    const home = tempGrokHome();
    const chunks: string[] = [];
    try {
      const code = await runCli(
        [
          "--once",
          "--session-dir",
          fixtureSession,
          "--no-usage",
          "--no-color",
          "--grok-home",
          home,
        ],
        {
          stdout: (s) => chunks.push(s),
          stderr: () => {},
        },
      );
      assert.equal(code, 0);
      const text = chunks.join("\n");
      assert.match(text, /ctx|Context|窗|37%/);
      assert.match(text, /37%/);
      assert.match(text, /190k|500k/);
    } finally {
      fs.rmSync(home, { recursive: true, force: true });
    }
  });

  it("runCli watch with max-iterations produces frames", async () => {
    const home = tempGrokHome();
    const chunks: string[] = [];
    try {
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
          "--grok-home",
          home,
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
      const hits = text.match(/37%/g) ?? [];
      assert.ok(hits.length >= 2, `expected ≥2 frames, got ${hits.length}`);
    } finally {
      fs.rmSync(home, { recursive: true, force: true });
    }
  });

  it("help is non-empty", () => {
    assert.match(helpText(), /grok-build-hud/);
  });
});
