# HubSpot Properties API v3 (Skill Companion)

Properties define the data fields on every CRM object. Use this API to create custom properties, manage property groups, and understand field types. Properties are shared across all records of a given object type.

## Required Scopes

- `crm.schemas.contacts.read` / `crm.schemas.contacts.write` (or equivalent per object)

## Endpoints

| Method | Path | Summary |
|--------|------|---------|
| GET | `/crm/v3/properties/{objectType}` | List all properties for an object |
| GET | `/crm/v3/properties/{objectType}/{propertyName}` | Get a specific property |
| POST | `/crm/v3/properties/{objectType}` | Create a property |
| PATCH | `/crm/v3/properties/{objectType}/{propertyName}` | Update a property |
| DELETE | `/crm/v3/properties/{objectType}/{propertyName}` | Archive a property |
| GET | `/crm/v3/properties/{objectType}/groups` | List property groups |
| POST | `/crm/v3/properties/{objectType}/groups` | Create a property group |
| PATCH | `/crm/v3/properties/{objectType}/groups/{groupName}` | Update a group |
| DELETE | `/crm/v3/properties/{objectType}/groups/{groupName}` | Archive a group |

**Note:** To update property *values* on records, use `PATCH /crm/v3/objects/{objectType}/{recordId}`.

## Request Example — Create Property

```json
{
  "groupName": "contactinformation",
  "name": "favorite_food",
  "label": "Favorite Food",
  "type": "string",
  "fieldType": "text"
}
```

### Create unique identifier property

```json
{
  "groupName": "dealinformation",
  "name": "system_a_unique",
  "label": "Unique ID for System A",
  "hasUniqueValue": true,
  "type": "string",
  "fieldType": "text"
}
```

### Create calculation property

```json
{
  "groupName": "dealinformation",
  "name": "days_open",
  "label": "Days Open",
  "type": "number",
  "fieldType": "calculation_equation",
  "calculationFormula": "closed - started"
}
```

## Property Types & Field Types

| Type | Valid Field Types | Notes |
|------|-------------------|-------|
| `bool` | `booleancheckbox`, `calculation_equation` | True/false |
| `enumeration` | `booleancheckbox`, `checkbox`, `radio`, `select`, `calculation_equation` | Predefined options |
| `date` | `date` | `YYYY-MM-DD`, always UTC midnight |
| `datetime` | `date` | Full ISO 8601 with timezone |
| `string` | `file`, `text`, `textarea`, `html`, `phonenumber`, `calculation_equation` | Max 65,536 chars |
| `number` | `number`, `calculation_equation` | Decimals supported |
| `object_coordinates` | `text` | Internal/read-only |
| `json` | `text` | Internal/read-only |

## Setting Property Values

### Date fields
- `date` type: `YYYY-MM-DD` or UNIX ms at UTC midnight
- `datetime` type: ISO 8601 (`2020-02-29T03:30:17.000Z`) or UNIX ms

### Checkbox (multi-select) — append values
```json
{ "properties": { "hs_buying_role": ";BUDGET_HOLDER;END_USER" } }
```
Leading semicolon = append. No semicolon = overwrite.

### Clear a property value
```json
{ "properties": { "firstname": "" } }
```

### Assign owner
```json
{ "properties": { "hubspot_owner_id": "41629779" } }
```

## Calculation Formula Syntax

- **Operators:** `+`, `-`, `*`, `/`, `<`, `>`, `<=`, `>=`, `=`, `!=`, `or`, `and`, `not`
- **Functions:** `max()`, `min()`, `is_present()`, `contains()`, `concatenate()`, `number_to_string()`, `string_to_number()`
- **Conditionals:** `if condition then value [elseif ...] [else value] endif`
- **Case-sensitive** on property names and string literals; operators/functions are case-insensitive.

## Best Practices

- Use property groups to organize custom properties and signal their integration origin.
- Create unique identifier properties (`hasUniqueValue: true`) for external system IDs—enables `idProperty` lookups.
- Prefer `enumeration` type with `select` for controlled vocabularies.
- Use `dataSensitivity=sensitive` query param to include sensitive properties (Enterprise only).
- Discover available properties via `GET /crm/v3/properties/{objectType}` before building integrations.

## Anti-patterns

- Creating `string/text` properties for data that should be enumerated—loses reporting power.
- Using display names instead of internal names when setting enumeration values.
- Setting `date` properties with a non-midnight timestamp—causes off-by-one date display in UI.
- Creating calculation properties via the API and expecting to edit them in the HubSpot UI (not possible).

## Key Notes

- **Max 10 unique value properties** per object type.
- **Calculation properties** created via API can only be modified via API, not the HubSpot UI.
- **Property groups** are organizational only—they do not affect API behavior.
- **Required fields for creation:** `groupName`, `name`, `label`, `type`, `fieldType`.
- **Sensitive properties** are hidden by default in list responses; pass `dataSensitivity=sensitive` to include them.
