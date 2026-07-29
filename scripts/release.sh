#!/usr/bin/env bash
# Release helper for grok-build-hud
# Usage:
#   bash scripts/release.sh 1.1.0           # bump + test + commit (no push)
#   bash scripts/release.sh 1.1.0 --push    # also dual-push gitea+github
#   bash scripts/release.sh patch|--minor|--major [--push]
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

PUSH=0
ARG="${1:-}"
if [[ -z "$ARG" ]]; then
  echo "usage: bash scripts/release.sh <version|patch|minor|major> [--push]" >&2
  exit 1
fi
shift || true
for a in "$@"; do
  if [[ "$a" == "--push" ]]; then PUSH=1; fi
done

CUR="$(node -p "require('./package.json').version")"
bump_semver() {
  local kind="$1" major minor patch
  IFS=. read -r major minor patch <<<"$CUR"
  case "$kind" in
    major) echo "$((major + 1)).0.0" ;;
    minor) echo "${major}.$((minor + 1)).0" ;;
    patch) echo "${major}.${minor}.$((patch + 1))" ;;
    *) echo "$kind" ;;
  esac
}

NEW="$(bump_semver "$ARG")"
if [[ ! "$NEW" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "error: invalid version '$NEW'" >&2
  exit 1
fi

echo "==> release $CUR → $NEW"

# 1) bump package.json + plugin.json
node -e "
const fs=require('fs');
const v=process.argv[1];
for (const f of ['package.json','plugin.json']) {
  const j=JSON.parse(fs.readFileSync(f,'utf8'));
  j.version=v;
  fs.writeFileSync(f, JSON.stringify(j,null,2)+'\n');
  console.log('  ', f, '→', v);
}
" "$NEW"

# 2) ensure CHANGELOG has heading (prepend if missing)
if ! grep -q "^## ${NEW}$" CHANGELOG.md 2>/dev/null; then
  tmp="$(mktemp)"
  {
    echo "# Changelog"
    echo ""
    echo "## ${NEW}"
    echo ""
    echo "### Release"
    echo "- Version bump to ${NEW}."
    echo ""
    # drop first line if it was # Changelog
    tail -n +2 CHANGELOG.md | sed '1{/^$/d;}' 
  } >"$tmp"
  # If original started with # Changelog, rebuild cleaner
  {
    echo "# Changelog"
    echo ""
    echo "## ${NEW}"
    echo ""
    echo "### Release"
    echo "- Version bump to ${NEW} (scripts/release.sh)."
    echo ""
    awk 'BEGIN{skip=1} /^# Changelog/{next} {print}' CHANGELOG.md
  } >"$tmp"
  mv "$tmp" CHANGELOG.md
  echo "  CHANGELOG.md: added ## ${NEW}"
fi

# 3) test
echo "==> npm test"
npm test

# 4) commit
git add package.json plugin.json CHANGELOG.md
# include any other dirty if release-only — keep scoped
if git diff --cached --quiet; then
  echo "nothing to commit (version already ${NEW}?)"
else
  git commit -m "Release v${NEW}"
fi

echo "==> v${NEW} ready (commit on main)"
if [[ "$PUSH" -eq 1 ]]; then
  echo "==> push gitea + github"
  git push gitea main
  git push github main
  echo "pushed v${NEW}"
else
  echo "not pushed (pass --push to dual-push remotes)"
fi
