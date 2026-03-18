# HubSpot Integration Anti-patterns (Skill Companion)

A consolidated reference of common mistakes when building HubSpot integrations. Sourced from official docs, rate limit guidelines, auth migration notices, and webhook best practices. Use this as a pre-flight checklist.

## 1. Authentication Anti-patterns

| Anti-pattern | Why It's Wrong | Correct Approach |
|-------------|----------------|------------------|
| Using API keys (`hapikey`) | Sunset Nov 30, 2022; no scoped permissions | Private app tokens (single-account) or OAuth (multi-account) |
| Storing tokens client-side | Exposes secrets; enables token theft | Store on backend; use server-to-server calls |
| Never refreshing access tokens | Tokens expire in ~30 min; calls will 401 | Implement proactive refresh before expiry |
| Ignoring `optional_scope` | Required scopes that the user's tier lacks block installation | Use `optional_scope` for non-critical features |
| Hardcoding `client_secret` | Rotation and auditing become impossible | Use environment variables or secret manager |

## 2. Per-Record vs Batch Anti-patterns

| Anti-pattern | Impact | Correct Approach |
|-------------|--------|------------------|
| Creating contacts one at a time in a loop | 100 records = 100 API calls (1 call batched) | `POST /crm/v3/objects/contacts/batch/create` (max 100) |
| Updating deals individually in a loop | Burns rate limit budget 100x faster | `POST /crm/v3/objects/deals/batch/update` |
| Creating associations one at a time | 1,000 links = 1,000 calls | `POST /crm/v4/associations/.../batch/associate/default` (max 2,000) |
| Reading contacts one by one to check existence | Unnecessary; upsert handles this | `POST /crm/v3/objects/contacts/batch/upsert` |

**Rule of thumb:** If you're operating on more than 3 records, use a batch endpoint.

## 3. Rate Limit Anti-patterns

| Anti-pattern | Impact | Correct Approach |
|-------------|--------|------------------|
| No retry logic on 429 | Requests silently dropped | Exponential backoff with jitter |
| Immediate retry on 429 | Amplifies rate limit pressure | Wait, then retry with backoff |
| Polling every 10s for infrequent data | Wastes 250+ calls/hour for nothing | Use webhooks (free) + hourly reconciliation poll |
| Fetching all properties on every call | Large payloads, slow responses, more timeouts | Specify only needed `properties` |
| Multiple apps hitting same account uncoordinated | Daily limit is shared; one app starves others | Coordinate daily budget across apps |
| No caching for repeated reads | Same data fetched repeatedly | Cache with TTL; invalidate on webhook events |

### Rate Limit Quick Reference

| Tier | Burst | Daily |
|------|-------|-------|
| Free/Starter | 100/10s | 250,000 |
| Professional | 190/10s | 625,000 |
| Enterprise | 190/10s | 1,000,000 |
| Public OAuth | 110/10s | — |

## 4. Data Model Anti-patterns

| Anti-pattern | Impact | Correct Approach |
|-------------|--------|------------------|
| Omitting `email` on contact create | Duplicate contacts proliferate | Always include `email` as deduplication key |
| Using display names for enum values | Silent failures or wrong data | Use internal property names |
| Setting `date` properties with non-UTC-midnight timestamps | Off-by-one date display in UI | Set to midnight UTC or use `YYYY-MM-DD` |
| Using pipeline/stage display names for deals | API errors or silent misrouting | Use internal pipeline/stage IDs |
| Trying to set lifecycle stage backward | Silently ignored | Clear the value first, then set the new stage |
| Setting properties to `null` to clear them | Doesn't work | Set to empty string `""` |

## 5. Association Anti-patterns

| Anti-pattern | Impact | Correct Approach |
|-------------|--------|------------------|
| Removing unlabeled association (typeId 279/280) | Deletes ALL associations between those records | Remove only the specific labeled association |
| Ignoring typeId directionality | Wrong relationship created | Verify from→to direction matches typeId |
| Fetching associations via `batch/read` on CRM objects | Not supported | Use Associations v4 `batch/read` endpoint |
| Using v3 associations for new work | Missing labels, fewer batch options | Use v4 endpoints |

## 6. Webhook & Polling Anti-patterns

| Anti-pattern | Impact | Correct Approach |
|-------------|--------|------------------|
| Using webhooks for email events | Not supported; no data received | Poll the Events/Email Analytics API |
| Processing webhooks synchronously | >5s timeout triggers unnecessary retries | Queue internally, respond 200 immediately |
| No idempotency handling | Duplicate events processed multiple times | Deduplicate on `eventId` |
| Assuming event order | Race conditions, stale data written | Sort by `occurredAt` timestamp |
| Using only webhooks, no reconciliation | Missed events accumulate silently | Periodic polling pass to catch gaps |
| Subscribing to properties that don't exist in account | Silent failure—no webhooks fire | Verify property exists before subscribing |

## 7. Workflow API Anti-patterns

| Anti-pattern | Impact | Correct Approach |
|-------------|--------|------------------|
| Using v3 workflow API for new builds | Missing modern action types, AI actions | Use v4 (`/automation/v4/flows`) |
| Updating without current `revisionId` | Validation error | GET workflow first, use its `revisionId` |
| Sending partial action list in PUT | Missing actions are permanently deleted | Include ALL actions in every update |
| Including `createdAt`/`updatedAt` in PUT body | Validation error | Strip system fields from GET response before PUT |
| Deleting workflows expecting undo | Deletion is permanent via API | Confirm before deleting; export config first |

## 8. General Integration Anti-patterns

| Anti-pattern | Impact | Correct Approach |
|-------------|--------|------------------|
| Not validating webhook signatures | Vulnerable to spoofed payloads | Verify `X-HubSpot-Signature` (SHA-256) |
| Skipping error monitoring | Silent failures go unnoticed | Track error rates; HubSpot requires <5% for Marketplace |
| Over-fetching with `GET /crm/v3/objects/*` | Slow, large payloads | Use `properties` param to select fields |
| Ignoring pagination | Only first page of results processed | Always follow `paging.next.after` cursor |
| Building on custom objects without Enterprise tier | API calls will 403 | Verify customer's HubSpot tier first |

## Pre-flight Checklist

Before deploying a HubSpot integration:

- [ ] Auth: Using OAuth or private app tokens (not API keys)
- [ ] Auth: Token refresh logic implemented and tested
- [ ] Batch: All multi-record operations use batch endpoints
- [ ] Rate limits: 429 retry with exponential backoff
- [ ] Rate limits: Caching in place for frequently-read data
- [ ] Webhooks: Signature verification enabled
- [ ] Webhooks: Idempotent processing (dedup on `eventId`)
- [ ] Webhooks: <5s response time (async processing)
- [ ] Polling: Used only where webhooks don't cover (email events)
- [ ] Data: Internal names used for enums, pipelines, stages
- [ ] Data: `email` included on all contact creates
- [ ] Pagination: `after` cursor followed to completion
- [ ] Error rate monitoring in place
