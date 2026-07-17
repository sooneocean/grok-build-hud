import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  normalizeBillingPayload,
  getCreditUsage,
  clearUsageCache,
} from "../src/billing.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

describe("billing", () => {
  it("normalizes present monthly used/limit fixture ({val})", () => {
    const body = JSON.parse(
      fs.readFileSync(path.join(root, "fixtures", "billing-present.json"), "utf8"),
    );
    const u = normalizeBillingPayload(body);
    assert.equal(u.available, true);
    assert.equal(u.used, 17510);
    assert.equal(u.limit, 150000);
    assert.ok(u.percent != null);
    assert.ok(Math.abs((u.percent ?? 0) - (17510 / 150000) * 100) < 0.05);
    assert.equal(u.period, "monthly");
  });

  it("normalizes weekly creditUsagePercent fixture", () => {
    const body = JSON.parse(
      fs.readFileSync(
        path.join(root, "fixtures", "billing-weekly-percent.json"),
        "utf8",
      ),
    );
    const u = normalizeBillingPayload(body);
    assert.equal(u.available, true);
    assert.equal(u.percent, 22);
    assert.equal(u.period, "weekly");
    assert.match(u.message ?? "", /GrokBuild/);
  });

  it("missing payload is unavailable without throw", () => {
    const u = normalizeBillingPayload(null);
    assert.equal(u.available, false);
    assert.match(u.message ?? "", /unavailable/i);
  });

  it("getCreditUsage degrades when auth missing", async () => {
    clearUsageCache();
    const u = await getCreditUsage("/tmp/does-not-exist-grok-home-xyz", {
      enabled: true,
      cacheTtlMs: 1,
    }, {
      readAuth: () => null,
    });
    assert.equal(u.available, false);
    assert.match(u.message ?? "", /unavailable|auth/i);
  });

  it("getCreditUsage uses injected fetch payload", async () => {
    clearUsageCache();
    const weekly = JSON.parse(
      fs.readFileSync(
        path.join(root, "fixtures", "billing-weekly-percent.json"),
        "utf8",
      ),
    );
    const monthly = JSON.parse(
      fs.readFileSync(path.join(root, "fixtures", "billing-present.json"), "utf8"),
    );
    let n = 0;
    const u = await getCreditUsage("/tmp/fake-home-billing-inject", { cacheTtlMs: 1 }, {
      readAuth: () => ({ token: "test-token" }),
      fetchJson: async (url) => {
        n += 1;
        const body = url.includes("format=credits") ? weekly : monthly;
        return { ok: true, status: 200, body };
      },
    });
    assert.equal(u.available, true);
    assert.equal(u.percent, 22);
    assert.equal(u.used, 17510);
    assert.equal(u.limit, 150000);
    assert.ok(n >= 1);
  });
});
