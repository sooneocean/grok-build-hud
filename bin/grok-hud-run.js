#!/usr/bin/env node
/**
 * Start Grok in THIS terminal with multi-line HUD (tmux, same window).
 */
import { pathToFileURL } from "node:url";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const entry = path.join(__dirname, "..", "dist", "src", "index.js");
if (!existsSync(entry)) {
  console.error(
    "grok-hud-run: build missing. Run: npm install && npm run build",
  );
  process.exit(1);
}

const mod = await import(pathToFileURL(entry).href);
// ensure updater + full HUD then enter same-window mode
await mod.runCli(["--dashboard-start"]);
await mod.runCli(["--once", "--follow-active", "--no-color"]);
const code = await mod.runCli(["--run-in-terminal", ...process.argv.slice(2)]);
process.exit(typeof code === "number" ? code : 0);
