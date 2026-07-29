import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  applyConfigSet,
  applyConfigSets,
  parseSetPairs,
  getConfigValue,
} from "../src/config-set.js";
import { PRESET_FULL, loadHudConfig } from "../src/hud-config.js";

describe("config-set", () => {
  it("parseSetPairs handles key=value and key value", () => {
    assert.deepEqual(parseSetPairs(["aesthetic=codex", "showSpeed", "on"]), [
      { key: "aesthetic", value: "codex" },
      { key: "showSpeed", value: "on" },
    ]);
  });

  it("applyConfigSet aesthetic and chips", () => {
    let cfg = { ...PRESET_FULL, display: { ...PRESET_FULL.display } };
    cfg = applyConfigSet(cfg, "aesthetic", "codex").cfg;
    assert.equal(cfg.aesthetic, "codex");
    cfg = applyConfigSet(cfg, "showSpeed", "true").cfg;
    assert.equal(cfg.display.showSpeed, true);
    cfg = applyConfigSet(cfg, "autoDenseBelow", "60").cfg;
    assert.equal(cfg.autoDenseBelow, 60);
    const bad = applyConfigSet(cfg, "aesthetic", "neon");
    assert.ok(bad.error);
  });

  it("applyConfigSets saves to disk", () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), "hud-set-"));
    fs.mkdirSync(path.join(home, "hud"), { recursive: true });
    // seed classic
    fs.writeFileSync(
      path.join(home, "hud", "config.json"),
      JSON.stringify({ aesthetic: "classic", language: "en" }) + "\n",
    );
    const r = applyConfigSets(home, [
      { key: "aesthetic", value: "codex" },
      { key: "showGitFileStats", value: "on" },
      { key: "barWidth", value: "10" },
    ]);
    assert.equal(r.ok, true);
    const loaded = loadHudConfig(home);
    assert.equal(loaded.aesthetic, "codex");
    assert.equal(loaded.display.showGitFileStats, true);
    assert.equal(loaded.barWidth, 10);
  });

  it("getConfigValue reads top and display keys", () => {
    const cfg = applyConfigSet(
      { ...PRESET_FULL, display: { ...PRESET_FULL.display } },
      "showSpeed",
      "on",
    ).cfg;
    assert.equal(getConfigValue(cfg, "aesthetic").text, "classic");
    assert.equal(getConfigValue(cfg, "showSpeed").text, "true");
    assert.equal(getConfigValue(cfg, "display.showSpeed").text, "true");
    const keys = getConfigValue(cfg, "--keys");
    assert.match(keys.text, /aesthetic/);
  });
});
