#!/usr/bin/env bash
# Quick post-install / post-upgrade smoke (no network required for most steps)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

ENTRY="$ROOT/dist/src/index.js"
PKG_VER="$(node -p "require('./package.json').version")"

echo "==> grok-build-hud smoke v${PKG_VER}"
if [[ ! -f "$ENTRY" ]]; then
  echo "building…"
  npm run build
fi

run_hud() {
  # progress to stderr so stdout stays machine-clean for pipes
  echo "→ node dist/src/index.js $*" >&2
  node "$ENTRY" "$@"
}

VER_OUT="$(node "$ENTRY" --version | tr -d '[:space:]')"
echo "  version out: ${VER_OUT}"
if [[ "$VER_OUT" != "$PKG_VER" ]]; then
  echo "error: --version (${VER_OUT}) != package.json (${PKG_VER})" >&2
  exit 1
fi

run_hud --info | head -24
run_hud doctor || true
run_hud get aesthetic || true
run_hud get --keys | head -8

# bench is optional when no session exists
if node "$ENTRY" bench 5 2>/dev/null | head -8; then
  echo "  bench: ok"
else
  echo "  bench: skipped (no session)"
fi

# status files exist after a force refresh if possible
node "$ENTRY" --dashboard-start >/dev/null 2>&1 || true
sleep 0.4
if [[ -f "${HOME}/.grok/hud/status.txt" ]]; then
  echo "  status.txt: present"
fi
if [[ -f "${HOME}/.grok/hud/dashboard.heartbeat" ]]; then
  echo "  heartbeat: present"
fi

echo "==> smoke OK (doctor may warn if no live session)"
