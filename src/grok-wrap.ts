/**
 * Make plain `grok` start with HUD (same-window tmux strip).
 * Preserves bare CLI for scripts, pipes, and non-interactive flags.
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";
import { packageRoot } from "./install.js";
import { defaultGrokHome } from "./session.js";

const WRAP_MARKER = "# >>> grok-build-hud wrap >>>";

/** Subcommands / flags that must hit the real binary without tmux HUD. */
const BARE_FIRST_ARGS = new Set([
  "-p",
  "--print",
  "-h",
  "--help",
  "-V",
  "--version",
  "version",
  "login",
  "logout",
  "auth",
  "plugin",
  "mcp",
  "doctor",
  "update",
  "upgrade",
  "completion",
  "config",
  "whoami",
  "uninstall",
]);

export function shouldUseHudForGrokInvoke(options: {
  args?: string[];
  env?: NodeJS.ProcessEnv;
  isTtyIn?: boolean;
  isTtyOut?: boolean;
}): boolean {
  const env = options.env ?? process.env;
  if (env.GROK_NO_HUD === "1" || env.GROK_BARE === "1") return false;
  if (env.GROK_HUD_ACTIVE === "1") return false;
  const ttyIn = options.isTtyIn ?? Boolean(process.stdin.isTTY);
  const ttyOut = options.isTtyOut ?? Boolean(process.stdout.isTTY);
  if (!ttyIn || !ttyOut) return false;

  const args = options.args ?? [];
  const first = args[0];
  if (first && BARE_FIRST_ARGS.has(first)) return false;
  // long flags like --print=...
  if (first?.startsWith("--print") || first?.startsWith("-p=")) return false;

  return true;
}

