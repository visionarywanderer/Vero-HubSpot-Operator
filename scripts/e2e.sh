#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1:3000}"
TMP_DIR="/tmp/vero_e2e"
mkdir -p "$TMP_DIR"

health_file="$TMP_DIR/health.json"
portals_file="$TMP_DIR/portals.json"
chat_unauth_file="$TMP_DIR/chat_unauth.txt"
chat_auth_file="$TMP_DIR/chat_auth.txt"

echo "[e2e] health check"
health_code=$(curl -sS -o "$health_file" -w "%{http_code}" "$BASE_URL/api/health")
[[ "$health_code" == "200" ]] || { echo "[e2e] FAIL health=$health_code"; cat "$health_file"; exit 1; }

echo "[e2e] unauthorized portals check"
portals_code=$(curl -sS -o "$portals_file" -w "%{http_code}" "$BASE_URL/api/portals")
[[ "$portals_code" == "401" ]] || { echo "[e2e] FAIL portals=$portals_code"; cat "$portals_file"; exit 1; }
if command -v jq >/dev/null 2>&1; then
  jq -e '.error != null' "$portals_file" >/dev/null
fi

echo "[e2e] unauthorized chat check"
chat_code=$(curl -sS -o "$chat_unauth_file" -w "%{http_code}" \
  -H 'Content-Type: application/json' \
  -d '{"prompt":"test","portalId":"123"}' \
  "$BASE_URL/api/chat")
[[ "$chat_code" == "401" ]] || { echo "[e2e] FAIL chat unauthorized code=$chat_code"; cat "$chat_unauth_file"; exit 1; }
grep -Eq '("type":"error"|"error":"Unauthorized")' "$chat_unauth_file"

if [[ -n "${SESSION_COOKIE:-}" ]]; then
  echo "[e2e] authenticated chat SSE check"
  auth_code=$(curl -sS -o "$chat_auth_file" -w "%{http_code}" \
    -H 'Content-Type: application/json' \
    -H "Cookie: $SESSION_COOKIE" \
    -d '{"prompt":"status","portalId":"123","autoExecute":false}' \
    "$BASE_URL/api/chat")
  [[ "$auth_code" == "200" ]] || { echo "[e2e] FAIL auth chat code=$auth_code"; cat "$chat_auth_file"; exit 1; }
  grep -q '^data: ' "$chat_auth_file"
fi

echo "[e2e] PASS"
