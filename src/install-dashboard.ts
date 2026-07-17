import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";
import { packageRoot, installGlobalHooks } from "./install.js";
import { defaultGrokHome } from "./session.js";
import {
  ensureDashboardDaemon,
  stopDashboard,
} from "./dashboard.js";
import { writeTmuxConfFile } from "./tmux-hud.js";
import {
  installGrokCommandWrap,
  uninstallGrokCommandWrap,
} from "./grok-wrap.js";
import { ensureFollowMode } from "./theme.js";
import { ensureDefaultConfig } from "./hud-config.js";

export interface DashboardInstallResult {
  binPath: string;
  tmuxConf: string;
  launchAgent?: string;
  launchAgentLoaded?: boolean;
  terminalHook?: string;
  hooksPath: string;
  daemon: { started: boolean; alreadyRunning: boolean; pid?: number };
  grokWrap?: { wrapperPath: string; realPath: string };
}

const TERMINAL_HOOK_MARKER = "# >>> grok-build-hud terminal >>>";

/**
 * When Terminal (interactive shell) starts, ensure HUD daemon is alive.
 * This is the intended lifecycle — NOT machine boot. User opens Terminal → ready.
 */
export function installTerminalStartupHook(options: {
  binDir?: string;
  nodeBin?: string;
  entryJs?: string;
} = {}): string {
  const zshrc = path.join(os.homedir(), ".zshrc");
  const binDir = options.binDir ?? path.join(os.homedir(), ".local", "bin");
  const node = options.nodeBin ?? process.execPath;
  const entry =
    options.entryJs ?? path.join(packageRoot(), "bin", "grok-build-hud.js");

  const block = `${TERMINAL_HOOK_MARKER}
# Start HUD status updater when an interactive Terminal opens (not machine boot).
if [[ -o interactive ]] && [[ -z "\${GROK_HUD_SKIP_SHELL_START:-}" ]]; then
  (
    NODE=${JSON.stringify(node)}
    ENTRY=${JSON.stringify(entry)}
    # only if not already running — silent, non-blocking
    if [[ -x "$NODE" && -f "$ENTRY" ]]; then
      "$NODE" "$ENTRY" --dashboard-start >/dev/null 2>&1 || true
    elif [[ -x "${binDir}/grok-hud" ]]; then
      "${binDir}/grok-hud" start >/dev/null 2>&1 || true
    fi
  ) &!
fi
# <<< grok-build-hud terminal <<<
`;

  let cur = "";
  try {
    if (fs.existsSync(zshrc)) cur = fs.readFileSync(zshrc, "utf8");
  } catch {
    cur = "";
  }
  if (cur.includes(TERMINAL_HOOK_MARKER)) {
    // Replace existing block
    const re =
      /# >>> grok-build-hud terminal >>>[\s\S]*?# <<< grok-build-hud terminal <<<\n?/;
    cur = cur.replace(re, block.endsWith("\n") ? block : block + "\n");
    fs.writeFileSync(zshrc, cur, "utf8");
  } else {
    fs.writeFileSync(
      zshrc,
      (cur.replace(/\s*$/, "") + "\n\n" + block + "\n").replace(/^\n+/, ""),
      "utf8",
    );
  }
  return zshrc;
}

export function uninstallTerminalStartupHook(): boolean {
  const zshrc = path.join(os.homedir(), ".zshrc");
  try {
    if (!fs.existsSync(zshrc)) return false;
    const cur = fs.readFileSync(zshrc, "utf8");
    if (!cur.includes(TERMINAL_HOOK_MARKER)) return false;
    const next = cur.replace(
      /# >>> grok-build-hud terminal >>>[\s\S]*?# <<< grok-build-hud terminal <<<\n?/,
      "",
    );
    fs.writeFileSync(zshrc, next, "utf8");
    return true;
  } catch {
    return false;
  }
}