/** Resolve the real Grok binary (never the HUD wrapper). */
export function resolveRealGrokBin(
  grokHome = defaultGrokHome(),
): string | null {
  const realLink = path.join(grokHome, "bin", "grok-real");
  if (isExecutable(realLink)) return fs.realpathSync(realLink);

  const downloads = path.join(grokHome, "downloads");
  if (fs.existsSync(downloads)) {
    try {
      const names = fs
        .readdirSync(downloads)
        .filter((n) => n.startsWith("grok-") && !n.includes("hud"))
        .map((n) => path.join(downloads, n))
        .filter(isExecutable)
        .sort(
          (a, b) =>
            fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs,
        );
      if (names[0]) return names[0];
    } catch {
      /* ignore */
    }
  }

  // Existing ~/.grok/bin/grok if it is NOT our wrapper
  const grokBin = path.join(grokHome, "bin", "grok");
  if (isExecutable(grokBin) && !isOurWrapper(grokBin)) {
    try {
      return fs.realpathSync(grokBin);
    } catch {
      return grokBin;
    }
  }

  for (const c of [
    "/usr/local/bin/grok",
    "/opt/homebrew/bin/grok",
    path.join(os.homedir(), ".local", "bin", "grok"),
  ]) {
    if (isExecutable(c) && !isOurWrapper(c)) {
      try {
        return fs.realpathSync(c);
      } catch {
        return c;
      }
    }
  }

  try {
    const w = execFileSync("which", ["-a", "grok"], {
      encoding: "utf8",
    })
      .trim()
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    for (const c of w) {
      if (isExecutable(c) && !isOurWrapper(c)) return c;
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function isOurWrapper(filePath: string): boolean {
  try {
    // symlink to binary → not wrapper
    const st = fs.lstatSync(filePath);
    if (st.isSymbolicLink()) {
      const target = fs.readlinkSync(filePath);
      if (!target.endsWith(".sh") && !target.includes("wrap")) {
        // could still be our script if relative — read content
      }
    }
    if (st.isFile() || st.isSymbolicLink()) {
      // only read if small text script
      if (st.isSymbolicLink()) {
        const real = fs.realpathSync(filePath);
        const rst = fs.statSync(real);
        if (rst.size > 64_000) return false;
        const head = fs.readFileSync(real, "utf8").slice(0, 400);
        return head.includes(WRAP_MARKER) || head.includes("grok-build-hud wrap");
      }
      if (st.size > 64_000) return false;
      const head = fs.readFileSync(filePath, "utf8").slice(0, 400);
      return head.includes(WRAP_MARKER) || head.includes("grok-build-hud wrap");
    }
  } catch {
    return false;
  }
  return false;
}

function isExecutable(p: string): boolean {
  try {
    fs.accessSync(p, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

export interface GrokWrapInstallResult {
  wrapperPath: string;
  realPath: string;
  realLink: string;
  localBinPath?: string;
}

/**
 * Install: `grok` → HUD when interactive; bare otherwise.
 * Real binary kept at ~/.grok/bin/grok-real.
 */
export function installGrokCommandWrap(options: {
  grokHome?: string;
  nodeBin?: string;
} = {}): GrokWrapInstallResult {
  const grokHome = options.grokHome ?? defaultGrokHome();
  const binDir = path.join(grokHome, "bin");
  fs.mkdirSync(binDir, { recursive: true });

  const real = resolveRealGrokBin(grokHome);
  if (!real) {
    throw new Error(
      "Cannot find real Grok binary. Install Grok Build first (https://x.ai/cli).",
    );
  }

  const realLink = path.join(binDir, "grok-real");
  // Point grok-real at the resolved binary (absolute path symlink)
  try {
    fs.lstatSync(realLink);
    fs.unlinkSync(realLink);
  } catch {
    /* missing */
  }
  fs.symlinkSync(real, realLink);

  const root = packageRoot();
  const node = options.nodeBin ?? process.execPath;
  const entry = path.join(root, "bin", "grok-build-hud.js");
  const wrapperPath = path.join(binDir, "grok");

  const body = `#!/bin/zsh
${WRAP_MARKER}
# Plain \`grok\` → same-window HUD. Bare CLI: GROK_NO_HUD=1 grok …
# Auto-installed by grok-build-hud. Real binary: ~/.grok/bin/grok-real
set -euo pipefail

REAL="\${GROK_REAL_BIN:-$HOME/.grok/bin/grok-real}"
if [[ ! -x "$REAL" ]]; then
  # fallback: newest download
  REAL="$(ls -t "$HOME"/.grok/downloads/grok-* 2>/dev/null | head -1 || true)"
fi
if [[ ! -x "$REAL" ]]; then
  echo "grok-hud wrap: real binary not found (expected ~/.grok/bin/grok-real)" >&2
  exit 127
fi

# Escape hatches
if [[ "\${GROK_NO_HUD:-}" == "1" || "\${GROK_BARE:-}" == "1" || "\${GROK_HUD_ACTIVE:-}" == "1" ]]; then
  exec "$REAL" "$@"
fi

# Non-interactive / pipes → bare
if [[ ! -t 0 || ! -t 1 ]]; then
  exec "$REAL" "$@"
fi

# Subcommands that are not the TUI
case "\${1:-}" in
  -p|--print|-h|--help|-V|--version|version|login|logout|auth|plugin|mcp|doctor|update|upgrade|completion|config|whoami|uninstall)
    exec "$REAL" "$@"
    ;;
  --print=*|-p=*)
    exec "$REAL" "$@"
    ;;
esac

NODE=${JSON.stringify(node)}
ENTRY=${JSON.stringify(entry)}
export GROK_HUD_ACTIVE=1
export GROK_REAL_BIN="$REAL"
export GROK_HUD_THEME="\${GROK_HUD_THEME:-auto}"

# Ensure background status updater is up, then same-window HUD + Grok
"$NODE" "$ENTRY" --dashboard-start >/dev/null 2>&1 || true
"$NODE" "$ENTRY" --once --follow-active --no-color >/dev/null 2>&1 || true
exec "$NODE" "$ENTRY" --run-in-terminal "$@"
# <<< grok-build-hud wrap <<<
`;

  // Replace existing grok (symlink or file)
  try {
    fs.unlinkSync(wrapperPath);
  } catch {
    /* ignore */
  }
  fs.writeFileSync(wrapperPath, body, { mode: 0o755 });

  // Also put a thin pointer in ~/.local/bin if that path is commonly used
  let localBinPath: string | undefined;
  const localBin = path.join(os.homedir(), ".local", "bin", "grok");
  try {
    fs.mkdirSync(path.dirname(localBin), { recursive: true });
    // Only replace if missing, symlink, or already our wrap
    let replace = !fs.existsSync(localBin);
    if (!replace) {
      try {
        const st = fs.lstatSync(localBin);
        if (st.isSymbolicLink() || isOurWrapper(localBin)) replace = true;
      } catch {
        replace = true;
      }
    }
    if (replace) {
      try {
        fs.unlinkSync(localBin);
      } catch {
        /* ignore */
      }
      // Prefer symlink to the canonical wrapper so one source of truth
      fs.symlinkSync(wrapperPath, localBin);
      localBinPath = localBin;
    }
  } catch {
    /* optional */
  }

  return { wrapperPath, realPath: real, realLink, localBinPath };
}

/** Restore plain grok symlink to real binary; remove wrap. */
export function uninstallGrokCommandWrap(options: {
  grokHome?: string;
} = {}): { restored: boolean; path?: string } {
  const grokHome = options.grokHome ?? defaultGrokHome();
  const wrapperPath = path.join(grokHome, "bin", "grok");
  const realLink = path.join(grokHome, "bin", "grok-real");

  let real: string | null = null;
  if (isExecutable(realLink)) {
    try {
      real = fs.realpathSync(realLink);
    } catch {
      real = realLink;
    }
  } else {
    real = resolveRealGrokBin(grokHome);
  }

  if (!real) return { restored: false };

  try {
    if (fs.existsSync(wrapperPath) || fs.lstatSync(wrapperPath)) {
      fs.unlinkSync(wrapperPath);
    }
  } catch {
    try {
      fs.unlinkSync(wrapperPath);
    } catch {
      /* ignore */
    }
  }
  fs.symlinkSync(real, wrapperPath);
  return { restored: true, path: wrapperPath };
}
