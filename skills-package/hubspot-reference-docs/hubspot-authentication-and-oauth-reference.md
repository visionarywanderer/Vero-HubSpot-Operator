# HubSpot Authentication & OAuth (Skill Companion)

HubSpot supports three authentication methods: OAuth 2.0, private app access tokens, and (deprecated) API keys. For any new integration, use OAuth for multi-account distribution and private apps for single-account use. API keys were sunset on November 30, 2022.

## Authentication Methods at a Glance

| Method | Use Case | Token Type | Status |
|--------|----------|------------|--------|
| OAuth 2.0 | Multi-account / Marketplace | Bearer access token (expires) | **Recommended** |
| Private App | Single-account | Static access token (permanent) | **Recommended** |
| API Key (`hapikey`) | — | Query parameter | **Deprecated Nov 2022** |
| Developer API Key | Dev-portal operations (webhooks config) | Query parameter (`hapikey`) | Active (dev-only) |
| Client Credentials | App-level operations (webhook journal) | Short-lived OAuth token | Active (limited use) |

## OAuth 2.0 Flow

### Step 1: Build Authorization URL

```
https://app.hubspot.com/oauth/authorize
  ?client_id=YOUR_CLIENT_ID
  &scope=crm.objects.contacts.read%20crm.objects.contacts.write
  &redirect_uri=https://yourapp.com/oauth-callback
  &optional_scope=automation
  &state=random_csrf_token
```

**Target a specific portal:**
```
https://app.hubspot.com/oauth/{portalId}/authorize?...
```

### Step 2: Exchange Code for Tokens

User is redirected to `redirect_uri?code=xxxx`. Exchange the code:

```
POST /oauth/v3/token
Content-Type: application/x-www-form-urlencoded

grant_type=authorization_code
&client_id=YOUR_CLIENT_ID
&client_secret=YOUR_SECRET
&redirect_uri=https://yourapp.com/oauth-callback
&code=xxxx
```

**Response:**
```json
{
  "access_token": "CNHP...",
  "refresh_token": "CJDf...",
  "expires_in": 1800
}
```

### Step 3: Refresh Access Token

```
POST /oauth/v3/token
Content-Type: application/x-www-form-urlencoded

grant_type=refresh_token
&client_id=YOUR_CLIENT_ID
&client_secret=YOUR_SECRET
&refresh_token=CJDf...
```

### Step 4: Use Access Token

```
GET /crm/v3/objects/contacts
Authorization: Bearer CNHP...
```

## OAuth Query Parameters

| Parameter | Required | Description |
|-----------|----------|-------------|
| `client_id` | Yes | App ID from Auth settings |
| `redirect_uri` | Yes | Must match registered URI; HTTPS in production |
| `scope` | Yes | Space-separated required scopes |
| `optional_scope` | No | Scopes that degrade gracefully if unavailable |
| `state` | No | CSRF token / user state preservation |

## Scopes Configuration (app-hsmeta.json)

```json
{
  "auth": {
    "type": "oauth",
    "redirectUrls": ["http://localhost:3000/oauth-callback"],
    "requiredScopes": ["crm.objects.contacts.read", "crm.objects.contacts.write"],
    "optionalScopes": ["automation"],
    "conditionallyRequiredScopes": []
  }
}
```

## Private Apps

- Generate a static access token in HubSpot Settings > Integrations > Private Apps.
- Token is permanent (no refresh needed).
- Scoped to specific permissions, similar to OAuth.
- Use in `Authorization: Bearer` header—never as query parameter.
- Best for single-account, server-side integrations.

## API Key Deprecation Timeline

| Date | Event |
|------|-------|
| June 1, 2022 | Deprecation announced |
| July 15, 2022 | New API key creation blocked |
| November 30, 2022 | API keys no longer supported |

**Migration path:**
- Single-account → Private App (only change is auth method; no other code changes needed)
- Multi-account → OAuth 2.0

## Best Practices

- **Always use HTTPS** for redirect URIs in production (localhost is exempt for dev).
- **Store tokens securely** on your backend—never expose client_secret or refresh_token to the client.
- **Use `optional_scope`** for features that aren't strictly required—prevents install failures.
- **Refresh tokens proactively** before `expires_in` elapses (default 30 minutes).
- **Use `state` parameter** to prevent CSRF attacks in the OAuth flow.
- **Monitor installation logs** via Development > Monitoring > Logs > OAuth tab.
- Your app won't appear as "Connected" in the user's account until you exchange the code for tokens.

## Anti-patterns

- Using deprecated API keys (`hapikey` query parameter) for any new integration.
- Storing access tokens client-side or in frontend code.
- Hardcoding scopes instead of configuring them in `app-hsmeta.json`.
- Ignoring `optional_scope`—requiring scopes the user's tier doesn't support blocks installation.
- Not handling token refresh—access tokens expire after ~30 minutes.

## Key Notes

- **Access tokens expire** in ~1800 seconds (30 minutes). Always implement refresh logic.
- **Refresh tokens do not expire** but become invalid if the user disconnects your app.
- **Scopes reflect the app's permissions**, not the installing user's HubSpot role.
- **Developer API Keys** (for webhook configuration, etc.) remain active—only user-level API keys were sunset.
- **Super Admin or Marketplace Access** permission required for users installing OAuth apps.
- OAuth events are logged: `AUTHORIZATION_REQUEST`, `AUTHORIZATION_GRANT`, `AUTHORIZATION_CODE_EXPIRY`, `TOKEN_EXCHANGE`.
