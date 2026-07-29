#!/usr/bin/env bash
# Release helper for grok-build-hud
# Usage:
#   bash scripts/release.sh 1.2.0                 # bump + test + commit
#   bash scripts/release.sh minor --push          # dual-push main
#   bash scripts/release.sh patch --push --tag    # push + annotated tag vX.Y.Z
#   bash scripts/release.sh patch|--minor|--major [--push] [--tag]
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

PUSH=0
TAG=0
ARG="${1:-}"
if [[ -z "$ARG" ]]; then
  echo "usage: bash scripts/release.sh <version|patch|minor|major> [--push] [--tag]" >&2
  exit 1
fi
shift || true
for a in "$@"; do
  case "$a" in
    --push) PUSH=1 ;;
    --tag) TAG=1 ;;
  esac
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

# 2) ensure CHANGELOG has heading
if ! grep -q "^## ${NEW}$" CHANGELOG.md 2>/dev/null; then
  tmp="$(mktemp)"
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
if git diff --cached --quiet; then
  echo "nothing to commit (version already ${NEW}?)"
else
  git commit -m "Release v${NEW}"
fi

# 5) annotated tag (local)
if [[ "$TAG" -eq 1 ]]; then
  if git rev-parse "v${NEW}" >/dev/null 2>&1; then
    echo "  tag v${NEW} already exists"
  else
    git tag -a "v${NEW}" -m "grok-build-hud v${NEW}"
    echo "  tagged v${NEW}"
  fi
fi

echo "==> v${NEW} ready (commit on main${TAG:+, tag v${NEW}})"
if [[ "$PUSH" -eq 1 ]]; then
  echo "==> push gitea + github (main${TAG:+ + tags})"
  git push gitea main
  git push github main
  if [[ "$TAG" -eq 1 ]]; then
    git push gitea "v${NEW}" || git push gitea --tags
    git push github "v${NEW}" || git push github --tags
  fi
  echo "pushed v${NEW}"
else
  echo "not pushed (pass --push; add --tag for annotated tag)"
fi
