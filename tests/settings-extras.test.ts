import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { t, normalizeLang } from "../src/i18n.js";
import { formatHudInfo } from "../src/index.js";
import { saveHudConfig, PRESET_FULL, loadHudConfig } from "../src/hud-config.js";
import { previewHud } from "../src/render/compose.js";
import { emptySessionSnapshot } from "../src/session.js";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

describe("settings extras / info (Phase D)", () => {
  it("i18n has optional chip labels in en and zh", () => {
    const en = t("en");
    const zh = t("zh-Hans");
    assert.ok(en.gitFileStats.length > 0);
    assert.ok(en.showSpeed.includes("tok"));
    assert.ok(zh.showCompactions.length > 0);
    assert.ok(zh.extrasHint.length > 0);
    assert.equal(normalizeLang("zh"), "zh-Hans");
  });

  it("formatHudInfo lists optional chips", () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), "hud-info-"));
    saveHudConfig(
      {
        ...PRESET_FULL,
        language: "en",
        display: {
          ...PRESET_FULL.display,
          showGitFileStats: true,
          showSpeed: true,
          showCompactions: false,
        },
      },
      home,
    );
    const text = formatHudInfo(home);
    assert.match(text, /showGitFileStats:\s+on/);
    assert.match(text, /showSpeed:\s+on/);
    assert.match(text, /showCompactions:\s+off/);
    assert.match(text, /Optional chips/);
  });

  it("preview shows file stats when enabled", () => {
    const snap = emptySessionSnapshot({
      model: "grok-4.5",
      cwd: "/tmp/demo",
      branch: "main",
      gitDirty: true,
      gitFileStats: { modified: 2, added: 0, deleted: 0, untracked: 0 },
      live: true,
      contextPercent: 40,
      compactionCount: 1,
      outputTokensPerSecond: 20,
    });
    const cfg = loadHudConfig(); // not used; build explicit
    const on = {
      ...PRESET_FULL,
      language: "en" as const,
      display: {
        ...PRESET_FULL.display,
        showGitFileStats: true,
        showCompactions: true,
        showSpeed: true,
      },
    };
    const text = previewHud(snap, null, on);
    assert.match(text, /!2/);
    assert.match(text, /cmp×1|压1/);
    assert.match(text, /tok\/s/);
    void cfg;
  });
});
