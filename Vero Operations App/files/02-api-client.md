# 02 — HubSpot API Client

## Purpose
A unified HTTP client for all HubSpot REST API calls. Handles authentication, rate limiting, retries, pagination, and error handling.

## Priority: P0 | Dependencies: 01-auth-manager

---

## Functionality

### 1. Base Client

```typescript
interface HubSpotClient {
  get(path: string, params?: object): Promise<ApiResponse>;
  post(path: string, body: object): Promise<ApiResponse>;
  put(path: string, body: object): Promise<ApiResponse>;
  patch(path: string, body: object): Promise<ApiResponse>;
  delete(path: string): Promise<ApiResponse>;
}
```

**Base URL**: `https://api.hubapi.com`

**Headers** (every request):
```
Authorization: Bearer {token from AuthManager}
Content-Type: application/json
```

### 2. Rate Limiting

HubSpot rate limits:
- **Private Apps**: 100 requests per 10 seconds (per account)
- **OAuth Apps**: 100 requests per 10 seconds (per account)
- **Search endpoints**: 4 requests per second per app
- **Batch endpoints**: 10 records per request

Implementation:
- Use a **token bucket** algorithm: 100 tokens, refill 10 per second
- Before each request, check if a token is available
- If not, wait until one is available (do NOT drop the request)
- Track requests in a sliding window of 10 seconds
- On 429 response: pause ALL requests for the `Retry-After` header value (usually 10 seconds), then resume

```typescript
class RateLimiter {
  private tokens: number = 100;
  private lastRefill: number = Date.now();
  
  async acquire(): Promise<void> {
    this.refill();
    if (this.tokens <= 0) {
      const waitMs = Math.ceil((1 / 10) * 1000); // wait for 1 token
      await sleep(waitMs);
      return this.acquire();
    }
    this.tokens--;
  }
  
  private refill() {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    this.tokens = Math.min(100, this.tokens + elapsed * 10);
    this.lastRefill = now;
  }
}
```

### 3. Retry Logic

Retry on these status codes:
- `429` — Rate limited → wait `Retry-After` seconds, retry
- `500`, `502`, `503`, `504` — Server error → exponential backoff, max 3 retries

**Never retry** on:
- `400` — Bad request (fix the request)
- `401` — Unauthorized (token invalid)
- `403` — Forbidden (missing scope)
- `404` — Not found (resource doesn't exist)
- `409` — Conflict (duplicate)

Exponential backoff:
- Retry 1: wait 1s
- Retry 2: wait 2s
- Retry 3: wait 4s
- Then fail with error

### 4. Pagination Helper

Most HubSpot list endpoints use cursor-based pagination.

```typescript
async function* paginate(path: string, params?: object): AsyncGenerator<any[]> {
  let after: string | undefined;
  do {
    const response = await client.get(path, { ...params, after, limit: 100 });
    yield response.results;
    after = response.paging?.next?.after;
  } while (after);
}

// Usage:
for await (const batch of paginate('/crm/v3/objects/contacts', { properties: 'email,firstname' })) {
  // process batch of up to 100 contacts
}
```

### 5. Batch Request Helper

HubSpot batch endpoints accept max 10 records per call.

```typescript
async function batchProcess<T>(
  items: T[],
  processFn: (batch: T[]) => Promise<any>,
  batchSize: number = 10
): Promise<{ successes: any[]; errors: any[] }> {
  const results = { successes: [], errors: [] };
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    try {
      const result = await processFn(batch);
      results.successes.push(...result);
    } catch (err) {
      results.errors.push({ batch: i / batchSize, error: err.message });
    }
  }
  return results;
}
```

### 6. Error Normalization

Wrap all HubSpot errors into a consistent format:

```typescript
interface HubSpotError {
  statusCode: number;
  category: string;       // from HubSpot: VALIDATION_ERROR, RATE_LIMITS, etc.
  message: string;
  correlationId: string;  // HubSpot's request ID for support tickets
  context?: object;       // additional details
}
```

---

## Key Endpoints Reference

| Module | Method | Endpoint | Notes |
|--------|--------|----------|-------|
| CRM Objects | GET | `/crm/v3/objects/{objectType}` | List with pagination |
| CRM Objects | POST | `/crm/v3/objects/{objectType}` | Create single |
| CRM Objects | PATCH | `/crm/v3/objects/{objectType}/{id}` | Update single |
| CRM Objects | DELETE | `/crm/v3/objects/{objectType}/{id}` | Delete single |
| CRM Batch | POST | `/crm/v3/objects/{objectType}/batch/create` | Create up to 10 |
| CRM Batch | POST | `/crm/v3/objects/{objectType}/batch/update` | Update up to 10 |
| CRM Search | POST | `/crm/v3/objects/{objectType}/search` | Filter/sort, max 4 req/s |
| Properties | GET | `/crm/v3/properties/{objectType}` | List all properties |
| Properties | POST | `/crm/v3/properties/{objectType}` | Create property |
| Properties | PATCH | `/crm/v3/properties/{objectType}/{name}` | Update property |
| Associations | GET | `/crm/v4/objects/{type}/{id}/associations/{toType}` | Read associations |
| Associations | PUT | `/crm/v4/objects/{type}/{id}/associations/{toType}/{toId}` | Create association |
| Pipelines | GET | `/crm/v3/pipelines/{objectType}` | List pipelines |
| Pipelines | POST | `/crm/v3/pipelines/{objectType}` | Create pipeline |
| Workflows | GET | `/automation/v4/flows` | List all workflows |
| Workflows | POST | `/automation/v4/flows` | Create workflow |
| Workflows | PUT | `/automation/v4/flows/{flowId}` | Update workflow |
| Workflows | DELETE | `/automation/v4/flows/{flowId}` | Delete workflow |
| Lists | GET | `/crm/v3/lists/` | List all lists |
| Lists | POST | `/crm/v3/lists/` | Create list |

**Object Type IDs**:
- `0-1` = Contacts
- `0-2` = Companies
- `0-3` = Deals
- `0-5` = Tickets
- `0-27` = Tasks
- `0-46` = Notes

---

## Exports

```typescript
interface ApiClient {
  crm: {
    get(objectType: string, id: string, properties?: string[]): Promise<CrmRecord>;
    search(objectType: string, filters: FilterGroup[], properties?: string[]): AsyncGenerator<CrmRecord[]>;
    create(objectType: string, properties: object): Promise<CrmRecord>;
    update(objectType: string, id: string, properties: object): Promise<CrmRecord>;
    delete(objectType: string, id: string): Promise<void>;
    batchCreate(objectType: string, records: object[]): Promise<BatchResult>;
    batchUpdate(objectType: string, records: {id: string, properties: object}[]): Promise<BatchResult>;
  };
  properties: PropertyClient;
  associations: AssociationClient;
  pipelines: PipelineClient;
  workflows: WorkflowClient;
  lists: ListClient;
}
```
