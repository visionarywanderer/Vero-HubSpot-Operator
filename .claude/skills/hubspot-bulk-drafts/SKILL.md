---
description: "Create HubSpot bulk operation script drafts via the app. Use when: user asks to create, build, or save a bulk script, data cleanup, mass update, or batch operation for HubSpot."
---

# HubSpot Bulk Operation Draft Skill

When asked to create bulk operation scripts, generate valid Node.js scripts and save them as drafts using the `save_script_draft` MCP tool. The user registers and executes from the Bulk Operations page.

---

## Script Spec Format

```yaml
# For the MCP tool — send as JSON
description: "What this script does"   # REQUIRED — human-readable
code: |                                 # REQUIRED — complete Node.js script
  const HUBSPOT_TOKEN = process.env.HUBSPOT_TOKEN;
  const DRY_RUN = process.argv.includes("--dry-run");
  // ... full script
```

## Complete Script Template

```javascript
// ============================================================
// HubSpot Bulk Operation Script
// Description: {{DESCRIPTION}}
// ============================================================

const HUBSPOT_TOKEN = process.env.HUBSPOT_TOKEN;
const DRY_RUN = process.argv.includes("--dry-run");
const BASE = "https://api.hubapi.com";

const headers = {
  Authorization: `Bearer ${HUBSPOT_TOKEN}`,
  "Content-Type": "application/json",
};

// --- Rate-limited fetch with retry ---
async function fetchWithRetry(url, options, retries = 3) {
  for (let i = 0; i < retries; i++) {
    const res = await fetch(url, options);
    if (res.status === 429) {
      const wait = Math.max(
        parseInt(res.headers.get("retry-after") || "1", 10) * 1000,
        1000
      );
      console.log(JSON.stringify({
        timestamp: new Date().toISOString(),
        status: "rate_limited",
        retryAfterMs: wait,
        attempt: i + 1
      }));
      await new Promise((r) => setTimeout(r, wait));
      continue;
    }
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`HTTP ${res.status}: ${body}`);
    }
    return res.json();
  }
  throw new Error("Max retries exceeded after rate limiting");
}

// --- Batch helper (groups items, respects HubSpot 100-item limit) ---
function chunk(arr, size = 100) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

// --- JSONL logger ---
function log(entry) {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    ...entry
  }));
}

async function main() {
  log({ status: "started", mode: DRY_RUN ? "dry-run" : "execute" });

  let after;
  let processed = 0;
  let changed = 0;
  let errors = 0;

  do {
    // Search for target records
    const searchBody = {
      filterGroups: [
        {
          filters: [
            {
              propertyName: "{{FILTER_PROPERTY}}",
              operator: "EQ",
              value: "{{FILTER_VALUE}}"
            }
          ]
        }
      ],
      properties: ["{{PROP1}}", "{{PROP2}}"],
      limit: 100,
      ...(after ? { after } : {}),
    };

    const data = await fetchWithRetry(
      `${BASE}/crm/v3/objects/{{OBJECT_TYPE}}/search`,
      { method: "POST", headers, body: JSON.stringify(searchBody) }
    );

    for (const record of data.results || []) {
      processed++;
      const entry = {
        recordId: record.id,
        action: "{{ACTION_NAME}}",
        before: record.properties.{{PROP1}},
        after: "{{NEW_VALUE}}",
      };

      if (DRY_RUN) {
        log({ ...entry, status: "dry_run" });
      } else {
        try {
          await fetchWithRetry(
            `${BASE}/crm/v3/objects/{{OBJECT_TYPE}}/${record.id}`,
            {
              method: "PATCH",
              headers,
              body: JSON.stringify({
                properties: { {{PROP1}}: "{{NEW_VALUE}}" }
              }),
            }
          );
          log({ ...entry, status: "success" });
          changed++;
        } catch (err) {
          log({ ...entry, status: "error", error: err.message });
          errors++;
        }
      }
    }

    after = data.paging?.next?.after;
  } while (after);

  log({
    status: "completed",
    mode: DRY_RUN ? "dry-run" : "execute",
    processed,
    changed,
    errors
  });
}

main().catch((err) => {
  log({ status: "fatal_error", error: err.message });
  process.exit(1);
});
```

