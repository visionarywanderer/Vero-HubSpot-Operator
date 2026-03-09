#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "[hubspot] Checking CLI"
if ! command -v hs >/dev/null 2>&1; then
  echo "[hubspot] HubSpot CLI not found. Install with: npm i -g @hubspot/cli"
  exit 1
fi

hs --version

echo "[hubspot] Current authenticated accounts"
hs account list || true

echo ""
echo "[hubspot] If needed, authenticate account in browser:"
echo "  hs account auth"
echo ""
echo "[hubspot] Create a HubSpot project scaffold (interactive):"
echo "  hs project create --name vero-hubspot-operator --dest ./hubspot-project"
echo ""
echo "[hubspot] Edit project metadata (current projects format):"
echo "  # file: ./hubspot-project/src/app/public-app.json"
echo "  # set allowedUrls[0] = https://<your-domain>"
echo "  # set auth.redirectUrls[0] = https://<your-domain>/api/portals/callback"
echo ""
echo "[hubspot] Upload/deploy from project dir (interactive account choice if needed):"
echo "  cd ./hubspot-project"
echo "  hs project upload"
echo "  hs project deploy"
echo ""
echo "[hubspot] In HubSpot Developer UI copy OAuth credentials and set app env vars:"
echo "  HUBSPOT_OAUTH_CLIENT_ID"
echo "  HUBSPOT_OAUTH_CLIENT_SECRET"
echo "  HUBSPOT_OAUTH_REDIRECT_URI=https://<your-domain>/api/portals/callback"
