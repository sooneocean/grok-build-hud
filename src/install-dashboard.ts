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

export interface DashboardInstallResult {
  binPath: string;
  tmuxConf: string;
  launchAgent?: string;
  hooksPath: string;
  daemon: { started: boolean; alreadyRunning: boolean; pid?: number };
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

  // LaunchAgent keeps dashboard alive across reboots (macOS)
  let launchAgent: string | undefined;
  if (process.platform === "darwin") {
    const agentsDir = path.join(
      os.homedir(),
      "Library",
      "LaunchAgents",
    );
    fs.mkdirSync(agentsDir, { recursive: true });
    launchAgent = path.join(agentsDir, "com.dex.grok-hud-dashboard.plist");
    const log = path.join(grokHome, "hud", "dashboard.log");
    const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.dex.grok-hud-dashboard</string>
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
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>${log}</string>
  <key>StandardErrorPath</key>
  <string>${log}</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>HOME</key>
    <string>${os.homedir()}</string>
    <key>PATH</key>
    <string>/usr/local/bin:/usr/bin:/bin:/opt/homebrew/bin</string>
  </dict>
</dict>
</plist>
`;
    fs.writeFileSync(launchAgent, plist, "utf8");
    try {
      execSilent(["launchctl", "unload", launchAgent]);
    } catch {
      /* not loaded */
    }
    try {
      execSilent(["launchctl", "load", launchAgent]);
    } catch {
      /* may need user session */
    }
  }

  let daemon: DashboardInstallResult["daemon"] = {
    started: false,
    alreadyRunning: false,
  };
  if (options.startDaemon !== false) {
    daemon = ensureDashboardDaemon({
      grokHome,
      entryJs: path.join(root, "dist", "src", "index.js"),
      intervalMs: 2000,
    });
  }

  return { binPath, tmuxConf, launchAgent, hooksPath, daemon };
}

function execSilent(args: string[]): void {
  execFileSync(args[0]!, args.slice(1), {
    stdio: "ignore",
    timeout: 5000,
  });
}

export function uninstallDashboard(options: {
  grokHome?: string;
} = {}): void {
  const grokHome = options.grokHome ?? defaultGrokHome();
  stopDashboard(grokHome);

  if (process.platform === "darwin") {
    const launchAgent = path.join(
      os.homedir(),
      "Library",
      "LaunchAgents",
      "com.dex.grok-hud-dashboard.plist",
    );
    try {
      execSilent(["launchctl", "unload", launchAgent]);
    } catch {
      /* ignore */
    }
    try {
      if (fs.existsSync(launchAgent)) fs.unlinkSync(launchAgent);
    } catch {
      /* ignore */
    }
  }
}
