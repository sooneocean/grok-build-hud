import { describe, it } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { formatTmuxStatusLine } from "../src/status.js";
import { loadSnapshotFromDir } from "../src/session.js";
import {
  miniBar,
  THEME_TOKYONIGHT,
  THEME_GROKDAY,
  paletteForGrokTheme,
  readGrokUiConfig,
  resolveTheme,
  normalizeGrokThemeName,
} from "../src/theme.js";

const pkgRoot = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);
const fixtureSession = path.join(pkgRoot, "fixtures", "session");

describe("theme", () => {
  it("maps Grok theme names to palettes", () => {
    assert.equal(normalizeGrokThemeName("TokyoNight"), "tokyonight");
    assert.equal(paletteForGrokTheme("tokyonight").name, "tokyonight");
    assert.equal(paletteForGrokTheme("grokday").name, "grokday");
    assert.equal(paletteForGrokTheme("light").name, "grokday");
    assert.equal(paletteForGrokTheme("dark").name, "groknight");
  });

  it("tokyonight palette uses Tokyo Night ink", () => {
    assert.equal(THEME_TOKYONIGHT.value, "#c0caf5");
    assert.equal(THEME_TOKYONIGHT.ok, "#9ece6a");
    assert.equal(THEME_TOKYONIGHT.mark, "#7aa2f7");
  });

  it("readGrokUiConfig parses [ui] theme", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "hud-cfg-"));
    fs.writeFileSync(
      path.join(tmp, "config.toml"),
      `[ui]\ntheme = "tokyonight"\nauto_dark_theme = "tokyonight"\nauto_light_theme = "grokday"\n`,
    );
    const cfg = readGrokUiConfig(tmp);
    assert.equal(cfg.theme, "tokyonight");
    assert.equal(cfg.autoLightTheme, "grokday");
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("resolveTheme follows Grok config (no lock)", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "hud-cfg2-"));
    fs.writeFileSync(
      path.join(tmp, "config.toml"),
      `[ui]\ntheme = "tokyonight"\n`,
    );
    // env wants grokday but without LOCK → still follow Grok config
    const t = resolveTheme(undefined, { GROK_HUD_THEME: "grokday" }, {
      grokHome: tmp,
    });
    assert.equal(t.name, "tokyonight");
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("resolveTheme follows explicit Grok theme switches", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "hud-cfg3-"));
    fs.writeFileSync(
      path.join(tmp, "config.toml"),
      `[ui]\ntheme = "rosepinemoon"\n`,
    );
    const t = resolveTheme(undefined, {}, { grokHome: tmp });
    assert.equal(t.name, "rosepinemoon");
    fs.writeFileSync(
      path.join(tmp, "config.toml"),
      `[ui]\ntheme = "grokday"\n`,
    );
    const t2 = resolveTheme(undefined, {}, { grokHome: tmp });
    assert.equal(t2.name, "grokday");
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("miniBar works with tokyonight", () => {
    const bar = miniBar(50, 8, THEME_TOKYONIGHT);
    assert.match(bar, /#9ece6a|#e0af68|#f7768e/);
  });

  it("formatTmuxStatusLine uses provided palette colours", () => {
    const snap = loadSnapshotFromDir(fixtureSession)!;
    const line = formatTmuxStatusLine(
      snap,
      { available: true, percent: 22, message: "GrokBuild 9%" },
      THEME_TOKYONIGHT,
    );
    assert.match(line, /#c0caf5|#565f89|#7aa2f7|#9ece6a/);
    assert.match(line, /37%/);
  });

  it("grokday is light-paper friendly high contrast", () => {
    assert.equal(THEME_GROKDAY.name, "grokday");
    // solid paper bg (not transparent default)
    assert.match(THEME_GROKDAY.statusBg, /^#/);
    // near-black ink
    assert.match(THEME_GROKDAY.value, /^#0/);
    // labels darker than mid-grey washout
    const label = THEME_GROKDAY.label.replace("#", "");
    const r = parseInt(label.slice(0, 2), 16);
    assert.ok(r < 0xa0, "label must be dark enough on white");
  });

  it("tmuxRole on grokday avoids dim (readable on paper)", async () => {
    const { tmuxRole, isLightTheme } = await import("../src/theme.js");
    assert.equal(isLightTheme(THEME_GROKDAY), true);
    const label = tmuxRole(THEME_GROKDAY, "label", "ctx ");
    const sep = tmuxRole(THEME_GROKDAY, "sep", " · ");
    assert.doesNotMatch(label, /dim/);
    assert.doesNotMatch(sep, /dim/);
    assert.match(label, /italics|bold/);
    assert.match(label, /#57534e|#0c0a09|#5b21b6|fg=/);
  });
});