export function installDashboard(options: {
  grokHome?: string;
  binDir?: string;
  startDaemon?: boolean;
} = {}): DashboardInstallResult {
  const grokHome = options.grokHome ?? defaultGrokHome();
  const root = packageRoot();
  const binDir = options.binDir ?? path.join(os.homedir(), ".local", "bin");
  fs.mkdirSync(binDir, { recursive: true });

  // Ensure hooks (update status files on every turn)
  const { hooksPath } = installGlobalHooks({ grokHome, root });

  const entry = path.join(root, "bin", "grok-build-hud.js");
  const node = process.execPath;

  // CLI shim always on PATH
  const binPath = path.join(binDir, "grok-hud");
  const shim = `#!/bin/zsh
# grok-hud — always-on terminal dashboard for Grok Build
set -e
NODE=${JSON.stringify(node)}
ENTRY=${JSON.stringify(entry)}
case "\${1:-}" in
  stop)
    exec "$NODE" "$ENTRY" --dashboard-stop
    ;;
  status)
    if [[ -f "$HOME/.grok/hud/status.txt" ]]; then
      cat "$HOME/.grok/hud/status.txt"
    else
      exec "$NODE" "$ENTRY" --once --follow-active --no-color
    fi
    ;;
  watch)
    exec "$NODE" "$ENTRY" --watch --follow-active --no-color
    ;;
  ""|start|status)
    "$NODE" "$ENTRY" --dashboard-start >/dev/null 2>&1 || true
    exec "$NODE" "$ENTRY" --once --follow-active --no-color
    ;;
  run)
    exec "$NODE" "$ENTRY" --run-in-terminal
    ;;
  *)
    exec "$NODE" "$ENTRY" "$@"
    ;;
esac
`;
  fs.writeFileSync(binPath, shim, { mode: 0o755 });

  // tmux status bar fragment (cohesive Clear Dark palette)
  const tmuxConf = writeTmuxConfFile(grokHome);

  // Soft-append to ~/.tmux.conf if present or create minimal
  const userTmux = path.join(os.homedir(), ".tmux.conf");
  const marker = "# >>> grok-build-hud >>>";
  const block = `${marker}
# live Grok context + quota in status bar
if-shell '[ -f "$HOME/.grok/hud/tmux.conf" ]' 'source-file ~/.grok/hud/tmux.conf'
# <<< grok-build-hud <<<
`;
  if (fs.existsSync(userTmux)) {
    const cur = fs.readFileSync(userTmux, "utf8");
    if (!cur.includes(marker)) {
      fs.writeFileSync(userTmux, cur.replace(/\s*$/, "\n\n") + block + "\n", "utf8");
    }
  } else {
    fs.writeFileSync(userTmux, block + "\n", "utf8");
  }

  // Plain `grok` → HUD (real binary at ~/.grok/bin/grok-real)
  let grokWrap: DashboardInstallResult["grokWrap"];
  try {
    const w = installGrokCommandWrap({ nodeBin: node });
    grokWrap = { wrapperPath: w.wrapperPath, realPath: w.realPath };
  } catch {
    /* Grok not installed yet */
  }

  // Theme: always follow Grok [ui].theme (clear legacy locks)
  ensureFollowMode(grokHome);
  // Default language 简体中文 (user can switch in settings)
  ensureDefaultConfig(grokHome);

  // Terminal-open hook (primary lifecycle): interactive zsh → ensure daemon
  const terminalHook = installTerminalStartupHook({
    binDir,
    nodeBin: node,
    entryJs: entry,
  });

  // Optional LaunchAgent: keep status files fresh while sessions exist.
  // NOT the primary "boot" story — Terminal open + `grok` is the UX.
  let launchAgent: string | undefined;
  let launchAgentLoaded = false;
  if (process.platform === "darwin") {
    const agentsDir = path.join(os.homedir(), "Library", "LaunchAgents");
    fs.mkdirSync(agentsDir, { recursive: true });
    launchAgent = path.join(agentsDir, "com.dex.grok-hud-dashboard.plist");
    const log = path.join(grokHome, "hud", "dashboard.log");
    const label = "com.dex.grok-hud-dashboard";
    const pathEnv = [
      path.dirname(node),
      "/opt/homebrew/bin",
      "/usr/local/bin",
      "/usr/bin",
      "/bin",
      path.join(os.homedir(), ".local", "bin"),
      path.join(os.homedir(), ".grok", "bin"),
    ].join(":");
    const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${label}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${node}</string>
    <string>${entry}</string>
    <string>--dashboard</string>
    <string>--follow-active</string>
    <string>--interval</string>
    <string>500</string>
  </array>
  <key>RunAtLoad</key>
  <false/>
  <key>KeepAlive</key>
  <false/>
  <key>ThrottleInterval</key>
  <integer>5</integer>
  <key>StandardOutPath</key>
  <string>${log}</string>
  <key>StandardErrorPath</key>
  <string>${log}</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>HOME</key>
    <string>${os.homedir()}</string>
    <key>PATH</key>
    <string>${pathEnv}</string>
    <key>GROK_HUD_THEME</key>
    <string>auto</string>
    <key>GROK_HOME</key>
    <string>${grokHome}</string>
  </dict>
  <key>WorkingDirectory</key>
  <string>${os.homedir()}</string>
  <key>ProcessType</key>
  <string>Background</string>
</dict>
</plist>
`;
    fs.writeFileSync(launchAgent, plist, "utf8");
    // Unload login-boot agent if previously installed with KeepAlive
    try {
      const uid = typeof process.getuid === "function" ? process.getuid() : 501;
      execSilent(["launchctl", "bootout", `gui/${uid}/${label}`]);
    } catch {
      try {
        execSilent(["launchctl", "unload", launchAgent]);
      } catch {
        /* ignore */
      }
    }
    launchAgentLoaded = false; // intentional: Terminal-start driven, not login boot
  }

  let daemon: DashboardInstallResult["daemon"] = {
    started: false,
    alreadyRunning: false,
  };
  if (options.startDaemon !== false) {
    daemon = ensureDashboardDaemon({
      grokHome,
      entryJs: path.join(root, "dist", "src", "index.js"),
      intervalMs: 500,
    });
  }

  return {
    binPath,
    tmuxConf,
    launchAgent,
    launchAgentLoaded,
    terminalHook,
    hooksPath,
    daemon,
    grokWrap,
  };
}

function execSilent(args: string[]): void {
  execFileSync(args[0]!, args.slice(1), {
    stdio: "ignore",
    timeout: 8000,
  });
}

/** macOS modern launchctl (bootstrap/kickstart) with legacy unload/load fallback. */
export function loadLaunchAgent(label: string, plistPath: string): boolean {
  if (process.platform !== "darwin") return false;
  const uid = typeof process.getuid === "function" ? process.getuid() : 501;
  const domain = `gui/${uid}`;
  const service = `${domain}/${label}`;

  // Tear down any previous registration
  try {
    execSilent(["launchctl", "bootout", service]);
  } catch {
    try {
      execSilent(["launchctl", "unload", plistPath]);
    } catch {
      /* not loaded */
    }
  }

  try {
    execSilent(["launchctl", "bootstrap", domain, plistPath]);
  } catch {
    try {
      execSilent(["launchctl", "load", "-w", plistPath]);
    } catch {
      return false;
    }
  }

  try {
    execSilent(["launchctl", "enable", service]);
  } catch {
    /* optional on older macOS */
  }
  try {
    execSilent(["launchctl", "kickstart", "-k", service]);
  } catch {
    /* may already be running */
  }

  // Verify
  try {
    const out = execFileSync("launchctl", ["print", service], {
      encoding: "utf8",
      timeout: 3000,
      stdio: ["ignore", "pipe", "ignore"],
    });
    return out.includes("state = running") || out.includes("pid =");
  } catch {
    try {
      const list = execFileSync("launchctl", ["list"], {
        encoding: "utf8",
        timeout: 3000,
      });
      return list.includes(label);
    } catch {
      return false;
    }
  }
}

export function uninstallDashboard(options: {
  grokHome?: string;
  restoreGrokCommand?: boolean;
} = {}): void {
  const grokHome = options.grokHome ?? defaultGrokHome();
  stopDashboard(grokHome);

  if (options.restoreGrokCommand !== false) {
    try {
      uninstallGrokCommandWrap({ grokHome });
    } catch {
      /* ignore */
    }
  }
  try {
    uninstallTerminalStartupHook();
  } catch {
    /* ignore */
  }

  if (process.platform === "darwin") {
    const label = "com.dex.grok-hud-dashboard";
    const launchAgent = path.join(
      os.homedir(),
      "Library",
      "LaunchAgents",
      `${label}.plist`,
    );
    const uid = typeof process.getuid === "function" ? process.getuid() : 501;
    try {
      execSilent(["launchctl", "bootout", `gui/${uid}/${label}`]);
    } catch {
      try {
        execSilent(["launchctl", "unload", launchAgent]);
      } catch {
        /* ignore */
      }
    }
    try {
      if (fs.existsSync(launchAgent)) fs.unlinkSync(launchAgent);
    } catch {
      /* ignore */
    }
  }
}
