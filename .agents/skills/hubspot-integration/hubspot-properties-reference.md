# HubSpot Properties API v3 Reference

Properties define data fields on CRM objects. This API manages custom properties, property groups, validation rules, and field type configurations. Properties are shared across all records of a given object type.

## 1. Required Scopes

| Object | Read | Write |
|--------|------|-------|
| Contacts | `crm.schemas.contacts.read` | `crm.schemas.contacts.write` |
| Companies | `crm.schemas.companies.read` | `crm.schemas.companies.write` |
| Deals | `crm.schemas.deals.read` | `crm.schemas.deals.write` |
| Tickets | `crm.schemas.deals.read` | `crm.schemas.deals.write` |
| Custom objects | `crm.schemas.custom.read` | `crm.schemas.custom.write` |

## 2. Endpoints

### Single Property CRUD

| Method | Path | Description |
|--------|------|-------------|
| GET | `/crm/v3/properties/{objectType}` | List all properties |
| GET | `/crm/v3/properties/{objectType}/{propertyName}` | Get single property |
| POST | `/crm/v3/properties/{objectType}` | Create property |
| PATCH | `/crm/v3/properties/{objectType}/{propertyName}` | Update property |
| DELETE | `/crm/v3/properties/{objectType}/{propertyName}` | Archive property |

### Batch Operations

| Method | Path | Description |
|--------|------|-------------|
| POST | `/crm/v3/properties/{objectType}/batch/create` | Batch create properties |
| POST | `/crm/v3/properties/{objectType}/batch/read` | Batch read properties |
| POST | `/crm/v3/properties/{objectType}/batch/archive` | Batch archive properties |

### Property Groups

| Method | Path | Description |
|--------|------|-------------|
| GET | `/crm/v3/properties/{objectType}/groups` | List all groups |
| GET | `/crm/v3/properties/{objectType}/groups/{groupName}` | Get single group |
| POST | `/crm/v3/properties/{objectType}/groups` | Create group |
| PATCH | `/crm/v3/properties/{objectType}/groups/{groupName}` | Update group |
| DELETE | `/crm/v3/properties/{objectType}/groups/{groupName}` | Archive group |

### Validation Rules (Nov 2025)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/crm/v3/properties/{objectType}/{propertyName}/rules` | Get validation rules |
| PUT | `/crm/v3/properties/{objectType}/{propertyName}/rules` | Set validation rules |
| DELETE | `/crm/v3/properties/{objectType}/{propertyName}/rules/{ruleType}` | Delete a rule |

**Note:** To update property *values* on records, use `PATCH /crm/v3/objects/{objectType}/{recordId}`.

## 3. Property type + fieldType Combinations

| `type` | Valid `fieldType` values | Notes |
|--------|--------------------------|-------|
| `string` | `text`, `textarea`, `file`, `html`, `phonenumber`, `calculation_equation` | Max 65,536 chars |
| `number` | `number`, `calculation_equation` | Decimals supported |
| `date` | `date` | `YYYY-MM-DD`, always UTC midnight |
| `datetime` | `date` | Full ISO 8601 with timezone |
| `enumeration` | `select`, `radio`, `checkbox`, `booleancheckbox`, `calculation_equation` | Predefined options required |
| `bool` | `booleancheckbox`, `calculation_equation` | True/false only |
| `object_coordinates` | `text` | Internal/read-only |
| `json` | `text` | Internal/read-only |

## 4. Create Property — Full Request Format

Required fields: `name`, `label`, `groupName`, `type`, `fieldType`.

```json
{
  "name": "favorite_food",
  "label": "Favorite Food",
  "groupName": "contactinformation",
  "type": "string",
  "fieldType": "text",
  "description": "The contact's favorite food",
  "displayOrder": 1,
  "hasUniqueValue": false,
  "hidden": false,
  "formField": true,
  "options": []
}
```

### Create with unique value (for external system IDs)

```json
{
  "name": "system_a_unique",
  "label": "Unique ID for System A",
  "groupName": "dealinformation",
  "type": "string",
  "fieldType": "text",
  "hasUniqueValue": true
}
```

### Create enumeration property

```json
{
  "name": "priority_level",
  "label": "Priority Level",
  "groupName": "dealinformation",
  "type": "enumeration",
  "fieldType": "select",
  "options": [
    { "label": "High", "value": "high", "displayOrder": 0 },
    { "label": "Medium", "value": "medium", "displayOrder": 1 },
    { "label": "Low", "value": "low", "displayOrder": 2 }
  ]
}
```

## 5. Property Group Management

Groups are organizational only — they do not affect API behavior.

### Create group

```json
POST /crm/v3/properties/{objectType}/groups
{
  "name": "my_integration_group",
  "label": "My Integration",
  "displayOrder": 1
}
```

### Update group

```json
PATCH /crm/v3/properties/{objectType}/groups/{groupName}
{
  "label": "Updated Label",
  "displayOrder": 2
}
```

