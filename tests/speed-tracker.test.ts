import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  measureOutputSpeed,
  formatSpeed,
} from "../src/speed-tracker.js";

describe("speed-tracker", () => {
  it("formatSpeed rounds by magnitude", () => {
    assert.equal(formatSpeed(142), "142 tok/s");
    assert.equal(formatSpeed(42.15), "42.1 tok/s");
    assert.equal(formatSpeed(3.141), "3.14 tok/s");
  });

  it("needs two samples and min delta", () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), "hud-spd-"));
    const sid = "sess-speed-1";
    const t0 = 1_000_000;
    const a = measureOutputSpeed(home, sid, 100, { now: t0 });
    assert.equal(a, null); // baseline only
    const b = measureOutputSpeed(home, sid, 200, { now: t0 + 200 });
    assert.equal(b, null); // < 500ms
    const c = measureOutputSpeed(home, sid, 300, { now: t0 + 1200 });
    // 100 tokens over 1000ms from last write (200→300) wait:
    // last cache was 200 at t0+200; now 300 at t0+1200 → 100 tok / 1000ms = 100
    assert.ok(c != null);
    assert.ok(Math.abs((c as number) - 100) < 0.5);
  });

  it("returns null when tokens did not grow", () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), "hud-spd-"));
    const sid = "sess-speed-2";
    measureOutputSpeed(home, sid, 50, { now: 10_000 });
    const z = measureOutputSpeed(home, sid, 50, { now: 11_000 });
    assert.equal(z, null);
  });
});
