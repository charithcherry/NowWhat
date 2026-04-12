#!/usr/bin/env bash
# Start all WellBeing Next.js apps. From repo root: ./scripts/dev-all.sh
# Ctrl+C stops every child process.

set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT" || exit 1

PIDS=()
cleanup() {
  echo ""
  echo "Stopping servers..."
  for p in "${PIDS[@]}"; do
    kill "$p" 2>/dev/null || true
  done
  exit 0
}
trap cleanup INT TERM

run() {
  local name="$1" dir="$2"
  echo "Starting $name (cd $dir)..."
  (cd "$ROOT/$dir" && npm run dev) &
  PIDS+=($!)
}

run "base" "base"
run "skin-hair-analysis" "skin-hair-analysis"
run "nutrition-wellness" "nutrition-wellness"
run "nutrition-yelp" "nutrition-yelp"
run "fitness-dashboard" "fitness-dashboard"
run "community" "community"

echo ""
echo "All started. Ports: 3000 3002 3003 3004 3005 3006"
echo "Open: http://localhost:3000  — Community (via proxy): http://localhost:3000/community"
echo "Or Community direct: http://localhost:3006/community"
echo "Press Ctrl+C to stop all."
wait
