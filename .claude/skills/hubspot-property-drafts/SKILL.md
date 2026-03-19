---
description: "Create HubSpot property drafts via the app. Use when: user asks to create, add, or save properties, custom fields, or property groups for HubSpot."
---

# HubSpot Property Draft Skill

When asked to create HubSpot properties, generate valid property specs and save them as drafts using the `save_property_draft` MCP tool. The user deploys from the Properties page.

---

## Single Property Spec Format

```yaml
# YAML reference — translate to JSON for the MCP tool
objectType: contacts             # REQUIRED — see Valid Object Types
name: custom_field_name          # REQUIRED — lowercase snake_case, ^[a-z][a-z0-9_]*$, max 64 chars
label: Custom Field Name         # REQUIRED — max 128 chars
type: string                     # REQUIRED — see Type/FieldType Matrix
fieldType: text                  # REQUIRED — must match type
groupName: contactinformation    # REQUIRED — see Common Group Names
description: "What this stores"  # recommended
hasUniqueValue: false            # max 10 unique-value props per object
hidden: false                    # hide from UI
formField: true                  # show on forms
options: []                      # REQUIRED for type=enumeration, forbidden otherwise
```

## JSON Example — Single Property

```json
{
  "objectType": "contacts",
  "name": "lead_source_detail",
  "label": "Lead Source Detail",
  "type": "enumeration",
  "fieldType": "select",
  "groupName": "contactinformation",
  "description": "Detailed attribution for lead source",
  "hasUniqueValue": false,
  "hidden": false,
  "formField": true,
  "options": [
    { "label": "Google Ads", "value": "google_ads", "displayOrder": 0 },
    { "label": "LinkedIn Ads", "value": "linkedin_ads", "displayOrder": 1 },
    { "label": "Organic Search", "value": "organic_search", "displayOrder": 2 },
    { "label": "Referral", "value": "referral", "displayOrder": 3 },
    { "label": "Direct", "value": "direct", "displayOrder": 4 }
  ]
}
```

## JSON Example — Multi-Property Batch

```json
{
  "objectType": "contacts",
  "properties": [
    {
      "name": "annual_contract_value",
      "label": "Annual Contract Value",
      "type": "number",
      "fieldType": "number",
      "groupName": "sales_properties",
      "description": "Total annual contract value in USD"
    },
    {
      "name": "renewal_date",
      "label": "Renewal Date",
      "type": "date",
      "fieldType": "date",
      "groupName": "sales_properties",
      "description": "Next contract renewal date"
    },
    {
      "name": "is_champion",
      "label": "Is Champion",
      "type": "bool",
      "fieldType": "booleancheckbox",
      "groupName": "sales_properties",
      "description": "Whether this contact is an internal champion"
    }
  ]
}
```

---

## Type / FieldType Matrix (Complete)

| type | Valid fieldType values | Notes |
|---|---|---|
| `string` | `text`, `textarea`, `phonenumber`, `file`, `html`, `calculation_equation` | Max 65,536 chars. Default: `text` |
| `number` | `number`, `calculation_equation` | `calculation_equation` requires formula syntax |
| `datetime` | `date` | Stores date AND time (epoch ms or ISO 8601) |
| `date` | `date` | Stores date only (YYYY-MM-DD) |
| `bool` | `booleancheckbox`, `calculation_equation` | Values: `"true"` / `"false"` as strings |
| `enumeration` | `select`, `radio`, `checkbox`, `booleancheckbox`, `calculation_equation` | MUST include `options` array (max 500 options) |
| `object_coordinates` | `text` | **READ-ONLY** — cannot be created via API |
| `json` | `text` | **READ-ONLY** — cannot be created via API |

**CRITICAL**: Mismatched `type`/`fieldType` causes a 400 error. Always cross-reference this table.

---

## Critical Rules (Pre-flight Checklist)

| # | Rule | Error if violated |
|---|------|------------------|
| 1 | `name` must be lowercase snake_case: `^[a-z][a-z0-9_]*$` | 400: invalid property name |
| 2 | `name` max 64 characters | 400: name too long |
| 3 | `label` max 128 characters | 400: label too long |
| 4 | `type` and `fieldType` must match per matrix above | 400: invalid fieldType for type |
| 5 | `enumeration` type MUST include `options` array | 400: options required |
| 6 | Non-enumeration types MUST NOT include `options` | 400: unexpected field |
| 7 | Each option needs `label`, `value`, `displayOrder` | 400: missing option fields |
| 8 | Option `value` must be lowercase, no spaces: `^[a-z0-9_]+$` | 400: invalid option value |
| 9 | Reserved names cannot be used: `id`, `createdate`, `lastmodifieddate`, `hs_object_id` | 409: property already exists |
| 10 | Names starting with `hs_` or `hubspot_` are reserved for HubSpot | 400: reserved prefix |
| 11 | Max 10 `hasUniqueValue: true` properties per object type | 400: unique value limit |
| 12 | `groupName` must reference an existing group | 400: group not found |
| 13 | `calculation_equation` properties cannot be edited in HubSpot UI after creation | No error, but user warning |
| 14 | Property `name` and `type` are IMMUTABLE after creation | Cannot rename — choose carefully |
| 15 | Max 500 options per enumeration property | 400: too many options |
| 16 | Max string value length: 65,536 characters | Truncation or error |
| 17 | Custom property limits: Free=10, Starter/Pro/Enterprise=1,000 per object | 400: limit exceeded |

