import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { defaultGrokHome } from "./session.js";

export function packageRoot(): string {
  // dist/src/install.js -> package root is ../..
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
}

export function hookEntryPath(root = packageRoot()): string {
  return path.join(root, "dist", "src", "hook.js");
}

export function buildHookManifest(hookJs: string): object {
  // Use node + absolute path so it works when Grok spawns hooks without PATH tricks
  const node = process.execPath;
  const cmd = `${JSON.stringify(node)} ${JSON.stringify(hookJs)}`;
  const handler = {
    type: "command",
    command: cmd,
    timeout: 8,
  };
  return {
    description:
      "grok-build-hud — live context/tool stats in scrollback while you work",
    hooks: {
      SessionStart: [{ hooks: [handler] }],
      UserPromptSubmit: [{ hooks: [handler] }],
      PostToolUse: [{ hooks: [handler] }],
      Stop: [{ hooks: [handler] }],
      SessionEnd: [{ hooks: [handler] }],
    },
  };
}

export function installGlobalHooks(
  options: { grokHome?: string; root?: string } = {},
): { hooksPath: string; hookJs: string } {
  const grokHome = options.grokHome ?? defaultGrokHome();
  const root = options.root ?? packageRoot();
  const hookJs = hookEntryPath(root);
  if (!fs.existsSync(hookJs)) {
    throw new Error(
      `Hook entry not built: ${hookJs}. Run: npm run build (in ${root})`,
    );
  }
  const hooksDir = path.join(grokHome, "hooks");
  fs.mkdirSync(hooksDir, { recursive: true });
  const hooksPath = path.join(hooksDir, "grok-build-hud.json");
  const manifest = buildHookManifest(hookJs);
  fs.writeFileSync(hooksPath, JSON.stringify(manifest, null, 2) + "\n", "utf8");

  // Ensure hud data dir exists
  fs.mkdirSync(path.join(grokHome, "hud"), { recursive: true });
  fs.writeFileSync(
    path.join(grokHome, "hud", "README.txt"),
    [
      "grok-build-hud live status files",
      "  status-line.txt  — one-line compact",
      "  status.txt       — multi-line",
      "  status.json      — machine readable",
      "",
      "In-session: hooks print [hud] lines into Grok scrollback annotations",
      "after each turn (Stop) and periodically after tools.",
      "",
      `Installed hooks: ${hooksPath}`,
      `Hook binary: ${hookJs}`,
      "",
    ].join("\n"),
    "utf8",
  );

  return { hooksPath, hookJs };
}

export function uninstallGlobalHooks(
  grokHome = defaultGrokHome(),
): { removed: boolean; hooksPath: string } {
  const hooksPath = path.join(grokHome, "hooks", "grok-build-hud.json");
  if (fs.existsSync(hooksPath)) {
    fs.unlinkSync(hooksPath);
    return { removed: true, hooksPath };
  }
  return { removed: false, hooksPath };
}

void os;
