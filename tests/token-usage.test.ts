import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  parseTokenUsageFromLines,
  formatExactCount,
  formatTokenBreakdownLine,
  parseUsageObject,
} from "../src/token-usage.js";

describe("token-usage", () => {
  it("parses turn_completed usage with cache", () => {
    const lines = [
      JSON.stringify({
        method: "session/update",
        params: {
          update: {
            sessionUpdate: "turn_completed",
            usage: {
              inputTokens: 1000,
              outputTokens: 50,
              cachedReadTokens: 800,
              reasoningTokens: 20,
              totalTokens: 1050,
              modelCalls: 2,
            },
          },
        },
      }),
      JSON.stringify({
        method: "_x.ai/session/update",
        params: {
          update: {
            sessionUpdate: "turn_completed",
            usage: {
              inputTokens: 974820,
              outputTokens: 15706,
              cachedReadTokens: 944000,
              reasoningTokens: 9717,
              totalTokens: 990526,
              modelCalls: 9,
            },
          },
        },
      }),
    ];
    const r = parseTokenUsageFromLines(lines);
    assert.equal(r.turnCount, 2);
    assert.ok(r.lastTurn);
    assert.equal(r.lastTurn!.inputTokens, 974820);
    assert.equal(r.lastTurn!.outputTokens, 15706);
    assert.equal(r.lastTurn!.cachedReadTokens, 944000);
    assert.equal(r.lastTurn!.reasoningTokens, 9717);
    assert.ok(r.lastTurn!.cacheHitPct > 90);
    assert.equal(r.session.inputTokens, 1000 + 974820);
    assert.equal(r.session.outputTokens, 50 + 15706);
  });

  it("formats exact digits and breakdown line", () => {
    assert.equal(formatExactCount(974820), "974,820");
    const line = formatTokenBreakdownLine(
      parseUsageObject({
        inputTokens: 974820,
        outputTokens: 15706,
        cachedReadTokens: 944000,
        reasoningTokens: 9717,
      }),
      { mode: "exact" },
    );
    assert.match(line, /TOK IN 974,820/);
    assert.match(line, /OUT 15,706/);
    assert.match(line, /CACHE 944,000 \(97%\)/);
    assert.match(line, /REASON 9,717/);
  });
});
