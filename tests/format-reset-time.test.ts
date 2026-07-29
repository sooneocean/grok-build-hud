import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  formatWallClock,
  formatResetFragment,
} from "../src/format-reset-time.js";
import type { UsageSnapshot } from "../src/types.js";

describe("format-reset-time", () => {
  it("formatWallClock returns HH:MM", () => {
    // Fixed local: use Date with known components
    const d = new Date(2026, 6, 29, 14, 30, 0);
    assert.equal(formatWallClock(d), "14:30");
  });

  it("relative mode prefers resetsIn", () => {
    const u: UsageSnapshot = {
      available: true,
      resetsIn: "3h",
      resetsAt: "2026-07-29T14:30:00.000Z",
    };
    assert.equal(formatResetFragment(u, "relative"), "3h");
  });

  it("absolute mode prefers wall clock", () => {
    const d = new Date(2026, 6, 29, 9, 5, 0);
    const u: UsageSnapshot = {
      available: true,
      resetsIn: "3h",
      resetsAt: d.toISOString(),
    };
    const abs = formatResetFragment(u, "absolute");
    assert.equal(abs, "09:05");
  });

  it("both mode joins with middot", () => {
    const d = new Date(2026, 6, 29, 14, 30, 0);
    const u: UsageSnapshot = {
      available: true,
      resetsIn: "3h",
      resetsAt: d.toISOString(),
    };
    assert.equal(formatResetFragment(u, "both"), "3h·14:30");
  });

  it("falls back when one side missing", () => {
    assert.equal(
      formatResetFragment({ available: true, resetsIn: "2h" }, "both"),
      "2h",
    );
    const d = new Date(2026, 6, 29, 8, 0, 0);
    assert.equal(
      formatResetFragment(
        { available: true, resetsAt: d.toISOString() },
        "relative",
      ),
      "08:00",
    );
  });
});
