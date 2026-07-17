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

echo "==> 安装依赖"
npm install

echo "==> 编译"
npm run build

echo "==> 链接 CLI 到 PATH (npm link)"
npm link

echo "==> 安装 dashboard（hooks + tmux + shims）"
node bin/grok-build-hud.js --install-dashboard
node bin/grok-build-hud.js --theme auto
node bin/grok-build-hud.js --preset full

echo ""
VER="$(node -e "import('node:fs').then(fs=>console.log(JSON.parse(fs.readFileSync('package.json','utf8')).version))" 2>/dev/null || echo 0.3.0)"
echo "完成。grok-build-hud v${VER}"
echo ""
echo "  启动 Grok + 底部 HUD：  grok"
echo "  看当前状态一次：        grok-hud status"
echo "  设定（语言/预设）：     grok-hud settings"
echo "  主题跟随 Grok：         grok-build-hud --theme auto"
echo "  停止后台刷新：          grok-hud stop"
echo ""
echo "文档（中文）：README.md"
echo "English:      README.en.md"
echo "若提示 command not found，把下面加入 PATH 后重开终端："
echo "  export PATH=\"\$(npm prefix -g)/bin:\$HOME/.local/bin:\$PATH\""
