import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  shouldUseHudForGrokInvoke,
  installGrokCommandWrap,
  uninstallGrokCommandWrap,
  isOurWrapper,
} from "../src/grok-wrap.js";

describe("grok wrap", () => {
  it("uses HUD for bare interactive grok", () => {
    assert.equal(
      shouldUseHudForGrokInvoke({
        args: [],
        env: {},
        isTtyIn: true,
        isTtyOut: true,
      }),
      true,
    );
  });

  it("skips HUD for -p / login / pipes / escape env", () => {
    assert.equal(
      shouldUseHudForGrokInvoke({
        args: ["-p", "hi"],
        env: {},
        isTtyIn: true,
        isTtyOut: true,
      }),
      false,
    );
    assert.equal(
      shouldUseHudForGrokInvoke({
        args: ["login"],
        env: {},
        isTtyIn: true,
        isTtyOut: true,
      }),
      false,
    );
    assert.equal(
      shouldUseHudForGrokInvoke({
        args: [],
        env: {},
        isTtyIn: false,
        isTtyOut: true,
      }),
      false,
    );
    assert.equal(
      shouldUseHudForGrokInvoke({
        args: [],
        env: { GROK_NO_HUD: "1" },
        isTtyIn: true,
        isTtyOut: true,
      }),
      false,
    );
    assert.equal(
      shouldUseHudForGrokInvoke({
        args: [],
        env: { GROK_HUD_ACTIVE: "1" },
        isTtyIn: true,
        isTtyOut: true,
      }),
      false,
    );
  });

  it("installs wrapper + grok-real and uninstall restores symlink", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "grok-wrap-"));
    const downloads = path.join(tmp, "downloads");
    const bin = path.join(tmp, "bin");
    fs.mkdirSync(downloads, { recursive: true });
    fs.mkdirSync(bin, { recursive: true });
    const fakeReal = path.join(downloads, "grok-fake-bin");
    // small executable script pretending to be grok
    fs.writeFileSync(fakeReal, "#!/bin/sh\necho real\n", { mode: 0o755 });
    fs.symlinkSync(fakeReal, path.join(bin, "grok"));

    const r = installGrokCommandWrap({ grokHome: tmp, nodeBin: process.execPath });
    assert.ok(fs.existsSync(r.realLink));
    assert.ok(isOurWrapper(r.wrapperPath));
    assert.equal(fs.realpathSync(r.realLink), fs.realpathSync(fakeReal));

    const u = uninstallGrokCommandWrap({ grokHome: tmp });
    assert.equal(u.restored, true);
    assert.ok(!isOurWrapper(path.join(bin, "grok")));
    assert.equal(fs.realpathSync(path.join(bin, "grok")), fs.realpathSync(fakeReal));

    fs.rmSync(tmp, { recursive: true, force: true });
  });
});
