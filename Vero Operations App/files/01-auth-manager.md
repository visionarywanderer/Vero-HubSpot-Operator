# 01 — Auth Manager

## Purpose
Securely store and manage HubSpot Private App tokens for multiple client portals. Handle token validation and scope checking.

## Priority: P0 | Dependencies: None

---

## Functionality

### 1. Token Storage
- Store one Private App access token per client portal
- Tokens stored encrypted at rest (use `crypto.createCipheriv` with AES-256-GCM or a vault service)
- Never log tokens or include in error messages
- Support environment variables for single-portal mode: `HUBSPOT_TOKEN`

### 2. Token Validation
On app startup and before first API call per session, validate the token:

```
GET https://api.hubapi.com/crm/v3/objects/contacts?limit=1
Authorization: Bearer {token}
```

If 401 → token invalid, alert user.

### 3. Scope Detection
After validation, detect available scopes:

```
GET https://api.hubapi.com/oauth/v1/access-tokens/{token}
```

Response includes `scopes` array. Store this so the orchestrator knows what operations are available for this portal.

### 4. Portal Registry
Store per-portal config:

```json
{
  "portals": [
    {
      "id": "client-acme",
      "name": "Acme Corp",
      "hubId": "12345678",
      "token": "{encrypted}",
      "scopes": ["crm.objects.contacts.read", "crm.objects.contacts.write", "automation", ...],
      "environment": "production",
      "createdAt": "2026-03-07T00:00:00Z",
      "lastValidated": "2026-03-07T12:00:00Z"
    }
  ]
}
```

### 5. Active Portal Switching
The app operates on one portal at a time. Provide:
- `setActivePortal(portalId)` — switch context
- `getActivePortal()` — return current portal config
- `getToken()` — return decrypted token for current portal

---

## Required HubSpot Private App Scopes (Full Set)

Create the Private App in: **Settings → Integrations → Private Apps**

| Scope | Purpose |
|-------|---------|
| `crm.objects.contacts.read` | Read contacts |
| `crm.objects.contacts.write` | Create/update contacts |
| `crm.objects.companies.read` | Read companies |
| `crm.objects.companies.write` | Create/update companies |
| `crm.objects.deals.read` | Read deals |
| `crm.objects.deals.write` | Create/update deals |
| `crm.objects.custom.read` | Read custom objects |
| `crm.objects.custom.write` | Create/update custom objects |
| `crm.schemas.contacts.read` | Read contact properties/schemas |
| `crm.schemas.contacts.write` | Create/update contact properties |
| `crm.schemas.companies.read` | Read company properties |
| `crm.schemas.companies.write` | Create/update company properties |
| `crm.schemas.deals.read` | Read deal properties |
| `crm.schemas.deals.write` | Create/update deal properties |
| `crm.lists.read` | Read lists |
| `crm.lists.write` | Create/update lists |
| `automation` | Read/create/update/delete workflows |
| `sales-email-read` | Read email engagements |
| `crm.objects.owners.read` | Read owners for assignment |
| `tickets` | Read/write tickets |

**Note**: Not all client portals will have all scopes. The orchestrator must check available scopes before attempting any operation.

---

## Exports

```typescript
interface AuthManager {
  addPortal(config: PortalConfig): Promise<void>;
  removePortal(portalId: string): Promise<void>;
  listPortals(): PortalSummary[];
  setActivePortal(portalId: string): void;
  getActivePortal(): PortalConfig;
  getToken(): string;
  getScopes(): string[];
  hasScope(scope: string): boolean;
  validateToken(): Promise<boolean>;
}
```

---

## Security Rules
- Never expose tokens in logs, errors, or API responses
- Rotate tokens if compromised (manual process — notify user)
- Validate token before every session, not every request (performance)
- Store encrypted tokens in a file outside the repo (e.g., `~/.vero/portals.enc`)
