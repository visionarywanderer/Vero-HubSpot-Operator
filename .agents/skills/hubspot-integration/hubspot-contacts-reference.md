# HubSpot Contacts API v3 Reference

Contacts are the foundational CRM object. Use batch endpoints for bulk operations. Email is the primary dedup key.

## 1. Required Scopes

| Scope | Purpose |
|-------|---------|
| `crm.objects.contacts.read` | Read contact records |
| `crm.objects.contacts.write` | Create/update/archive contacts |

## 2. Endpoints

### CRUD

| Method | Path | Description |
|--------|------|-------------|
| POST | `/crm/v3/objects/contacts` | Create contact |
| GET | `/crm/v3/objects/contacts/{contactId}` | Get by ID |
| GET | `/crm/v3/objects/contacts/{email}?idProperty=email` | Get by email |
| GET | `/crm/v3/objects/contacts` | List (paginated, max 100/page) |
| PATCH | `/crm/v3/objects/contacts/{contactId}` | Update by ID |
| PATCH | `/crm/v3/objects/contacts/{email}?idProperty=email` | Update by email |
| DELETE | `/crm/v3/objects/contacts/{contactId}` | Archive (soft delete, recoverable) |

### Batch (max 100 records per call)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/crm/v3/objects/contacts/batch/create` | Batch create |
| POST | `/crm/v3/objects/contacts/batch/read` | Batch read |
| POST | `/crm/v3/objects/contacts/batch/update` | Batch update |
| POST | `/crm/v3/objects/contacts/batch/archive` | Batch archive |
| POST | `/crm/v3/objects/contacts/batch/upsert` | Batch upsert (create or update) |

### Search

| Method | Path | Description |
|--------|------|-------------|
| POST | `/crm/v3/objects/contacts/search` | Search with filters/sorts |

### Merge

| Method | Path | Description |
|--------|------|-------------|
| POST | `/crm/v3/objects/contacts/merge` | Merge two contacts |

### GDPR Delete

| Method | Path | Description |
|--------|------|-------------|
| POST | `/crm/v3/objects/contacts/gdpr-delete` | Permanently delete (GDPR compliance) |

### Secondary Emails

| Method | Path | Description |
|--------|------|-------------|
| GET | (read `hs_additional_emails` property) | Read secondary emails via v3 |
| POST | `/contacts/v1/secondary-email/{contactVid}/{email}` | Add secondary email (v1 legacy) |
| DELETE | `/contacts/v1/secondary-email/{contactVid}/{email}` | Remove secondary email (v1 legacy) |

### Associations

| Method | Path | Description |
|--------|------|-------------|
| PUT | `/crm/v3/objects/contacts/{id}/associations/{toObjectType}/{toObjectId}/{associationTypeId}` | Create association |
| DELETE | `/crm/v3/objects/contacts/{id}/associations/{toObjectType}/{toObjectId}/{associationTypeId}` | Remove association |

### Query Parameters

| Param | Description |
|-------|-------------|
| `properties` | Comma-separated property names to return |
| `propertiesWithHistory` | Include historical values |
| `associations` | Associated object types to include |
| `limit` | Results per page (max 100) |
| `after` | Pagination cursor |
| `idProperty` | Lookup key: `id`, `email`, or custom unique property |

## 3. Contact Properties

### Required for Creation

Only `email` is technically required (it is the dedup key). No email = risk of duplicates.

### Common Properties

| Property | Type | Notes |
|----------|------|-------|
| `email` | string | Primary dedup key |
| `firstname` | string | |
| `lastname` | string | |
| `phone` | string | |
| `company` | string | |
| `jobtitle` | string | |
| `lifecyclestage` | enumeration | Forward-only (see section 7) |
| `hs_lead_status` | enumeration | Lead status |
| `hubspot_owner_id` | number | Owner assignment |

### Create Example

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

### Create with Association

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

## 4. Search Filter Operators

POST `/crm/v3/objects/contacts/search`

### Operators

| Operator | Description | Value Field |
|----------|-------------|-------------|
| `EQ` | Equal to | `value` |
| `NEQ` | Not equal to | `value` |
| `LT` | Less than | `value` |
| `LTE` | Less than or equal | `value` |
| `GT` | Greater than | `value` |
| `GTE` | Greater than or equal | `value` |
| `BETWEEN` | Between two values | `value` (low) + `highValue` |
| `IN` | In list | `values` (array) |
| `NOT_IN` | Not in list | `values` (array) |
| `HAS_PROPERTY` | Property exists | (no value) |
| `NOT_HAS_PROPERTY` | Property doesn't exist | (no value) |
| `CONTAINS_TOKEN` | Contains token (tokenized match) | `value` |
| `NOT_CONTAINS_TOKEN` | Does not contain token | `value` |

### Search Limits

