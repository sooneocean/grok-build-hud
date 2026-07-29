#!/usr/bin/env bash
# Quick post-install / post-upgrade smoke (no network required for most steps)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

ENTRY="$ROOT/dist/src/index.js"

echo "==> grok-build-hud smoke"
if [[ ! -f "$ENTRY" ]]; then
  echo "building…"
  npm run build
fi

run_hud() {
  echo "→ node dist/src/index.js $*"
  node "$ENTRY" "$@"
}

run_hud --version
run_hud --info | head -20
run_hud doctor || true
run_hud get aesthetic || true
run_hud get --keys | head -8

echo "==> smoke OK (doctor may warn if no live session)"
