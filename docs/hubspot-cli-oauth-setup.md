# HubSpot CLI + OAuth Setup (Current Project)

This app already expects OAuth env vars:

- `HUBSPOT_OAUTH_CLIENT_ID`
- `HUBSPOT_OAUTH_CLIENT_SECRET`
- `HUBSPOT_OAUTH_REDIRECT_URI`

## 1) Run terminal helper

```bash
./scripts/hubspot-cli-setup.sh
```

## 2) Authenticate HubSpot CLI (browser)

```bash
hs account auth
```

Pick the account where you want to host/manage the HubSpot app.

## 3) Create HubSpot project scaffold

```bash
hs project create --name vero-hubspot-operator --dest ./hubspot-project
```

This is interactive; select the default starter template.

## 4) Add OAuth metadata

Edit `./hubspot-project/src/app/public-app.json`:

- replace `https://YOUR_APP_DOMAIN` in `allowedUrls` with your deployed URL
- replace `https://YOUR_APP_DOMAIN/api/portals/callback` in `auth.redirectUrls`
- keep OAuth scopes in `auth.requiredScopes`

## 5) Upload and deploy in HubSpot

```bash
cd ./hubspot-project
hs project upload
hs project deploy
```

## 6) Copy OAuth client credentials to app env

From HubSpot app details page, copy client id + secret.

Set in Render/GitHub:

- `HUBSPOT_OAUTH_CLIENT_ID=<from hubspot app>`
- `HUBSPOT_OAUTH_CLIENT_SECRET=<from hubspot app>`
- `HUBSPOT_OAUTH_REDIRECT_URI=https://<your-domain>/api/portals/callback`

## 7) Validate in your app

- Open `/portals`
- Click `Connect Portal`
- Complete HubSpot OAuth consent
- Confirm connected portal appears and API calls succeed

## Notes

- `HUBSPOT_TOKEN` is optional fallback for single-portal mode only.
- For production multi-client usage, keep OAuth-only and avoid static tokens.
