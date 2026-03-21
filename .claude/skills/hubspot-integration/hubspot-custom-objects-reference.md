# HubSpot Custom Objects API v3 (Skill Companion)

Custom Objects let you model domain-specific entities (e.g., "Cars", "Subscriptions", "Pets") beyond the standard CRM objects. You first define a schema, then create records against it. Requires Enterprise tier. The object name and label are immutable once created.

## Required Scopes

- `crm.schemas.custom.read` / `crm.schemas.custom.write` (schema management)
- `crm.objects.custom.read` / `crm.objects.custom.write` (record CRUD)

## Endpoints — Schema Management

| Method | Path | Summary |
|--------|------|---------|
| POST | `/crm/v3/schemas` | Create a custom object schema |
| GET | `/crm/v3/schemas` | List all custom object schemas |
| GET | `/crm/v3/schemas/{objectTypeId}` | Get a specific schema |
| PATCH | `/crm/v3/schemas/{objectTypeId}` | Update schema (display, required props) |
| DELETE | `/crm/v3/schemas/{objectType}` | Soft-delete schema |
| DELETE | `/crm/v3/schemas/{objectType}?archived=true` | Hard-delete (allows name reuse) |
| POST | `/crm/v3/schemas/{objectTypeId}/associations` | Define association to another object |

### GET /crm/v3/schemas Query Params

| Param | Default | Description |
|-------|---------|-------------|
| `archived` | false | Include only archived schemas |
| `includeAssociationDefinitions` | true | Include association defs |
| `includeAuditMetadata` | true | Include audit timestamps |
| `includePropertyDefinitions` | true | Include property defs |

## Endpoints — Record Operations

| Method | Path | Summary |
|--------|------|---------|
| POST | `/crm/v3/objects/{objectType}` | Create a record |
| GET | `/crm/v3/objects/{objectType}/{recordId}` | Get a record |
| GET | `/crm/v3/objects/{objectType}` | List records (paginated) |
| POST | `/crm/v3/objects/{objectType}/batch/read` | Batch read records |
| PATCH | `/crm/v3/objects/{objectType}/{recordId}` | Update a record |
| POST | `/crm/v3/objects/{objectType}/batch/update` | Batch update |
| PUT | `/crm/v3/objects/{objectType}/{objectId}/associations/{toObjectType}/{toObjectId}/{associationType}` | Associate record |
| DELETE | `/crm/v3/objects/{objectType}/{recordId}` | Archive record |

## Request Examples

### Create schema

```json
{
  "name": "cars",
  "description": "Vehicle inventory",
  "labels": { "singular": "Car", "plural": "Cars" },
  "primaryDisplayProperty": "model",
  "secondaryDisplayProperties": ["make"],
  "searchableProperties": ["year", "make", "vin", "model"],
  "requiredProperties": ["year", "make", "vin", "model"],
  "properties": [
    {
      "name": "vin",
      "label": "VIN",
      "type": "string",
      "fieldType": "text",
      "hasUniqueValue": true
    }
  ],
  "associatedObjects": ["CONTACT"]
}
```

### Create record

```json
{
  "properties": {
    "year": "2014",
    "make": "Nissan",
    "model": "Frontier",
    "vin": "4Y1SL65848Z411439",
    "price": "12000"
  }
}
```

### Define association

```json
{
  "fromObjectTypeId": "2-3465404",
  "toObjectTypeId": "ticket",
  "name": "car_to_ticket"
}
```

## Response Example (Create Record)

```json
{
  "id": "181308",
  "properties": {
    "year": "2014",
    "make": "Nissan",
    "model": "Frontier",
    "vin": "4Y1SL65848Z411439",
    "price": "12000"
  },
  "createdAt": "2020-02-23T01:44:11.035Z",
  "updatedAt": "2020-02-23T01:44:11.035Z",
  "archived": false
}
```

## Property Types

| Type | Valid Field Types |
|------|-------------------|
| `enumeration` | `booleancheckbox`, `checkbox`, `radio`, `select` |
| `date` | `date` |
| `dateTime` | `date` |
| `string` | `file`, `text`, `textarea` |
| `number` | `number` |

## Best Practices

- Plan schema carefully—name and label cannot be changed after creation.
- Set `hasUniqueValue: true` on natural keys (e.g., VIN, serial number) for dedup and `idProperty` lookups.
- Use `searchableProperties` to enable full-text search in the HubSpot UI.
- Reference standard objects by name (`CONTACT`, `COMPANY`, `DEAL`, `TICKET`) and custom objects by `objectTypeId`.
- Fully qualified name format: `p{hubId}_{objectName}` (e.g., `p1234_lender`).

## Anti-patterns

- Creating schemas without thinking through required/searchable properties—hard to change later.
- Trying to rename a custom object (impossible; must delete and recreate).
- Deleting a schema before deleting all its records (will fail).
- Using `batch/read` to fetch associations (not supported).

## Key Notes

- **Enterprise tier required** for custom objects.
- **Max 10 unique value properties** per custom object.
- **Schema deletion:** Must delete all records first. Use `?archived=true` to hard-delete and allow recreating with the same name.
- **Auto-created properties:** `emails`, `meetings`, `notes`, `tasks`, `calls`, `conversations`.
- **First `secondaryDisplayProperty`** automatically becomes a dashboard filter if it is `string`, `number`, `enumeration`, `boolean`, or `datetime`.
- Properties not set on a record will not appear in the API response.
