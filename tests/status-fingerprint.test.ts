import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadSnapshotFromDir } from "../src/session.js";
import { writeStatusFiles } from "../src/status.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const fixture = path.join(root, "fixtures", "session");

describe("status content fingerprint (D5)", () => {
  it("skips rewrite when content unchanged", () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), "hud-fp-"));
    const snap = loadSnapshotFromDir(fixture)!;
    const r1 = writeStatusFiles(snap, null, home, { writeGlobal: true });
    assert.ok(r1.dir);
    const statusPath = path.join(home, "hud", "status.txt");
    const fpPath = path.join(home, "hud", ".content-fp");
    assert.ok(fs.existsSync(statusPath));
    assert.ok(fs.existsSync(fpPath));
    const mtime1 = fs.statSync(statusPath).mtimeMs;
    const fp1 = fs.readFileSync(fpPath, "utf8");

    // same content → no rewrite (mtime may stay equal)
    writeStatusFiles(snap, null, home, { writeGlobal: true });
    const mtime2 = fs.statSync(statusPath).mtimeMs;
    const fp2 = fs.readFileSync(fpPath, "utf8");
    assert.equal(fp1, fp2);
    assert.equal(mtime1, mtime2);

    // change context → rewrite
    const changed = { ...snap, contextPercent: (snap.contextPercent + 7) % 100 };
    writeStatusFiles(changed, null, home, { writeGlobal: true });
    const fp3 = fs.readFileSync(fpPath, "utf8");
    assert.notEqual(fp1.trim(), fp3.trim());
  });
});
