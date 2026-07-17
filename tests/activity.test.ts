import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseUpdatesLines, formatToolLine } from "../src/activity.js";

// dist/tests -> package root is ../..
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const fixtureUpdates = path.join(root, "fixtures", "session", "updates.jsonl");

describe("activity", () => {
  it("parses fixture updates into tool summary including read_file", () => {
    const lines = fs.readFileSync(fixtureUpdates, "utf8").split(/\r?\n/);
    const { tools, agents } = parseUpdatesLines(lines);
    assert.ok(tools.length > 0, "expected tools from fixture");
    const names = tools.map((t) => t.name);
    assert.ok(
      names.includes("read_file") || names.some((n) => n.includes("read")),
      `expected read_file in ${names.join(",")}`,
    );
    // call-4 is running (no completed status)
    const running = tools.filter((t) => t.status === "running");
    assert.ok(running.length >= 1, "expected at least one running tool");
    assert.ok(agents.length >= 1, "expected agent thought from fixture");

    const line = formatToolLine(tools);
    assert.match(line, /read_file|✓|◐/);
  });

  it("returns empty quietly for blank input", () => {
    const { tools, agents, todos } = parseUpdatesLines(["", "not-json", "{}"]);
    assert.deepEqual(tools, []);
    assert.deepEqual(agents, []);
    assert.deepEqual(todos, []);
  });
});
