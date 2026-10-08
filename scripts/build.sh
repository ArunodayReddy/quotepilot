#!/usr/bin/env bash
#
# QuotePilot build — builds in dependency order: shared → api → web → dashboard.
# Fails fast on the first broken workspace.
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

build_ws() {
  local dir="$1"
  if [ ! -f "$dir/package.json" ]; then
    echo "[skip] $dir — no package.json"
    return 0
  fi
  if ! node -e "const p=require('./$1/package.json'); process.exit(p.scripts && p.scripts.build ? 0 : 1);" 2>/dev/null; then
    echo "[skip] $dir — no 'build' script"
    return 0
  fi
  echo "━━━ building $dir ━━━"
  (cd "$dir" && npm run build)
  echo "[ok] $dir built"
}

# dependency order matters: shared types first, then consumers
build_ws "packages/shared"
build_ws "apps/api"
build_ws "apps/web"
build_ws "analytics/dashboard"

echo ""
echo "All workspaces built successfully."
