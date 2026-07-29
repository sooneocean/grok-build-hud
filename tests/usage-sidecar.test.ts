import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  writeUsageSidecar,
  readUsageSidecar,
  defaultSidecarPath,
} from "../src/usage-sidecar.js";
import type { UsageSnapshot } from "../src/types.js";

function tmpHome(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "hud-sidecar-"));
}

describe("usage-sidecar", () => {
  it("write + read roundtrip", () => {
    const home = tmpHome();
    const usage: UsageSnapshot = {
      available: true,
      percent: 24,
      used: 100,
      limit: 400,
      period: "weekly",
      resetsIn: "3h",
      resetsAt: "2026-07-29T14:30:00.000Z",
      source: "billing",
      message: "GrokBuild 9%",
    };
    const p = writeUsageSidecar(home, usage);
    assert.ok(p);
    assert.equal(p, defaultSidecarPath(home));
    assert.ok(fs.existsSync(p!));

    const got = readUsageSidecar(home, {
      freshnessMs: 60_000,
      now: Date.now(),
    });
    assert.ok(got);
    assert.equal(got!.available, true);
    assert.equal(got!.percent, 24);
    assert.equal(got!.period, "weekly");
    assert.equal(got!.resetsIn, "3h");
    assert.equal(got!.resetsAt, "2026-07-29T14:30:00.000Z");
    assert.equal(got!.source, "sidecar");
  });

  it("stale sidecar is ignored", () => {
    const home = tmpHome();
    const usage: UsageSnapshot = {
      available: true,
      percent: 50,
      period: "weekly",
    };
    writeUsageSidecar(home, usage);
    const stale = readUsageSidecar(home, {
      freshnessMs: 1,
      now: Date.now() + 10_000,
    });
    assert.equal(stale, null);
  });

  it("unavailable usage skips write", () => {
    const home = tmpHome();
    const p = writeUsageSidecar(home, {
      available: false,
      message: "nope",
    });
    assert.equal(p, null);
    assert.equal(fs.existsSync(defaultSidecarPath(home)), false);
  });
});
