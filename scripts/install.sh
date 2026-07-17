#!/usr/bin/env bash
# One-shot installer for grok-build-hud (run from repo root or via: npm run setup)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

need() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "error: missing dependency: $1" >&2
    if [[ "$1" == "tmux" ]]; then
      echo "  macOS: brew install tmux" >&2
    elif [[ "$1" == "node" ]]; then
      echo "  install Node.js 18+ from https://nodejs.org" >&2
    fi
    exit 1
  fi
}

need node
need npm
if ! command -v tmux >/dev/null 2>&1; then
  echo "warn: tmux not found — same-window HUD needs tmux (brew install tmux)" >&2
fi

NODE_MAJOR="$(node -p "process.versions.node.split('.')[0]")"
if [[ "$NODE_MAJOR" -lt 18 ]]; then
  echo "error: Node.js 18+ required (found $(node -v))" >&2
  exit 1
fi

echo "==> Installing dependencies"
npm install

echo "==> Building"
npm run build

echo "==> Linking CLI onto PATH (npm link)"
npm link

echo "==> Installing dashboard (hooks + tmux conf + shims)"
node bin/grok-build-hud.js --install-dashboard
node bin/grok-build-hud.js --theme auto
node bin/grok-build-hud.js --preset full

echo ""
VER="$(node -e "import('node:fs').then(fs=>console.log(JSON.parse(fs.readFileSync('package.json','utf8')).version))" 2>/dev/null || echo 0.3.0)"
echo "Done. grok-build-hud v${VER}"
echo ""
echo "  Start Grok with HUD (same window):  grok-hud-run"
echo "  One-shot snapshot:                  grok-hud status"
echo "  Preset:                             grok-build-hud --preset full"
echo "  Theme:                              grok-build-hud --theme auto"
echo "  Stop updater:                       grok-hud stop"
echo ""
echo "中文说明: README.zh-CN.md"
echo "If command not found, add to PATH and re-open the shell:"
echo "  export PATH=\"\$(npm prefix -g)/bin:\$HOME/.local/bin:\$PATH\""