---

## Critical Rules (Pre-flight Checklist)

| # | Rule | Consequence if violated |
|---|------|------------------------|
| 1 | ALWAYS use `process.env.HUBSPOT_TOKEN` — never hardcode tokens | Security vulnerability |
| 2 | ALWAYS support `--dry-run` flag | Engine blocks execute without prior dry-run |
| 3 | Rate limit: retry on HTTP 429 with `retry-after` header | Script fails mid-batch |
| 4 | JSONL logging: each action as JSON with `timestamp`, `recordId`, `action`, `status` | No audit trail, engine can't parse results |
| 5 | Batch in groups of 100 max (HubSpot batch API limit) | 400: batch size exceeded |
| 6 | Use search API for filtering, not list-all + filter | Timeout on large portals |
| 7 | Use PATCH for updates, not PUT (PUT replaces all properties) | Data loss — all unspecified properties cleared |
| 8 | Handle pagination with `after` cursor | Only processes first 100 records |
| 9 | Log `before` and `after` values for each change | Cannot verify/audit changes |
| 10 | Script must exit with code 0 on success, non-zero on failure | Engine treats as failed |

---

## HubSpot API Reference for Bulk Scripts

### Search API

```
POST /crm/v3/objects/{objectType}/search
```

| Parameter | Limit |
|---|---|
| Max `filterGroups` | 5 |
| Max `filters` per group | 6 |
| Max results per page | 200 (default 10) |
| Max total searchable | 10,000 |
| Search consistency | Eventually consistent (~30s delay) |

### Search Filter Operators

| Operator | Use |
|---|---|
| `EQ` | Equals |
| `NEQ` | Not equals |
| `LT` / `LTE` | Less than / less than or equal |
| `GT` / `GTE` | Greater than / greater than or equal |
| `BETWEEN` | Range (needs `value` and `highValue`) |
| `IN` | In list (needs `values` array) |
| `NOT_IN` | Not in list |
| `HAS_PROPERTY` | Property has any value |
| `NOT_HAS_PROPERTY` | Property is empty |
| `CONTAINS_TOKEN` | Contains substring |
| `NOT_CONTAINS_TOKEN` | Does not contain |

### Batch API Endpoints

```
POST /crm/v3/objects/{objectType}/batch/create    # max 100 items
POST /crm/v3/objects/{objectType}/batch/update     # max 100 items
POST /crm/v3/objects/{objectType}/batch/upsert     # max 100 items (create or update)
POST /crm/v3/objects/{objectType}/batch/read       # max 100 items
POST /crm/v3/objects/{objectType}/batch/archive    # max 100 items
```

**Upsert**: Set `idProperty` (e.g., `"email"`) + `id` (the value). Creates if not found, updates if found.

**Idempotent creates**: Include `objectWriteTraceId` per input to get 207 multi-status responses and prevent duplicates on retry.

### Rate Limits (by HubSpot tier)

| Tier | Burst (per 10s) | Daily |
|---|---|---|
| Free/Starter | 100 | 250,000 |
| Professional | 190 | 625,000 |
| Enterprise | 190 | 1,000,000 |
| Search API | 4/second (stricter) | — |
| Batch items | 100 per request | — |

### Property Value Formats

| Type | Format | Example |
|---|---|---|
| String | Plain string | `"hello"` |
| Number | Numeric string | `"42.5"` |
| Date | `YYYY-MM-DD` | `"2026-03-17"` |
| Datetime | Epoch milliseconds string | `"1679529600000"` |
| Boolean | `"true"` / `"false"` | `"true"` |
| Enumeration (single) | Value string | `"option_a"` |
| Enumeration (multi) | Semicolon-separated | `"opt_a;opt_b"` |
| Enumeration (append) | Prefix with `;` to add | `";new_opt"` |
| Clear any value | Empty string | `""` |

