# HubSpot Deals API v3 (Skill Companion)

The Deals API manages sales opportunities through their lifecycle. Deals live inside pipelines and move through stages. Always use internal IDs (not display names) for pipeline and stage values. Batch endpoints support up to 100 records per call.

## Required Scopes

- `crm.objects.deals.read`
- `crm.objects.deals.write`

## Endpoints

| Method | Path | Summary |
|--------|------|---------|
| POST | `/crm/v3/objects/deals` | Create a deal |
| POST | `/crm/v3/objects/deals/batch/create` | Batch create (max 100) |
| GET | `/crm/v3/objects/deals/{dealId}` | Get deal by ID |
| GET | `/crm/v3/objects/deals` | List all deals (paginated) |
| POST | `/crm/v3/objects/deals/batch/read` | Batch read (max 100) |
| PATCH | `/crm/v3/objects/deals/{dealId}` | Update a deal |
| POST | `/crm/v3/objects/deals/batch/update` | Batch update (max 100) |
| POST | `/crm/v3/objects/deals/batch/upsert` | Batch upsert (max 100) |
| PUT | `/crm/v3/objects/deals/{dealId}/associations/{toObjectType}/{toObjectId}/{associationTypeId}` | Associate deal |
| DELETE | `/crm/v3/objects/deals/{dealId}/associations/{toObjectType}/{toObjectId}/{associationTypeId}` | Remove association |
| DELETE | `/crm/v3/objects/deals/{dealId}` | Archive deal |
| POST | `/crm/v3/objects/deals/batch/archive` | Batch archive |

## Request Examples

### Create deal

```json
{
  "properties": {
    "dealname": "Enterprise renewal",
    "amount": "48000.00",
    "closedate": "2025-12-15T00:00:00.000Z",
    "pipeline": "default",
    "dealstage": "contractsent",
    "hubspot_owner_id": "910901"
  }
}
```

### Create deal with associations

```json
{
  "properties": {
    "dealname": "New deal",
    "pipeline": "default",
    "dealstage": "contractsent",
    "amount": "1500.00"
  },
  "associations": [
    {
      "to": { "id": 201 },
      "types": [{ "associationCategory": "HUBSPOT_DEFINED", "associationTypeId": 5 }]
    },
    {
      "to": { "id": 301 },
      "types": [{ "associationCategory": "HUBSPOT_DEFINED", "associationTypeId": 3 }]
    }
  ]
}
```

### Batch read with history

```json
{
  "propertiesWithHistory": ["dealstage"],
  "inputs": [
    { "id": "7891023" },
    { "id": "987654" }
  ]
}
```

## Response Example

```json
{
  "id": "7891023",
  "properties": {
    "dealname": "Enterprise renewal",
    "amount": "48000.00",
    "dealstage": "contractsent",
    "pipeline": "default",
    "closedate": "2025-12-15T00:00:00.000Z",
    "hs_object_id": "7891023"
  },
  "createdAt": "2025-01-10T10:00:00.000Z",
  "updatedAt": "2025-03-01T14:22:00.000Z",
  "archived": false
}
```

## Best Practices

- Always use **internal IDs** for `pipeline` and `dealstage`—never display names.
- Use `propertiesWithHistory` on `dealstage` to build pipeline velocity reports.
- Batch operations max out at 100 records per call.
- Use custom unique identifier properties (e.g., external order number) with `idProperty` for upserts.
- Pin at most one activity per deal; the activity must already be associated before pinning.

## Anti-patterns

- Using pipeline/stage display names in API calls—will silently fail or error.
- Fetching associations via `batch/read`—not supported; use the Associations v4 API.
- Updating deals one at a time in a loop instead of batching.
- Forgetting to specify `pipeline` when the account has multiple pipelines.

## Key Notes

- **Required properties:** `dealname`, `dealstage`, and `pipeline` (when multiple pipelines exist).
- **Batch limit:** 100 records per batch call.
- **Deletion:** Moves to recycling bin; restorable from HubSpot UI.
- **Collaborators:** Set `hs_all_collaborator_owner_ids` as semicolon-delimited owner IDs (e.g., `;12345;67890`).
- **Custom unique identifiers** enable lookup by external system IDs.
