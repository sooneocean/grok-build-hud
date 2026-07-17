/**
 * Same-window always-visible HUD via tmux status bar.
 * One Terminal.app window: bottom line shows ctx + quota, Grok fills the rest.
 * Visual theme: soft Clear Dark palette (see theme.ts).
 */
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { defaultGrokHome } from "./session.js";
import { packageRoot } from "./install.js";
import { resolveTheme, tmuxStatusChrome } from "./theme.js";
import { loadHudConfig } from "./hud-config.js";

export function isInsideTmux(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(env.TMUX && env.TMUX.length > 0);
}

export function tmuxAvailable(): boolean {
  try {
    execFileSync("which", ["tmux"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

/** Build the list of tmux set commands for a cohesive status bar. */
export function tmuxStatusCommands(grokHome = defaultGrokHome()): string[][] {
  const theme = resolveTheme(undefined, process.env, { grokHome });
  const chrome = tmuxStatusChrome(theme);
  const linesFile = path.join(grokHome, "hud", "tmux-lines.txt");
  const singleFile = path.join(grokHome, "hud", "tmux-status.txt");
  // Claude-HUD parity: up to 3 status rows in the SAME terminal window
  const statusLines = Math.max(
    1,
    Math.min(3, loadHudConfig(grokHome).statusLines ?? 3),
  );

  const cmds: string[][] = [
    ["set", "-g", "status", String(statusLines)],
    ["set", "-g", "status-position", chrome.statusPosition],
    ["set", "-g", "status-interval", chrome.statusInterval],
    ["set", "-g", "status-style", chrome.statusStyle],
    ["set", "-g", "status-justify", "left"],
    ["set", "-g", "window-status-format", ""],
    ["set", "-g", "window-status-current-format", ""],
    ["set", "-g", "window-status-separator", ""],
    ["set", "-g", "status-left-length", "0"],
    ["set", "-g", "status-right-length", "0"],
    ["set", "-g", "status-left", ""],
    ["set", "-g", "status-right", ""],
  ];

  if (statusLines === 1) {
    cmds.push([
      "set",
      "-g",
      "status-format[0]",
      `#[align=left]#(cat ${singleFile} 2>/dev/null)`,
    ]);
  } else {
    for (let i = 0; i < statusLines; i++) {
      cmds.push([
        "set",
        "-g",
        `status-format[${i}]`,
        `#[align=left]#(sed -n '${i + 1}p' ${linesFile} 2>/dev/null)`,
      ]);
    }
  }
  return cmds;
}

/** Apply status bar to the current tmux server (same window). */
export function applyTmuxStatusBar(options: {
  grokHome?: string;
} = {}): boolean {
  if (!tmuxAvailable()) return false;
  const grokHome = options.grokHome ?? defaultGrokHome();
  try {
    for (const args of tmuxStatusCommands(grokHome)) {
      execFileSync("tmux", args, { stdio: "ignore", timeout: 2000 });
    }
    // force redraw
    try {
      execFileSync("tmux", ["refresh-client", "-S"], {
        stdio: "ignore",
        timeout: 1000,
      });
    } catch {
      /* ignore */
    }
    return true;
  } catch {
    return false;
  }
}

/** Write ~/.grok/hud/tmux.conf for persistence across restarts. */
export function writeTmuxConfFile(grokHome = defaultGrokHome()): string {
  const confPath = path.join(grokHome, "hud", "tmux.conf");
  const cmds = tmuxStatusCommands(grokHome);
  const body =
    `# grok-build-hud — Claude-HUD-parity multi-line status (same window)\n` +
    `# Follows Grok [ui].theme. Preset: ~/.grok/hud/config.json\n` +
    `# Auto-sourced by ~/.tmux.conf when present.\n\n` +
    cmds
      .map((args) => {
        // tmux.conf form: set -g key value
        if (args[0] === "set" && args[1] === "-g") {
          const key = args[2]!;
          const val = args.slice(3).join(" ");
          // quote values with spaces / special chars
          const needsQuote = /[\s#'"]/.test(val) || val.includes("#(");
          return `set -g ${key} ${needsQuote ? `'${val.replace(/'/g, `'\\''`)}'` : val}`;
        }
        return args.join(" ");
      })
      .join("\n") +
    "\n";
  fs.mkdirSync(path.dirname(confPath), { recursive: true });
  fs.writeFileSync(confPath, body, "utf8");
  return confPath;
}

/**
 * Re-exec current process inside tmux with status bar, then run `grok`.
 * Uses the SAME Terminal.app window (tmux replaces the foreground process).
 */
export function execGrokInSameWindowTmux(options: {
  grokHome?: string;
  grokBin?: string;
  sessionName?: string;
  extraGrokArgs?: string[];
}): never | void {
  const grokHome = options.grokHome ?? defaultGrokHome();
  const grokBin = options.grokBin ?? detectGrokBin();
  const session = options.sessionName ?? "grok-hud";
  const statusFile = path.join(grokHome, "hud", "tmux-status.txt");
  fs.mkdirSync(path.dirname(statusFile), { recursive: true });
  if (!fs.existsSync(statusFile)) {
    fs.writeFileSync(statusFile, "ctx … · quota …\n", "utf8");
  }
  writeTmuxConfFile(grokHome);

  if (isInsideTmux()) {
    applyTmuxStatusBar({ grokHome });
    const args = options.extraGrokArgs ?? [];
    const r = spawnSync(grokBin, args, { stdio: "inherit" });
    process.exit(r.status ?? 0);
  }

  if (!tmuxAvailable()) {
    console.error(
      "tmux not found. Install: brew install tmux\nThen re-run: grok-hud-run",
    );
    process.exit(1);
  }

  const grokArgs = options.extraGrokArgs ?? [];
  const grokCmd = [grokBin, ...grokArgs].map((a) => shellQuote(a)).join(" ");
  const conf = path.join(grokHome, "hud", "tmux.conf");

  // Apply conf then exec grok — same tty, no second window
  const wrapper = [
    `tmux source-file ${shellQuote(conf)} 2>/dev/null || true`,
    // re-apply in case source failed mid-session
    ...tmuxStatusCommands(grokHome).map(
      (args) => `tmux ${args.map(shellQuote).join(" ")} 2>/dev/null || true`,
    ),
    `exec ${grokCmd}`,
  ].join(" && ");

  const r = spawnSync(
    "tmux",
    ["new-session", "-A", "-s", session, "zsh", "-lc", wrapper],
    { stdio: "inherit" },
  );
  process.exit(r.status ?? 1);
}

function detectGrokBin(): string {
  const candidates = [
    path.join(os.homedir(), ".grok", "bin", "grok"),
    "/usr/local/bin/grok",
    "/opt/homebrew/bin/grok",
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  try {
    return execFileSync("which", ["grok"], { encoding: "utf8" }).trim();
  } catch {
    return "grok";
  }
}

function shellQuote(s: string): string {
  if (/^[a-zA-Z0-9_\/\-\.\:=]+$/.test(s)) return s;
  return `'${s.replace(/'/g, `'\\''`)}'`;
}

/** Install same-window launchers. */
export function installSameWindowLauncher(options: {
  binDir?: string;
} = {}): { runPath: string; grokWrapPath: string } {
  const binDir = options.binDir ?? path.join(os.homedir(), ".local", "bin");
  fs.mkdirSync(binDir, { recursive: true });
  const root = packageRoot();
  const node = process.execPath;
  const entry = path.join(root, "bin", "grok-build-hud.js");

  const runPath = path.join(binDir, "grok-hud-run");
  const runShim = `#!/bin/zsh
# Start Grok in THIS Terminal window with a permanent bottom status bar
# (tmux). Does not open a second window.
set -e
NODE=${JSON.stringify(node)}
ENTRY=${JSON.stringify(entry)}
"$NODE" "$ENTRY" --dashboard-start >/dev/null 2>&1 || true
"$NODE" "$ENTRY" --once --follow-active --no-color >/dev/null 2>&1 || true
exec "$NODE" "$ENTRY" --run-in-terminal "$@"
`;
  fs.writeFileSync(runPath, runShim, { mode: 0o755 });
  const grokWrapPath = path.join(binDir, "grok-with-hud");
  fs.writeFileSync(grokWrapPath, runShim, { mode: 0o755 });
  return { runPath, grokWrapPath };
}
