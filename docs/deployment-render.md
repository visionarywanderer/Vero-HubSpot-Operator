# Render Deployment Checklist (Cold Start Accepted)

## 1) Create Render Web Service

- Provider: GitHub
- Repo: `vero-hubspot-operator`
- Runtime: Node
- Plan: Free
- Build command: `npm ci && npm run build`
- Start command: `npm start`
- Health check path: `/api/health`

## 2) Required environment variables

- `NEXTAUTH_URL`
- `NEXTAUTH_SECRET`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `ALLOWED_GOOGLE_DOMAIN` (`verodigital.co`)
- `ENCRYPTION_KEY`
- `ANTHROPIC_API_KEY`
- `HUBSPOT_TOKEN` (optional, single-portal fallback)
- `NODE_ENV` (`production`)
- `PORT` (`10000`)

## 3) OAuth redirect values

- Google callback: `https://YOUR_RENDER_DOMAIN/api/auth/callback/google`

## 4) Security hardening on Render

- Keep service repo private and env vars private
- Enable branch protection + required CI checks in GitHub
- Restrict app access to `@verodigital.co` users only (enforced in app)
- Store multi-portal tokens encrypted in `~/.vero/portals.enc` (outside repo)
- Rotate `NEXTAUTH_SECRET`, `ENCRYPTION_KEY`, and OAuth credentials every 90 days

## 5) Cold start notes

- Render Free sleeps after inactivity; wake-up latency is expected
- If this impacts operations, move to paid always-on instance