Archiving a group does NOT archive its properties — they move to the default group.

## 6. Calculation Properties Syntax

fieldType must be `calculation_equation`. Set the formula via `calculationFormula`.

```json
{
  "name": "days_open",
  "label": "Days Open",
  "groupName": "dealinformation",
  "type": "number",
  "fieldType": "calculation_equation",
  "calculationFormula": "closed - started"
}
```

### Literals

- String: `\"hello\"`
- Number: `42`, `3.14`
- Boolean: `true`, `false`

### Property variables

Reference other properties by internal name: `property_name`

### Operators

| Category | Operators |
|----------|-----------|
| Arithmetic | `+`, `-`, `*`, `/` |
| Comparison | `<`, `>`, `<=`, `>=`, `=`, `!=` |
| Logical | `and`, `or`, `not` |
| String | `&` (concatenation) |

### Functions

| Function | Description |
|----------|-------------|
| `max(a, b)` | Maximum of two values |
| `min(a, b)` | Minimum of two values |
| `is_present(prop)` | Returns true if property has a value |
| `contains(string, substring)` | String contains check |
| `concatenate(a, b, ...)` | Join strings |
| `number_to_string(num)` | Convert number to string |
| `string_to_number(str)` | Convert string to number |

### Conditionals

```
if condition then value
elseif condition then value
else value
endif
```

**Case sensitivity:** Property names and string literals are case-sensitive. Operators and functions are case-insensitive.

## 7. Enumeration Options Format

Options array on `enumeration` type properties:

```json
{
  "options": [
    { "label": "Display Label", "value": "internal_value", "displayOrder": 0, "hidden": false },
    { "label": "Another Option", "value": "another", "displayOrder": 1, "hidden": false }
  ]
}
```

### Limits

| Limit | Value |
|-------|-------|
| Max options per property | 5,000 or 512 KB total payload (whichever is reached first) |
| Max chars per option label/value | 3,000 |

When updating options on PATCH, you must send the full options array. Omitted options are removed.

## 8. Validation Rules API (Nov 2025)

Set constraints that HubSpot enforces on property values at write time.

### ruleType values

| ruleType | Applies to | Description |
|----------|------------|-------------|
| `MIN_LENGTH` | string | Minimum character length |
| `MAX_LENGTH` | string | Maximum character length |
| `MIN_VALUE` | number | Minimum numeric value |
| `MAX_VALUE` | number | Maximum numeric value |
| `REGEX` | string | Regex pattern the value must match |

### Set validation rules

```json
PUT /crm/v3/properties/{objectType}/{propertyName}/rules
{
  "rules": [
    { "ruleType": "MIN_LENGTH", "value": "5" },
    { "ruleType": "MAX_LENGTH", "value": "100" },
    { "ruleType": "REGEX", "value": "^[A-Z]{2}-\\d{4}$" }
  ]
}
```

### Delete a single rule

```
DELETE /crm/v3/properties/{objectType}/{propertyName}/rules/{ruleType}
```

## 9. Sensitive Data Properties (Enterprise Only)

Properties with `dataSensitivity: "sensitive"` are hidden from default list responses.

- Pass query param `dataSensitivity=sensitive` on GET endpoints to include them
- Requires Enterprise tier
- Used for PII and GDPR-sensitive fields

```
GET /crm/v3/properties/contacts?dataSensitivity=sensitive
```

## 10. Property Limits

| Limit | Value |
|-------|-------|
| Custom properties per object (paid) | 1,000 |
| Custom properties per object (free) | 10 |
| Unique value properties per object | 10 |
| Max string property length | 65,536 chars |
| Max options per enumeration | 5,000 or 512 KB |
| Max chars per option | 3,000 |

## 11. Key Notes

- **Calculation properties** created via API can only be modified via API — they cannot be edited in the HubSpot UI.
- **Archived properties** are retained for 90 days and can be restored. After 90 days, they are permanently deleted.
- **Boolean validation enforcement:** `bool` / `booleancheckbox` properties enforce `true` or `false` values. Passing other values returns a validation error.
- **Required fields for create:** `name`, `label`, `groupName`, `type`, `fieldType`.
- **Property groups** are organizational only and do not affect API behavior.
- Use `hasUniqueValue: true` for external system IDs — enables `idProperty` lookups on record endpoints.
- `date` type properties always store UTC midnight. Setting a non-midnight timestamp causes off-by-one date display in the HubSpot UI.
- Checkbox (multi-select) append syntax: prefix value with `;` (e.g., `";BUDGET_HOLDER;END_USER"`) to append instead of overwrite.
- Clear a property value by setting it to `""`.

## 12. Cross-Reference: Workflows

To set property values via workflows, see `hubspot-workflows-reference.md`. The set property action (`actionTypeId: 0-5`) requires `value: { staticValue, type: "STATIC_VALUE" }` format — not a flat value. **ALWAYS read the workflow reference before creating workflows.**