---

## Valid Object Types

```
contacts, companies, deals, tickets, line_items, products,
quotes, calls, emails, meetings, notes, tasks
```

## Common Group Names

| Object Type | Built-in Groups |
|---|---|
| `contacts` | `contactinformation`, `sales_properties`, `conversion_information` |
| `companies` | `companyinformation` |
| `deals` | `dealinformation` |
| `tickets` | `ticketinformation` |

**TIP**: To create a custom group, use the app's property group creation feature first, or include `propertyGroups` in a template spec.

---

## Property Value Formats (for reference in workflows/bulk scripts)

| Type | API Format | Example |
|---|---|---|
| `string` | Plain string | `"hello world"` |
| `number` | Numeric string | `"42.5"` |
| `datetime` | Unix timestamp (ms) | `"1679529600000"` |
| `date` | `YYYY-MM-DD` | `"2026-03-17"` |
| `bool` | `"true"` or `"false"` | `"true"` |
| `enumeration` (select/radio) | Single value string | `"option_a"` |
| `enumeration` (checkbox) | Semicolon-separated | `"opt_a;opt_b;opt_c"` |

---

## Troubleshooting Guide

| Error | Cause | Fix |
|---|---|---|
| `Property already exists` (409) | Name collision with existing or archived property | Use a unique name or unarchive existing property |
| `Invalid property name` (400) | Name has uppercase, spaces, or special chars | Use lowercase snake_case only |
| `Group not found` (400) | `groupName` doesn't match any existing group | Use a standard group name or create the group first |
| `Invalid fieldType for type` (400) | Mismatched type/fieldType | Cross-reference the Type/FieldType Matrix |
| `Options required` (400) | Enumeration type without `options` array | Add options array with label/value/displayOrder |
| `Property is read-only` (400) | Trying to modify a HubSpot-defined property | Cannot modify `hs_*` properties — create a custom alternative |
| `Unique value limit exceeded` (400) | More than 10 `hasUniqueValue` properties | Set `hasUniqueValue: false` or remove from another property |

---

## Alternative Approaches

| Goal | Option A (recommended) | Option B (alternative) |
|---|---|---|
| Dropdown with <10 options | `enumeration` + `select` | `enumeration` + `radio` for visibility |
| Multi-select | `enumeration` + `checkbox` | Multiple boolean properties if options change |
| Yes/No field | `bool` + `booleancheckbox` | `enumeration` + `radio` with Yes/No options |
| Long text | `string` + `textarea` | `string` + `html` if rich formatting needed |
| Calculated value | `number` + `calculation_equation` | Workflow to compute and set property |
| Phone number | `string` + `phonenumber` | `string` + `text` if no formatting needed |
| File attachment | `string` + `file` | External URL in `string` + `text` |

---

## Procedure

1. **⚡ FIRST: Read `hubspot-learnings` skill** — cross-check your planned spec against ALL known patterns and failures. Do NOT skip this step.
2. **Portal check**: Call `list_portals` to identify connected portals. If multiple portals exist, ask the user which one to target. Pass `portalId` to every subsequent MCP tool call.
3. Ask the user what properties they need if not clear
4. **Duplicate check**: Call `list_properties` MCP tool (with `portalId`) for the target `objectType` to see what already exists in the portal. Compare your planned property `name` values against existing ones. If an exact match exists, tell the user and ask whether to skip, update, or create with a different name.
5. Determine: object type, property type, field type (use Matrix)
6. For enumeration types, define options with `label`/`value`/`displayOrder`
7. Validate option `value` strings: lowercase, no spaces, `^[a-z0-9_]+$`
8. **Pre-flight check**: Verify ALL critical rules from the checklist AND cross-check against `hubspot-learnings` quick reference
9. Build the spec with all required fields
10. Call `save_property_draft` MCP tool with the spec — the tool will also check for duplicate drafts and portal conflicts, returning warnings if found
11. If the tool returns `warning_portal_duplicates`, stop and inform the user before continuing
12. Tell the user to deploy from the Properties page
13. If creating multiple properties, use the multi-property batch format
14. If deploy fails, match error against Troubleshooting Guide, fix, AND **append the new failure pattern to `hubspot-learnings`**
