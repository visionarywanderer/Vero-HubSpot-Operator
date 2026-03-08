#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1:3000}"
health_file="/tmp/vero_smoke_health.json"
portals_file="/tmp/vero_smoke_portals.json"

echo "[smoke] Checking /api/health"
health_code=$(curl -sS -o "$health_file" -w "%{http_code}" "$BASE_URL/api/health")
if [[ "$health_code" != "200" ]]; then
  echo "[smoke] FAIL /api/health http=$health_code"
  cat "$health_file" || true
  exit 1
fi

echo "[smoke] Checking /api/portals unauthorized JSON"
portals_code=$(curl -sS -o "$portals_file" -w "%{http_code}" "$BASE_URL/api/portals")
if [[ "$portals_code" != "401" ]]; then
  echo "[smoke] FAIL /api/portals expected 401 got $portals_code"
  cat "$portals_file" || true
  exit 1
fi

if command -v jq >/dev/null 2>&1; then
  jq -e '.error != null' "$portals_file" >/dev/null
fi

echo "[smoke] PASS"
