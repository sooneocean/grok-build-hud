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
import { installGrokCommandWrap } from "./grok-wrap.js";
import {
  hudTmuxDir,
  uniqueTmuxSessionName,
  writeTmuxInstanceMeta,
} from "./multi-session.js";

export function isInsideTmux(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(env.TMUX && env.TMUX.length > 0);
}

/** Current tmux session name, or null. */
export function currentTmuxSessionName(): string | null {
  try {
    const name = execFileSync(
      "tmux",
      ["display-message", "-p", "#{session_name}"],
      {
        encoding: "utf8",
        timeout: 1000,
        stdio: ["ignore", "pipe", "ignore"],
      },
    ).trim();
    return name || null;
  } catch {
    return null;
  }
}

export function tmuxAvailable(): boolean {
  try {
    execFileSync("which", ["tmux"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

/**
 * Build tmux status commands.
 * Status files are per-tmux-session under ~/.grok/hud/tmux/#{session_name}/
 * so parallel Terminals never share one bar / one Grok session.
 */
export function tmuxStatusCommands(grokHome = defaultGrokHome()): string[][] {
  const theme = resolveTheme(undefined, process.env, { grokHome });
  const chrome = tmuxStatusChrome(theme);
  const instRoot = path.join(grokHome, "hud", "tmux");
  // #{session_name} expanded by tmux before running #() — one bar per session
  const scopedLines = `${instRoot}/#{session_name}/tmux-lines.txt`;
  const scopedSingle = `${instRoot}/#{session_name}/tmux-status.txt`;
  const fallbackLines = path.join(grokHome, "hud", "tmux-lines.txt");
  const fallbackSingle = path.join(grokHome, "hud", "tmux-status.txt");
  // Up to 3 status rows in the SAME terminal window
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
    // Allow full client width (dashboard rewrites lines to fit each window)
    ["set", "-g", "status-left-length", chrome.statusLeftLength],
    ["set", "-g", "status-right-length", chrome.statusRightLength],
    ["set", "-g", "status-left", ""],
    ["set", "-g", "status-right", ""],
  ];

  // align=left; content already truncated to #{client_width} by dashboard
  if (statusLines === 1) {
    cmds.push([
      "set",
      "-g",
      "status-format[0]",
      `#[align=left]#(cat ${scopedSingle} 2>/dev/null || cat ${fallbackSingle} 2>/dev/null)`,
    ]);
  } else {
    for (let i = 0; i < statusLines; i++) {
      cmds.push([
        "set",
        "-g",
        `status-format[${i}]`,
        `#[align=left]#(sed -n '${i + 1}p' ${scopedLines} 2>/dev/null || sed -n '${i + 1}p' ${fallbackLines} 2>/dev/null)`,
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
    `# grok-build-hud — multi-line live status (same window)\n` +
    `# Follows Grok [ui].theme. Config: ~/.grok/hud/config.json\n` +
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
 *
 * IMPORTANT: each launch gets a UNIQUE tmux session name (no `-A` attach).
 * Parallel Terminals must never share one tmux session / one Grok conversation.
 */
export function execGrokInSameWindowTmux(options: {
  grokHome?: string;
  grokBin?: string;
  sessionName?: string;
  extraGrokArgs?: string[];
}): never | void {
  const grokHome = options.grokHome ?? defaultGrokHome();
  const grokBin = options.grokBin ?? detectGrokBin();
  // Unique per Terminal launch — never fixed "grok-hud" + -A (that synced all tabs)
  const session =
    options.sessionName?.trim() ||
    uniqueTmuxSessionName(process.env);

  const instDir = hudTmuxDir(session, grokHome);
  fs.mkdirSync(instDir, { recursive: true });
  const statusFile = path.join(instDir, "tmux-status.txt");
  if (!fs.existsSync(statusFile)) {
    fs.writeFileSync(statusFile, "ctx … · quota …\n", "utf8");
  }
  // Also ensure global fallback placeholders
  fs.mkdirSync(path.join(grokHome, "hud"), { recursive: true });
  const globalStatus = path.join(grokHome, "hud", "tmux-status.txt");
  if (!fs.existsSync(globalStatus)) {
    fs.writeFileSync(globalStatus, "ctx … · quota …\n", "utf8");
  }

  writeTmuxInstanceMeta({
    tmuxSession: session,
    launcherPid: process.pid,
    startedAt: new Date().toISOString(),
    tty: process.env.TTY ?? null,
  }, grokHome);
  writeTmuxConfFile(grokHome);

  if (isInsideTmux()) {
    // Already in tmux: stay in THIS session (never attach to another)
    const current =
      process.env.GROK_HUD_TMUX_SESSION?.trim() ||
      currentTmuxSessionName() ||
      session;
    applyTmuxStatusBar({ grokHome });
    writeTmuxInstanceMeta({
      tmuxSession: current,
      launcherPid: process.pid,
      startedAt: new Date().toISOString(),
      tty: process.env.TTY ?? null,
    }, grokHome);
    const args = options.extraGrokArgs ?? [];
    const r = spawnSync(grokBin, args, {
      stdio: "inherit",
      env: {
        ...process.env,
        GROK_HUD_TMUX_SESSION: current,
        GROK_HUD_ACTIVE: "1",
      },
    });
    process.exit(r.status ?? 0);
  }

  if (!tmuxAvailable()) {
    console.error(
      "tmux not found. Install: brew install tmux\nThen re-run: grok",
    );
    process.exit(1);
  }

  const grokArgs = options.extraGrokArgs ?? [];
  const grokCmd = [grokBin, ...grokArgs].map((a) => shellQuote(a)).join(" ");
  const conf = path.join(grokHome, "hud", "tmux.conf");

  // Apply conf then exec grok — same tty, no second window
  // Export session name so dashboard can bind status files to this Terminal
  const wrapper = [
    `export GROK_HUD_TMUX_SESSION=${shellQuote(session)}`,
    `export GROK_HUD_ACTIVE=1`,
    `tmux source-file ${shellQuote(conf)} 2>/dev/null || true`,
    // session-local options preferred over -g when possible
    ...tmuxStatusCommands(grokHome).map(
      (args) => `tmux ${args.map(shellQuote).join(" ")} 2>/dev/null || true`,
    ),
    `exec ${grokCmd}`,
  ].join(" && ");

  // NO -A: never attach to an existing session (that was the multi-tab sync bug)
  const r = spawnSync(
    "tmux",
    ["new-session", "-s", session, "zsh", "-lc", wrapper],
    {
      stdio: "inherit",
      env: {
        ...process.env,
        GROK_HUD_TMUX_SESSION: session,
        GROK_HUD_ACTIVE: "1",
      },
    },
  );
  process.exit(r.status ?? 1);
}

/** Real Grok binary only — never the HUD wrapper (avoids exec loops). */
export function detectGrokBin(): string {
  // Lazy import-free: prefer grok-real then downloads, skip wrap scripts
  const grokHome = process.env.GROK_HOME?.trim() || path.join(os.homedir(), ".grok");
  const realLink = path.join(grokHome, "bin", "grok-real");
  if (fs.existsSync(realLink)) {
    try {
      return fs.realpathSync(realLink);
    } catch {
      return realLink;
    }
  }
  if (process.env.GROK_REAL_BIN && fs.existsSync(process.env.GROK_REAL_BIN)) {
    return process.env.GROK_REAL_BIN;
  }
  const downloads = path.join(grokHome, "downloads");
  if (fs.existsSync(downloads)) {
    try {
      const hit = fs
        .readdirSync(downloads)
        .filter((n) => n.startsWith("grok-"))
        .map((n) => path.join(downloads, n))
        .filter((p) => {
          try {
            fs.accessSync(p, fs.constants.X_OK);
            return true;
          } catch {
            return false;
          }
        })
        .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0];
      if (hit) return hit;
    } catch {
      /* ignore */
    }
  }
  const candidates = [
    path.join(grokHome, "bin", "grok"),
    "/usr/local/bin/grok",
    "/opt/homebrew/bin/grok",
  ];
  for (const c of candidates) {
    if (!fs.existsSync(c)) continue;
    // Skip our zsh wrapper if somehow still on PATH
    try {
      const st = fs.statSync(c);
      if (st.size < 64_000) {
        const head = fs.readFileSync(c, "utf8").slice(0, 200);
        if (head.includes("grok-build-hud wrap")) continue;
      }
    } catch {
      /* binary */
    }
    return c;
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

/** Install same-window launchers (+ optional plain `grok` wrap). */
export function installSameWindowLauncher(options: {
  binDir?: string;
  wrapGrokCommand?: boolean;
} = {}): {
  runPath: string;
  grokWrapPath: string;
  grokCommand?: string;
  realGrok?: string;
} {
  const binDir = options.binDir ?? path.join(os.homedir(), ".local", "bin");
  fs.mkdirSync(binDir, { recursive: true });
  const root = packageRoot();
  const node = process.execPath;
  const entry = path.join(root, "bin", "grok-build-hud.js");

  const runPath = path.join(binDir, "grok-hud-run");
  const runShim = `#!/bin/zsh
# Start Grok in THIS Terminal window with a permanent bottom status bar
# (tmux). Does not open a second window.
# Prefer plain:  grok
set -e
export GROK_HUD_THEME="\${GROK_HUD_THEME:-auto}"
export GROK_HUD_ACTIVE=1
NODE=${JSON.stringify(node)}
ENTRY=${JSON.stringify(entry)}
"$NODE" "$ENTRY" --dashboard-start >/dev/null 2>&1 || true
"$NODE" "$ENTRY" --once --follow-active --no-color >/dev/null 2>&1 || true
exec "$NODE" "$ENTRY" --run-in-terminal "$@"
`;
  fs.writeFileSync(runPath, runShim, { mode: 0o755 });
  const grokWrapPath = path.join(binDir, "grok-with-hud");
  fs.writeFileSync(grokWrapPath, runShim, { mode: 0o755 });

  let grokCommand: string | undefined;
  let realGrok: string | undefined;
  if (options.wrapGrokCommand !== false) {
    const r = installGrokCommandWrap({ nodeBin: node });
    grokCommand = r.wrapperPath;
    realGrok = r.realPath;
  }
  return { runPath, grokWrapPath, grokCommand, realGrok };
}
