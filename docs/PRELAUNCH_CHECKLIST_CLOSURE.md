# Pre-Launch Checklist Closure (2026-03-08)

## Infrastructure
- [x] SQLite storage layer implemented via `better-sqlite3`.
- [x] `DATABASE_PATH` support added (`/data/vero.db` recommended in Render).
- [x] Health endpoint verifies DB connectivity (`/api/health`).
- [ ] Render persistent disk mounted at `/data` (manual Render config).
- [ ] Render Starter+ plan enabled for no cold-sleep (manual Render config).

## Security
- [x] Token encryption at rest for HubSpot tokens (`AES-256-GCM`, `ENCRYPTION_KEY`).
- [x] API auth middleware returns JSON `401` for `/api/*` unauthenticated requests.
- [x] CSRF origin checks enforced for mutation API routes in middleware.
- [x] Google login restricted to `@verodigital.co` domain.
- [x] Optional allowlist now DB-backed via Settings Users tab.

## Auth and Portals
- [x] HubSpot OAuth connect endpoint implemented.
- [x] HubSpot OAuth callback route implemented (`/api/portals/callback`).
- [x] Portal disconnect route attempts HubSpot uninstall API before local removal.
- [x] Global server-side active portal coupling removed from frontend state.
- [x] Portal selection persisted client-side (`localStorage`) and passed explicitly.

## Data Persistence Migration
- [x] Portals moved to SQLite (`portals` table).
- [x] Change logs moved to SQLite (`change_log` table).
- [x] Portal configs moved to SQLite (`portal_config` table).
- [x] Artifacts moved to SQLite (`artifacts` table).
- [x] Users moved to SQLite (`users` table).
- [x] App settings moved to SQLite (`app_settings` table).

## Runtime Validation
- [x] `npm run lint` passes.
- [x] `npm run build` passes.
- [x] `npm run typecheck` passes (run after build artifact generation).

## Manual Go-Live Checks (still required)
- [ ] Set Render env vars:
  - `NEXTAUTH_URL`, `NEXTAUTH_SECRET`
  - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
  - `ALLOWED_GOOGLE_DOMAIN=verodigital.co`
  - `HUBSPOT_OAUTH_CLIENT_ID`, `HUBSPOT_OAUTH_CLIENT_SECRET`, `HUBSPOT_OAUTH_REDIRECT_URI`
  - `ANTHROPIC_API_KEY`
  - `ENCRYPTION_KEY`
  - `DATABASE_PATH=/data/vero.db`
- [ ] Confirm HubSpot OAuth redirect URL matches production URL exactly.
- [ ] Confirm Google OAuth redirect URL matches production URL exactly.
- [ ] End-to-end smoke test in production:
  - Google login allowed/rejected correctly.
  - Portal OAuth connect/disconnect flow.
  - Streaming chat prompt against selected portal.
  - High-risk ID confirmation path.
  - Activity log write + CSV export.
  - Settings persistence across refresh.
