#!/usr/bin/env node
/**
 * CLI entry — works from repo, npm link, or global install.
 */
import { pathToFileURL } from "node:url";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const candidates = [
  path.join(__dirname, "..", "dist", "src", "index.js"),
  path.join(__dirname, "..", "dist", "index.js"),
];

const entry = candidates.find((p) => existsSync(p));
if (!entry) {
  console.error(
    "grok-build-hud: build missing. Run: npm install && npm run build",
  );
  process.exit(1);
}

const mod = await import(pathToFileURL(entry).href);
const code = await mod.runCli(process.argv.slice(2));
process.exit(typeof code === "number" ? code : 0);
