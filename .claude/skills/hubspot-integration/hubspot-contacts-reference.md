# HubSpot Contacts API v3 (Skill Companion)

The Contacts API lets you create, read, update, delete, and search contact records in HubSpot CRM. Contacts are the foundational object—most CRM workflows start here. Use batch endpoints whenever operating on more than a handful of records.

## Required Scopes

- `crm.objects.contacts.read`
- `crm.objects.contacts.write`

## Endpoints

| Method | Path | Summary |
|--------|------|---------|
| POST | `/crm/v3/objects/contacts` | Create a single contact |
| POST | `/crm/v3/objects/contacts/batch/create` | Batch create (max 100) |
| GET | `/crm/v3/objects/contacts/{recordId}` | Get contact by ID |
| GET | `/crm/v3/objects/contacts/{email}?idProperty=email` | Get contact by email |
| GET | `/crm/v3/objects/contacts` | List contacts (paginated) |
| POST | `/crm/v3/objects/contacts/batch/read` | Batch read (max 100) |
| PATCH | `/crm/v3/objects/contacts/{contactId}` | Update by ID |
| PATCH | `/crm/v3/objects/contacts/{email}?idProperty=email` | Update by email |
| POST | `/crm/v3/objects/contacts/batch/update` | Batch update (max 100) |
| POST | `/crm/v3/objects/contacts/batch/upsert` | Batch upsert (max 100) |
| PUT | `/crm/v3/objects/contacts/{id}/associations/{toObjectType}/{toObjectId}/{associationTypeId}` | Associate contact |
| DELETE | `/crm/v3/objects/contacts/{contactId}` | Archive contact |

## Query Parameters

| Param | Description |
|-------|-------------|
| `properties` | Comma-separated property names to return |
| `propertiesWithHistory` | Include current + historical values |
| `associations` | Associated object types to include |
| `limit` | Results per page (max 100) |
| `after` | Pagination cursor |
| `idProperty` | Lookup key: `id`, `email`, or custom unique property |

## Request Examples

### Create single contact

```json
{
  "properties": {
    "email": "jane@example.com",
    "firstname": "Jane",
    "lastname": "Doe",
    "phone": "+18005551234",
    "company": "Acme Corp",
    "lifecyclestage": "marketingqualifiedlead"
  }
}
```

### Create with association

```json
{
  "properties": {
    "email": "jane@example.com",
    "firstname": "Jane",
    "lastname": "Doe"
  },
  "associations": [
    {
      "to": { "id": 123456 },
      "types": [
        { "associationCategory": "HUBSPOT_DEFINED", "associationTypeId": 279 }
      ]
    }
  ]
}
```

### Batch read by email

```json
{
  "properties": ["email", "lifecyclestage", "jobtitle"],
  "idProperty": "email",
  "inputs": [
    { "id": "jane@example.com" },
    { "id": "bob@example.com" }
  ]
}
```

## Response Example

```json
{
  "results": [
    {
      "id": "33451",
      "properties": {
        "createdate": "2022-06-01T14:31:48.469Z",
        "email": "jane@example.com",
        "firstname": "Jane",
        "lastname": "Doe",
        "hs_object_id": "33451",
        "lastmodifieddate": "2025-07-07T20:27:17.947Z"
      },
      "createdAt": "2022-06-01T14:31:48.469Z",
      "updatedAt": "2025-07-07T20:27:17.947Z",
      "archived": false
    }
  ],
  "paging": {
    "next": {
      "after": "33452",
      "link": "https://api.hubspot.com/crm/v3/objects/contacts?limit=1"
    }
  }
}
```

## Best Practices

- Always include `email` when creating contacts—it is the primary deduplication key.
- Use batch endpoints for any operation touching more than a few records. Max 100 per batch.
- Use `idProperty=email` to look up or update contacts without knowing their HubSpot ID.
- Prefer `batch/upsert` for sync workflows—it creates or updates in a single call.
- Request only the properties you need via the `properties` param to keep payloads small.

## Anti-patterns

- Looping single-record creates/updates instead of batching.
- Omitting `email`, leading to duplicate contacts.
- Trying to retrieve associations via `batch/read`—it does not support them; use the Associations API.
- Setting lifecycle stage backwards without clearing it first (only forward progression is allowed).
- Using display names for enumeration values instead of internal names.

## Key Notes

- **Batch limit:** 100 records per batch call (create, read, update, upsert, archive).
- **Lifecycle stage:** Forward-only. To move backward, clear the value first.
- **Upsert with email as `idProperty`:** Partial upserts are not supported; use a custom unique identifier property instead.
- **Deletion:** Moves contacts to recycling bin (recoverable in HubSpot UI).
- **Properties not set** on a record will not appear in the API response.
- **Up to 10 unique value properties** can exist per object type.
