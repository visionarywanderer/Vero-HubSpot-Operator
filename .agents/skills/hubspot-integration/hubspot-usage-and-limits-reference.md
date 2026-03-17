# HubSpot Usage & Rate Limits (Skill Companion)

Understanding HubSpot's rate limits is critical for building reliable integrations. Limits apply at both burst (per-10-seconds) and daily levels, and vary by subscription tier and app type.

## Rate Limit Tiers

### Public OAuth Apps (Marketplace)

| Metric | Limit |
|--------|-------|
| Burst | 110 requests / 10 seconds / installed account |
| Daily | No separate daily cap documented |
| API limit add-on | **Not applicable** |

### Private Apps

| Tier | Burst (per app) | Daily (per account, shared across apps) |
|------|-----------------|----------------------------------------|
| Free / Starter | 100 / 10s | 250,000 |
| Professional | 190 / 10s | 625,000 |
| Enterprise | 190 / 10s | 1,000,000 |

### With API Limit Increase Add-on

| Metric | Value |
|--------|-------|
| Burst | 250 / 10s per app |
| Daily | +1,000,000 per purchase (max 2 purchases) |

### Association-Specific Caps

| Tier | Burst | Daily |
|------|-------|-------|
| Free/Starter | 100 / 10s | 500,000 (hard cap) |
| Pro/Enterprise | 150 / 10s | 500,000 (hard cap) |
| With add-on | 150 / 10s (capped) | 500,000 (capped) |

**Note:** Association daily limits are capped at 500,000 even with the add-on.

## Other Resource Limits

| Resource | Limit |
|----------|-------|
| Webhook subscriptions per app | 1,000 |
| CRM extension settings per public app | 25 |
| Custom event definitions per account | 500 |
| Custom event completions per month | 30 million |
| Custom event send endpoint | 1,250 req/s |
| Custom event batch size | 500 events |
| Timeline event types per public app | 750 |
| Timeline properties per event type | 500 |
| Timeline event max size | 1 MB |
| Legacy public apps per dev account | 100 |
| Legacy private apps per account | 20 |
| Batch CRM operations | 100 records per call |
| Batch associations (v4) | 2,000 inputs (create/delete), 1,000 (read) |
| CRM list results per page | 100 max |

## How Limits Work

- **Burst limits** apply independently per app.
- **Daily limits** are shared across ALL apps within a single HubSpot account.
- **Daily reset** occurs at midnight in the account's configured timezone.
- **429 status code** is returned when limits are exceeded.
- **Webhook deliveries** from HubSpot to your endpoint do NOT count against your rate limit.

## Best Practices

- **Cache aggressively.** If your site loads HubSpot data on every page view, cache it locally rather than hitting the API each time.
- **Use batch endpoints.** One batch call with 100 records uses 1 API request, not 100.
- **Leverage webhooks** for event-driven data instead of polling—webhook calls don't count against limits.
- **Throttle requests.** Implement client-side rate limiting to stay under burst thresholds.
- **Monitor usage.** Check `Development > Monitoring > API call usage` in HubSpot to track consumption across apps.
- **Request only needed properties.** Smaller payloads = faster responses = fewer timeout retries.
- **Use `after` cursor pagination** rather than offset-based pagination for large result sets.

## Anti-patterns

- Polling the API on every page load instead of caching.
- Ignoring 429 responses and retrying immediately (use exponential backoff).
- Making single-record API calls in a loop when batch endpoints exist.
- Running multiple apps against the same account without coordinating daily limits.
- Fetching all properties when you only need a few.
- Using aggressive polling intervals when webhooks would serve the same purpose.

## Key Notes

- **Error budget:** For Marketplace certification, your error rate must stay below 5% of total daily requests.
- **No CRM Search API rate limit sharing:** CRM Search requests are excluded from the general burst limit for public OAuth apps.
- **Webhook-triggered workflow calls** are free—they bypass rate limits entirely.
- **Association requests** have their own burst and daily caps, separate from (and sometimes lower than) general API limits.
