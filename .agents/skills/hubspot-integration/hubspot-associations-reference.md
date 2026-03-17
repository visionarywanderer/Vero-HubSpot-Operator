# HubSpot Associations API v4 (Skill Companion)

The Associations v4 API manages relationships between CRM records. It supports labeled associations (e.g., "Billing contact", "Decision maker") and unlabeled default links. Use v4 for all new work—v3 associations are legacy. Batch endpoints handle up to 2,000 pairs per call.

## Required Scopes

Scopes vary by object type:
- `crm.objects.contacts.read` / `.write`
- `crm.objects.companies.read` / `.write`
- `crm.objects.deals.read` / `.write`
- `crm.objects.tickets.read` / `.write`

## Endpoints

| Method | Path | Summary |
|--------|------|---------|
| PUT | `/crm/v4/objects/{fromType}/{fromId}/associations/default/{toType}/{toId}` | Create unlabeled association |
| POST | `/crm/v4/associations/{fromType}/{toType}/batch/associate/default` | Batch create unlabeled (max 2,000) |
| PUT | `/crm/v4/objects/{fromType}/{fromId}/associations/{toType}/{toId}` | Create labeled association |
| POST | `/crm/v4/associations/{fromType}/{toType}/batch/create` | Batch create labeled (max 2,000) |
| GET | `/crm/v4/objects/{fromType}/{objectId}/associations/{toType}` | Get associations for a record |
| POST | `/crm/v4/associations/{fromType}/{toType}/batch/read` | Batch read (max 1,000) |
| DELETE | `/crm/v4/objects/{fromType}/{fromId}/associations/{toType}/{toId}` | Remove all associations between two records |
| POST | `/crm/v4/associations/{fromType}/{toType}/batch/archive` | Batch delete (max 2,000) |
| POST | `/crm/v4/associations/{fromType}/{toType}/batch/labels/archive` | Remove specific labels only |
| GET | `/crm/v4/associations/{fromType}/{toType}/labels` | List association type definitions |
| POST | `/crm/v4/associations/usage/high-usage-report/{userId}` | Email report of records near limits |

## Common Association Type IDs (HUBSPOT_DEFINED)

| Relationship | Type ID |
|-------------|---------|
| Contact → primary company | 1 |
| Company → primary contact | 2 |
| Deal → contact | 3 |
| Contact → deal | 4 |
| Deal → primary company | 5 |
| Parent company → child | 13 |
| Child company → parent | 14 |
| Contact → ticket | 15 |
| Ticket → contact | 16 |
| Deal → line item | 19 |
| Ticket → primary company | 26 |
| Deal → ticket | 27 |
| Contact → company (unlabeled) | 279 |
| Company → contact (unlabeled) | 280 |
| Deal → company (unlabeled) | 341 |
| Company → deal | 342 |

## Request Examples

### Batch create unlabeled

```json
{
  "inputs": [
    { "from": { "id": "12345" }, "to": { "id": "56678" } },
    { "from": { "id": "12346" }, "to": { "id": "56679" } }
  ]
}
```

### Create labeled association (body for PUT)

```json
[
  { "associationCategory": "USER_DEFINED", "associationTypeId": 36 }
]
```

### Batch read

```json
{
  "inputs": [
    { "id": "33451" },
    { "id": "29851" }
  ]
}
```

## Response Example (Batch Read)

```json
{
  "status": "COMPLETE",
  "results": [
    {
      "from": { "id": "33451" },
      "to": [
        {
          "toObjectId": 5790939450,
          "associationTypes": [
            { "category": "HUBSPOT_DEFINED", "typeId": 1, "label": "Primary" },
            { "category": "USER_DEFINED", "typeId": 28, "label": "Billing contact" }
          ]
        }
      ]
    }
  ]
}
```

## Best Practices

- Use batch endpoints for bulk linking—up to 2,000 pairs per call for create/delete, 1,000 for read.
- Verify `fromObjectType` → `toObjectType` direction matches the typeId. "Contact → primary company" is typeId 1, not 2.
- When updating labels, include ALL labels you want retained—omitted labels are dropped.
- Retrieve custom label typeIds via `GET /crm/v4/associations/{from}/{to}/labels` before use; IDs are account-specific.
- Use the high-usage report endpoint proactively to spot records approaching limits.

## Anti-patterns

- Removing the default unlabeled association (typeId 279/280) thinking it only removes the unlabeled link—it removes ALL associations between those two records.
- Using v3 association endpoints for new integrations instead of v4.
- Ignoring directionality—typeIds are direction-specific.
- Looping single PUT calls instead of using batch endpoints.

## Key Notes

- **Batch limits:** 2,000 inputs for create/archive; 1,000 for read.
- **Rate limits (associations-specific):**
  - Free/Starter: 100 req/10s
  - Professional/Enterprise: 150 req/10s
  - Daily: 500,000 association requests (capped, even with add-on)
- **Association categories:** `HUBSPOT_DEFINED` (built-in labels) vs `USER_DEFINED` (custom labels).
- **Deleting unlabeled = deleting all:** Removing typeId 279 or 280 removes every association between those two records.
- **Node.js SDK:** v9.0.0+ required for v4 associations support.
- **v3 → v4 migration:** Legacy v1 typeIds (1–28) differ from v4 typeIds; consult the reference for your API version.
