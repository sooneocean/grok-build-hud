import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  clampPercent,
  contextPercentFromSignals,
  formatTokenCount,
  renderBar,
  formatDuration,
  projectLabel,
} from "../src/bar.js";

describe("bar", () => {
  it("derives context percent from contextWindowUsage", () => {
    assert.equal(
      contextPercentFromSignals({
        contextWindowUsage: 37,
        contextTokensUsed: 190000,
        contextWindowTokens: 500000,
      }),
      37,
    );
  });

  it("falls back to used/window ratio", () => {
    assert.equal(
      contextPercentFromSignals({
        contextTokensUsed: 250000,
        contextWindowTokens: 500000,
      }),
      50,
    );
  });

  it("clamps and formats", () => {
    assert.equal(clampPercent(150), 100);
    assert.equal(renderBar(37, 10).length, 10);
    assert.match(formatTokenCount(190000), /190k|190\.0k/);
    assert.equal(formatDuration(4620), "1h 17m");
    // Under $HOME → ~/… (clearer than bare "Users/dex")
    const home = process.env.HOME || "/Users/dex";
    assert.equal(projectLabel(`${home}/demo/CoachFlow`, 2), "~/demo/CoachFlow");
    assert.equal(projectLabel("/opt/other/app", 2), "other/app");
  });
});
