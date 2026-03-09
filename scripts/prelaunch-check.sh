#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "[prelaunch] Running static checks"
npm run lint
npm run build
npm run typecheck

echo "[prelaunch] Verifying required runtime env vars"
required_vars=(
  HUBSPOT_OAUTH_CLIENT_ID
  HUBSPOT_OAUTH_CLIENT_SECRET
  HUBSPOT_OAUTH_REDIRECT_URI
  ANTHROPIC_API_KEY
  NEXTAUTH_SECRET
  NEXTAUTH_URL
  GOOGLE_CLIENT_ID
  GOOGLE_CLIENT_SECRET
  ENCRYPTION_KEY
  ALLOWED_GOOGLE_DOMAIN
)

missing=0
for var in "${required_vars[@]}"; do
  if [[ -z "${!var:-}" ]]; then
    echo "[prelaunch] MISSING: $var"
    missing=1
  fi
done

if [[ "$missing" -ne 0 ]]; then
  echo "[prelaunch] FAIL: missing required env vars"
  exit 1
fi

if [[ ${#ENCRYPTION_KEY} -ne 64 ]]; then
  echo "[prelaunch] FAIL: ENCRYPTION_KEY must be 64 hex chars (32 bytes)"
  exit 1
fi

echo "[prelaunch] PASS: static checks and env validation complete"
