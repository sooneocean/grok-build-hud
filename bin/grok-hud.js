#!/usr/bin/env node
/**
 * Short alias: grok-hud [status|run|stop|theme|…]
 */
import { pathToFileURL } from "node:url";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const entry = path.join(__dirname, "..", "dist", "src", "index.js");
if (!existsSync(entry)) {
  console.error("grok-hud: build missing. Run: npm install && npm run build");
  process.exit(1);
}

const mod = await import(pathToFileURL(entry).href);
const argv = process.argv.slice(2);
const head = argv[0];
let mapped = argv;

if (head === "stop") mapped = ["--dashboard-stop"];
else if (head === "run") mapped = ["--run-in-terminal", ...argv.slice(1)];
else if (head === "status" || head === undefined) {
  mapped = ["--once", "--follow-active", "--no-color", ...argv.slice(head ? 1 : 0)];
} else if (head === "theme") {
  mapped = ["--theme", argv[1] || "auto", ...argv.slice(2)];
} else if (head === "preset") {
  mapped = ["--preset", argv[1] || "full", ...argv.slice(2)];
} else if (head === "start") {
  mapped = ["--dashboard-start"];
} else if (head === "install") {
  mapped = ["--install-dashboard"];
} else if (head === "settings" || head === "config" || head === "设定" || head === "設置") {
  mapped = ["--settings", ...argv.slice(1)];
} else if (head === "info") {
  mapped = ["--info", ...argv.slice(1)];
} else if (head === "doctor") {
  mapped = ["--doctor", ...argv.slice(1)];
} else if (head === "set") {
  mapped = ["set", ...argv.slice(1)];
} else if (head === "lang" || head === "language" || head === "语言" || head === "語言") {
  mapped = ["--lang", argv[1] || "zh", ...argv.slice(2)];
}

const code = await mod.runCli(mapped);
process.exit(typeof code === "number" ? code : 0);
