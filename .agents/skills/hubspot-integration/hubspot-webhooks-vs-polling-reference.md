# HubSpot Webhooks vs Polling (Skill Companion)

Choosing between webhooks and polling determines how your integration receives data from HubSpot. Webhooks are event-driven (HubSpot pushes to you); polling is schedule-driven (you pull from HubSpot). Most production integrations use a combination of both.

## When to Use Each

| Factor | Webhooks | Polling |
|--------|----------|---------|
| Latency requirement | Near real-time | Minutes to hours is acceptable |
| Update frequency | Infrequent to moderate | Very frequent (thousands/min) |
| Data completeness | Event-specific fields only | Full record access |
| API cost | Free (doesn't count against limits) | Consumes rate limit quota |
| Reliability | At-least-once (may duplicate) | Deterministic (you control) |
| Email events | **Not supported** | Required (use Events API) |
| Setup complexity | Moderate (HTTPS endpoint, verification) | Low (cron + API call) |

## HubSpot Webhooks v3

### Endpoints

| Method | Path | Summary |
|--------|------|---------|
| GET | `/webhooks/v3/{appId}/settings` | Get webhook target URL & throttling |
| PUT | `/webhooks/v3/{appId}/settings` | Set target URL & concurrency |
| GET | `/webhooks/v3/{appId}/subscriptions` | List subscriptions |
| POST | `/webhooks/v3/{appId}/subscriptions` | Create subscription |
| PUT | `/webhooks/v3/{appId}/subscriptions/{id}` | Activate/pause subscription |
| DELETE | `/webhooks/v3/{appId}/subscriptions/{id}` | Delete subscription |

**Auth:** Developer API key via `?hapikey` query param.

### Supported Event Types

| Object | Events |
|--------|--------|
| Contact | `creation`, `deletion`, `merge`, `associationChange`, `restore`, `propertyChange`, `privacyDeletion` |
| Company | `creation`, `deletion`, `merge`, `associationChange`, `restore`, `propertyChange` |
| Deal | `creation`, `deletion`, `merge`, `associationChange`, `restore`, `propertyChange` |
| Ticket | `creation`, `deletion`, `merge`, `associationChange`, `restore`, `propertyChange` |
| Product | `creation`, `deletion`, `propertyChange` |
| Line Item | `creation`, `deletion`, `propertyChange` |
| Conversation (beta) | `creation`, `deletion`, `propertyChange`, `newMessage`, `privacyDeletion` |

**NOT supported:** Email events (opens, clicks, bounces, deliveries). Use the Events/Email Analytics API with polling instead.

### Webhook Payload Example

```json
{
  "objectId": 1246965,
  "propertyName": "lifecyclestage",
  "propertyValue": "subscriber",
  "changeSource": "ACADEMY",
  "eventId": 3816279340,
  "subscriptionId": 25,
  "portalId": 33,
  "appId": 1160452,
  "occurredAt": 1462216307945,
  "eventType": "contact.propertyChange",
  "attemptNumber": 0
}
```

### Signature Verification

Validate `X-HubSpot-Signature` header:
```
SHA-256(app_secret + raw_request_body) == X-HubSpot-Signature
```

### Retry Behavior

- Retries on: connection failure, timeout (>5s), 4xx/5xx responses
- Up to 10 retries over 24 hours with randomized delays
- `attemptNumber` field tracks retry count

### Throttling & Batching

- Target URL must be HTTPS
- Concurrency: min 5, default 10 simultaneous requests
- Up to 100 events per batch delivery
- Settings cached up to 5 minutes after changes

## Polling Approach

When webhooks aren't suitable, poll using:

1. **CRM Search API** — Filter by `lastmodifieddate` for changed records
2. **Events/Email Analytics API** — Required for email engagement data
3. **List memberships** — Poll for list changes

### Polling Pattern

```
GET /crm/v3/objects/contacts?properties=email,lifecyclestage
  &filterGroups[0][filters][0][propertyName]=lastmodifieddate
  &filterGroups[0][filters][0][operator]=GTE
  &filterGroups[0][filters][0][value]={last_poll_timestamp}
```

## Best Practices

- **Use webhooks as the primary channel** for CRM object changes—they're free and near real-time.
- **Use polling as a fallback** to catch any events missed by webhooks (reconciliation pass).
- **Always verify webhook signatures** to prevent spoofed payloads.
- **Handle duplicates** — HubSpot may send the same event more than once.
- **Sort by `occurredAt`** — Events may arrive out of order; never assume delivery order.
- **Respond within 5 seconds** — Webhook timeout triggers retries. Queue internally and process async.
- **Use polling for email events** — Webhooks don't cover opens, clicks, bounces, or deliveries.
- **Monitor `attemptNumber`** — High retry counts indicate your endpoint is struggling.

## Anti-patterns

- Relying solely on webhooks without a polling reconciliation pass.
- Processing webhook payloads synchronously and exceeding the 5-second timeout.
- Polling every 30 seconds when data changes infrequently—wastes rate limit budget.
- Ignoring `occurredAt` and assuming events arrive in order.
- Not implementing idempotent event handling (duplicates will arrive).
- Using webhooks for email engagement data (not supported; must poll).
- Setting up webhook subscriptions for properties that don't exist in the target account (silently fails).

## Key Notes

- **Webhook calls are free** — They do not count against your API rate limits.
- **Max 1,000 subscriptions** per app.
- **Private apps:** Webhook settings can only be configured in the HubSpot UI, not via API.
- **Association change events** fire twice for bidirectional relationships (once per direction).
- **Unavailable for webhook tracking:** `num_unique_conversion_events`, `hs_lastmodifieddate`.
- **Required scopes:** Match the object type (e.g., `crm.objects.contacts.read` for contact events).
- **Hybrid approach is best:** Webhooks for real-time + periodic polling for reconciliation.
