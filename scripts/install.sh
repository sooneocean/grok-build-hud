#!/usr/bin/env bash
# One-shot installer: CLI + same-window HUD + Grok plugin registration
# Idempotent: re-run after git pull to upgrade without clobbering user aesthetic.
# Run from repo root: bash scripts/install.sh  |  npm run setup
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

HUD_CFG="${GROK_HOME:-$HOME/.grok}/hud/config.json"
HAS_USER_CFG=0
if [[ -f "$HUD_CFG" ]]; then
  HAS_USER_CFG=1
fi

echo "==> [1/5] 安装依赖"
npm install

echo "==> [2/5] 编译 (hooks / CLI 需要 dist/)"
npm run build

echo "==> [3/5] 链接 CLI 到 PATH (npm link)"
npm link

echo "==> [4/5] 安装 / 刷新 dashboard（tmux 多行状态条 + grok wrapper）"
node bin/grok-build-hud.js --install-dashboard
node bin/grok-build-hud.js --theme auto
# Phase D: do not stomp user aesthetic/preset on reinstall
if [[ "$HAS_USER_CFG" -eq 0 ]]; then
  echo "    first install: apply preset full"
  node bin/grok-build-hud.js --preset full
else
  echo "    keep existing config: $HUD_CFG"
  # ensure daemon picks up new binary
  node bin/grok-build-hud.js --dashboard-start >/dev/null 2>&1 || true
fi

echo "==> [5/5] 注册为本地 Grok 插件（第三方 / 非官方 marketplace）"
if command -v grok >/dev/null 2>&1; then
  # Prefer enable after install; re-run is ok for updates
  # Use absolute path (no trailing /.) so installed-plugins id stays stable
  if grok plugin install "$ROOT" --trust 2>&1; then
    grok plugin enable grok-build-hud 2>/dev/null || true
    echo "    插件已安装: grok-build-hud"
    if grok plugin validate "$ROOT" >/dev/null 2>&1; then
      echo "    plugin validate: ok"
    else
      echo "    warn: plugin validate 未通过（可稍后手动: grok plugin validate \"$ROOT\"）" >&2
    fi
  else
    echo "    warn: grok plugin install 失败 — 可稍后手动:" >&2
    echo "      grok plugin install \"$ROOT\" --trust && grok plugin enable grok-build-hud" >&2
  fi
else
  echo "    warn: 未找到 grok CLI，跳过插件注册" >&2
  echo "    安装 Grok Build 后执行:" >&2
  echo "      grok plugin install \"$ROOT\" --trust && grok plugin enable grok-build-hud" >&2
fi

echo ""
VER="$(node -e "import('node:fs').then(fs=>console.log(JSON.parse(fs.readFileSync('package.json','utf8')).version))" 2>/dev/null || echo "?")"
echo "完成。grok-build-hud v${VER}（第三方插件 + 同窗口 HUD，非 xAI 官方）"
echo ""
echo "  启动 Grok + 底部 HUD：  grok"
echo "  看当前状态一次：        grok-hud status"
echo "  设定（语言/美学/芯片）： grok-hud settings"
echo "  当前配置摘要：          grok-hud info"
echo "  本机自检：              grok-hud doctor"
echo "  自愈：                  grok-hud doctor --fix"
echo "  非交互配置：            grok-hud set aesthetic=codex"
echo "  会话斜杠命令：          /hud /status /settings /setup …"
echo "  主题跟随 Grok：         grok-build-hud --theme auto"
echo "  停止后台刷新：          grok-hud stop"
echo "  插件详情：              grok plugin details grok-build-hud"
echo ""
if [[ "$HAS_USER_CFG" -eq 1 ]]; then
  echo "  提示：已有 config 未强制改 preset；美学/可选芯片用 grok-hud settings"
fi
echo "若 hooks 未生效：在 Grok 内 /hooks 后按 r 重载"
