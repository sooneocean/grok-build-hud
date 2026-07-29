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
    assert.ok(agents.length >= 1, "expected subagent from fixture");
    assert.equal(agents[0]?.title, "Explore project status");
    assert.equal(agents[0]?.status, "active");
    // Streaming chunks must not be listed as agents
    assert.ok(
      !agents.some((a) => /message_chunk|thought_chunk/i.test(String(a.title))),
    );

    const line = formatToolLine(tools);
    assert.match(line, /read_file|✓|◐/);
  });

  it("ignores agent_message_chunk as agent activity", () => {
    const { agents } = parseUpdatesLines([
      JSON.stringify({
        timestamp: 1,
        params: {
          update: {
            sessionUpdate: "agent_message_chunk",
            content: { type: "text", text: "hello" },
          },
        },
      }),
      JSON.stringify({
        timestamp: 2,
        params: {
          update: {
            sessionUpdate: "agent_thought_chunk",
            content: { type: "text", text: "thinking" },
          },
        },
      }),
    ]);
    assert.deepEqual(agents, []);
  });

  it("tracks subagent_spawned and subagent_finished", () => {
    const { agents } = parseUpdatesLines([
      JSON.stringify({
        timestamp: 1,
        params: {
          update: {
            sessionUpdate: "subagent_spawned",
            subagent_id: "s1",
            subagent_type: "scout",
            description: "Find files",
          },
        },
      }),
      JSON.stringify({
        timestamp: 2,
        params: {
          update: {
            sessionUpdate: "subagent_finished",
            subagent_id: "s1",
            status: "completed",
          },
        },
      }),
    ]);
    assert.equal(agents.length, 1);
    assert.equal(agents[0]?.id, "s1");
    assert.equal(agents[0]?.status, "completed");
  });

  it("returns empty quietly for blank input", () => {
    const { tools, agents, todos } = parseUpdatesLines(["", "not-json", "{}"]);
    assert.deepEqual(tools, []);
    assert.deepEqual(agents, []);
    assert.deepEqual(todos, []);
  });
});