- Max **5 filterGroups** (OR'd together)
- Max **6 filters per group** (AND'd together)
- Max **18 filters total** across all groups
- Max **10,000 results** total (hard cap, no deep pagination beyond this)
- Max **200 results per page** (`limit` param)

### Search Example

```json
{
  "filterGroups": [
    {
      "filters": [
        {
          "propertyName": "lifecyclestage",
          "operator": "EQ",
          "value": "marketingqualifiedlead"
        },
        {
          "propertyName": "createdate",
          "operator": "GTE",
          "value": "2025-01-01T00:00:00Z"
        }
      ]
    }
  ],
  "sorts": [
    { "propertyName": "createdate", "direction": "DESCENDING" }
  ],
  "properties": ["email", "firstname", "lastname", "lifecyclestage"],
  "limit": 100,
  "after": 0
}
```

## 5. Batch Operation Formats

All batch endpoints accept max **100 records** per call.

### Batch Create

```json
{
  "inputs": [
    {
      "properties": {
        "email": "a@example.com",
        "firstname": "Alice"
      }
    },
    {
      "properties": {
        "email": "b@example.com",
        "firstname": "Bob"
      }
    }
  ]
}
```

### Batch Read

```json
{
  "properties": ["email", "lifecyclestage"],
  "idProperty": "email",
  "inputs": [
    { "id": "a@example.com" },
    { "id": "b@example.com" }
  ]
}
```

### Batch Update

```json
{
  "inputs": [
    {
      "id": "33451",
      "properties": {
        "lifecyclestage": "salesqualifiedlead"
      }
    }
  ]
}
```

### Batch Archive

```json
{
  "inputs": [
    { "id": "33451" },
    { "id": "33452" }
  ]
}
```

### Batch Upsert

```json
{
  "inputs": [
    {
      "idProperty": "email",
      "id": "a@example.com",
      "properties": {
        "email": "a@example.com",
        "firstname": "Alice Updated"
      }
    }
  ]
}
```

## 6. GDPR Delete

Permanently and irreversibly deletes a contact and all associated data for GDPR compliance.

```json
POST /crm/v3/objects/contacts/gdpr-delete

{
  "idProperty": "email",
  "objectId": "jane@example.com"
}
```

Or by ID:

```json
{
  "objectId": "33451"
}
```

## 7. Lifecycle Stage Rules

Lifecycle stages are **forward-only** by default:

`subscriber` → `lead` → `marketingqualifiedlead` → `salesqualifiedlead` → `opportunity` → `customer` → `evangelist`

### Moving Backward (Two-Step Process)

1. Clear the lifecycle stage (set to empty string):
```json
PATCH /crm/v3/objects/contacts/{id}
{ "properties": { "lifecyclestage": "" } }
```

2. Set the new (earlier) stage:
```json
PATCH /crm/v3/objects/contacts/{id}
{ "properties": { "lifecyclestage": "lead" } }
```

These must be **two separate API calls**. Cannot be done in one request.

## 8. Marketing vs Non-Marketing Contacts

- `hs_marketable_status` — indicates if a contact is a marketing contact
- **Read-only via API** — cannot be set through the API
- Marketing contact status can only be changed in the HubSpot UI or via workflows
- Marketing contacts count toward your HubSpot billing tier
- Non-marketing contacts don't receive marketing emails

## 9. Secondary Email Handling

**Reading:** Use the v3 property `hs_additional_emails` (semicolon-separated list).

```
GET /crm/v3/objects/contacts/{id}?properties=hs_additional_emails
```

**Writing:** Must use v1 legacy endpoints (no v3 equivalent exists):

```
POST /contacts/v1/secondary-email/{contactVid}/{email}
DELETE /contacts/v1/secondary-email/{contactVid}/{email}
```

Note: `contactVid` is the contact's numeric ID (same as `hs_object_id`).

## 10. Rate Limits

| Auth Type | Limit | Scope |
|-----------|-------|-------|
| OAuth | 110 requests / 10 seconds | Per account |
| Private app | 190 requests / 10 seconds | Per account |
| Search endpoint | 5 requests / second | Per app |
| Search results | 10,000 max total | Hard cap |

Batch calls count as **1 request** regardless of record count (up to 100).

## 11. Key Notes and Gotchas

- **Email is the dedup key.** Omitting email risks creating duplicates.
- **Properties not set** on a record are omitted from API responses entirely.
- **Use internal names** for enumeration values (e.g., `marketingqualifiedlead` not "Marketing Qualified Lead").
- **`batch/read` does not return associations.** Use the Associations API separately.
- **Upsert with `idProperty=email`:** Works for create-or-update, but partial upserts are not supported.
- **Up to 10 unique-value properties** per object type.
- **Archived contacts** go to recycling bin (recoverable in UI). Use GDPR delete for permanent removal.
- **Search is eventually consistent** — newly created/updated records may take seconds to appear.
- **`CONTAINS_TOKEN`** works on tokenized text (splits on whitespace/punctuation). It is NOT a substring match.
- **Merge:** The primary contact survives; the secondary is archived. Property values from the primary take precedence unless empty.

## 12. Cross-Reference

To automate contact operations (set properties, create tasks, send notifications on lifecycle changes), see `hubspot-workflows-reference.md` and `hubspot-workflow-templates.md`. **ALWAYS read these before creating workflows** — the v4 API has strict format requirements.
