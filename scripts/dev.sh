#!/usr/bin/env bash
#
# QuotePilot dev launcher — runnable from a clean checkout in < 2 minutes.
# Starts: API (:3001), web app (:5173), analytics dashboard (:5174).
# Logs:   /tmp/quotepilot-api.log, /tmp/quotepilot-web.log, /tmp/quotepilot-dashboard.log
# Ctrl+C stops everything it started.
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

API_PORT=3001
WEB_PORT=5173
DASH_PORT=5174
PID_FILE="/tmp/quotepilot.pids"

# ——— prerequisites ———
command -v node >/dev/null 2>&1 || { echo "ERROR: node is not installed (need >= 18)." >&2; exit 1; }
command -v npm  >/dev/null 2>&1 || { echo "ERROR: npm is not installed." >&2; exit 1; }
echo "node $(node -v) · npm $(npm -v)"

# ——— install (only if missing) ———
if [ ! -d "node_modules" ]; then
  echo "Installing workspace dependencies (first run)…"
  npm install --workspaces --no-audit --no-fund
else
  echo "node_modules present — skipping install."
fi

# ——— helpers ———
rm -f "$PID_FILE"

has_dev_script() {
  node -e "const p=require('./$1/package.json'); process.exit(p.scripts && p.scripts.dev ? 0 : 1);" 2>/dev/null
}

port_in_use() {
  (command -v ss >/dev/null 2>&1 && ss -ltn "sport = :$1" 2>/dev/null | grep -q LISTEN) || \
  (command -v lsof >/dev/null 2>&1 && lsof -ti ":$1" >/dev/null 2>&1)
}

start_app() {
  local dir="$1" label="$2" port="$3"
  if [ ! -f "$dir/package.json" ]; then
    echo "[skip] $label — no package.json in $dir (track not landed yet?)"
    return 0
  fi
  if ! has_dev_script "$dir"; then
    echo "[skip] $label — no 'dev' script in $dir/package.json"
    return 0
  fi
  if port_in_use "$port"; then
    echo "[skip] $label — port $port already in use (is it already running?)"
    return 0
  fi
  local log="/tmp/quotepilot-${label}.log"
  (cd "$dir" && npm run dev > "$log" 2>&1 & echo $! >> "$PID_FILE")
  echo "[ok] $label starting on :$port (log: $log)"
}

cleanup() {
  echo ""
  echo "Stopping QuotePilot…"
  if [ -f "$PID_FILE" ]; then
    while read -r pid; do
      kill "$pid" 2>/dev/null || true
    done < "$PID_FILE"
    rm -f "$PID_FILE"
  fi
  # belt & suspenders: kill anything we launched by log-tail pattern is overkill;
  # PIDs above cover it. Give children a moment to exit.
  sleep 1
  echo "Stopped."
}
trap cleanup EXIT INT TERM

# ——— launch ———
start_app "apps/api"           "api"       "$API_PORT"
start_app "apps/web"           "web"       "$WEB_PORT"
start_app "analytics/dashboard" "dashboard" "$DASH_PORT"

# ——— health-check the API (~15s of retries) ———
echo ""
echo "Waiting for API health (http://localhost:${API_PORT}/api/health)…"
healthy=0
for i in $(seq 1 15); do
  if curl -sf "http://localhost:${API_PORT}/api/health" >/dev/null 2>&1; then
    healthy=1
    break
  fi
  sleep 1
done

echo ""
if [ "$healthy" -eq 1 ]; then
  echo "API is healthy."
else
  echo "WARNING: API did not become healthy within 15s — check /tmp/quotepilot-api.log"
fi

echo ""
echo "QuotePilot is running:"
echo "  Web app:             http://localhost:${WEB_PORT}"
echo "  API:                 http://localhost:${API_PORT}"
echo "  Analytics dashboard: http://localhost:${DASH_PORT}"
echo ""
echo "Logs: /tmp/quotepilot-{api,web,dashboard}.log"
echo "Press Ctrl+C to stop all three."
echo ""

# Keep the trap alive until the user quits.
wait