---

## Common Bulk Operation Patterns

### Mass Property Update
```javascript
// Search → filter → PATCH each record
// Use case: Update lifecycle stage, set lead status, assign owner
```

### Data Cleanup
```javascript
// Search for bad data → correct or remove values
// Use case: Fix formatting, deduplicate, normalize values
// TIP: Use CONTAINS_TOKEN to find partial matches
```

### Lifecycle Stage Migration
```javascript
// IMPORTANT: Lifecycle stage can only move FORWARD by default
// To move backward, first clear the stage, then set the new value
// Two PATCH calls per record: first clear, then set
await fetchWithRetry(url, { method: "PATCH", headers,
  body: JSON.stringify({ properties: { lifecyclestage: "" } }) });
await fetchWithRetry(url, { method: "PATCH", headers,
  body: JSON.stringify({ properties: { lifecyclestage: "lead" } }) });
```

### Owner Assignment
```javascript
// Search unassigned → assign based on rules (round-robin, territory, etc.)
// Owner IDs can be found via: GET /crm/v3/owners
```

### Association Creation
```javascript
// Batch associate records
// POST /crm/v4/associations/{fromObjectType}/{toObjectType}/batch/create
const body = {
  inputs: records.map(r => ({
    from: { id: r.fromId },
    to: { id: r.toId },
    types: [{ associationCategory: "USER_DEFINED", associationTypeId: typeId }]
  }))
};
```

---

## Troubleshooting Guide

| Error | Cause | Fix |
|---|---|---|
| `429 Too Many Requests` | Rate limited | Increase retry wait, reduce batch size |
| `Script exceeded 30 minute timeout` | Too many records or slow processing | Use batch endpoints instead of individual PATCH calls |
| `Exit code 1` | Unhandled error in script | Check stderr output for stack trace |
| `Dry-run required before execute` | Tried to execute without dry-run first | Run in dry-run mode first, then execute |
| `Write operation blocked by safety policy` | Sandbox-first policy on production portal | Validate session in the app first |
| `HTTP 207: Multi-Status` | Batch with mixed success/failure | Parse per-item results, retry only failed items |
| `HTTP 409: Conflict` | Duplicate unique property value | Use batch/upsert instead of batch/create |
| `HTTP 423: Locked` | High-volume data sync in progress | Retry with 2-second delay |
| `Search returns max 10,000` | Search API limit | Segment by createdate or hs_object_id ranges |
| `Property is read-only` (400) | Trying to set an `hs_*` computed property | Check which properties are writable |
| `IN/NOT_IN case mismatch` | String values must be lowercase for IN/NOT_IN | Always lowercase filter values |

---

## Alternative Approaches

| Goal | Option A (bulk script) | Option B (alternative) |
|---|---|---|
| Update <100 records | Single batch PATCH call | Manual update in HubSpot UI |
| Update >10,000 records | Partition by date ranges in script | HubSpot import CSV feature |
| Complex conditional logic | Script with custom filtering | Workflow + list enrollment |
| One-time cleanup | Bulk script | HubSpot Operations Hub (if available) |
| Recurring sync | Scheduled bulk script | Webhook + workflow automation |

---

## Procedure

1. **⚡ FIRST: Read `hubspot-learnings` skill** — cross-check your planned operation against ALL known patterns and failures. Do NOT skip this step.
2. Ask the user what the bulk operation should do
3. Identify: object type, filter criteria, action to perform
3. Generate a complete Node.js script using the template above
4. Replace all `{{PLACEHOLDER}}` values with actual values
5. Ensure `--dry-run` support and JSONL logging are included
6. **Pre-flight check**: Verify all 10 critical rules
7. Call `save_script_draft` MCP tool with `{ "code": "...", "description": "..." }`
8. Tell the user to register and execute from the Bulk Operations page
9. Remind: always run dry-run first, review logs, then execute
