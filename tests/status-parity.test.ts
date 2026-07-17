import { describe, it } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadSnapshotFromDir } from "../src/session.js";
import {
  formatStatusBlock,
  formatTmuxStatusLines,
  writeStatusFiles,
} from "../src/status.js";
import { PRESET_FULL } from "../src/hud-config.js";
import { THEME_TOKYONIGHT } from "../src/theme.js";
import fs from "node:fs";
import os from "node:os";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const fixture = path.join(root, "fixtures", "session");

describe("Grok HUD multi-line status", () => {
  it("formatStatusBlock has model line + context + usage lines", () => {
    const snap = loadSnapshotFromDir(fixture)!;
    const text = formatStatusBlock(
      snap,
      {
        available: true,
        percent: 23,
        period: "weekly",
        used: 18000,
        limit: 150000,
        resetsIn: "4d",
        message: "GrokBuild 10%",
      },
      PRESET_FULL,
    );
    assert.match(text, /\[Grok 4\.5\]/);
    assert.match(text, /Context/);
    assert.match(text, /37%/);
    assert.match(text, /Usage/);
    assert.match(text, /23%/);
    // multi-line
    assert.ok(text.split("\n").length >= 2);
  });

  it("formatTmuxStatusLines returns 3 rows in full preset", () => {
    const snap = loadSnapshotFromDir(fixture)!;
    // inject todos/agents for line 3
    snap.todos = [
      { content: "Ship HUD strip", status: "in_progress" },
      { content: "Write tests", status: "completed" },
    ];
    const lines = formatTmuxStatusLines(
      snap,
      { available: true, percent: 22, period: "weekly" },
      THEME_TOKYONIGHT,
      PRESET_FULL,
    );
    assert.equal(lines.length, 3);
    assert.match(lines[0]!, /Grok 4\.5|CoachFlow/);
    assert.match(lines[1]!, /Context|Usage|22%|37%/);
  });

  it("writeStatusFiles emits tmux-lines.txt", () => {
    const snap = loadSnapshotFromDir(fixture)!;
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "hud-full-"));
    // point grok home at tmp with config
    fs.mkdirSync(path.join(tmp, "hud"), { recursive: true });
    fs.writeFileSync(
      path.join(tmp, "hud", "config.json"),
      JSON.stringify(PRESET_FULL, null, 2),
    );
    // session needs to be written via writeStatusFiles with grokHome=tmp
    // but session is loaded from fixture; OK
    const r = writeStatusFiles(
      snap,
      { available: true, percent: 20, period: "weekly" },
      tmp,
    );
    assert.ok(fs.existsSync(path.join(tmp, "hud", "tmux-lines.txt")));
    assert.ok(r.tmuxLines.length >= 2);
    assert.match(r.full, /Context/);
    fs.rmSync(tmp, { recursive: true, force: true });
  });
});
