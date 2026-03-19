# VeroHub HubSpot Operator — Connector Plugin

## What This Is

The VeroHub HubSpot Operator is an MCP connector that lets you manage HubSpot CRM portals. It handles properties, pipelines, workflows, lists, records, associations, and template installations across multiple connected portals.

**Architecture:** Your requests go through this MCP server → Railway App API → HubSpot. You never call HubSpot directly.

## Getting Started

**Always start by listing portals:**
```
list_portals → get available portals and their IDs
```
Then pass `portalId` to every subsequent tool call. Never assume which portal is active.

## Available Tools — Quick Reference

### Portal Management
| Tool | Use When |
|------|----------|
| `list_portals` | First call in any session — get portal IDs |
| `portal_capabilities` | Check what scopes/features a portal has |
| `activity_log` | See recent changes made to a portal |

### Properties
| Tool | Use When |
|------|----------|
| `list_properties` | See all properties for contacts/companies/deals/tickets |
| `create_property` | Add a custom property |
| `update_property` | Modify label, options, group of existing property |
| `delete_property` | Archive a custom property |
| `audit_properties` | Find unused/low-fill properties to clean up |

### Pipelines
| Tool | Use When |
|------|----------|
| `list_pipelines` | See deal or ticket pipelines |
| `create_pipeline` | Create a new pipeline with stages |
| `audit_pipelines` | Check for missing Closed Won/Lost, too many/few stages |

### CRM Records
| Tool | Use When |
|------|----------|
| `get_record` | Fetch a single contact/company/deal/ticket by ID |
| `search_records` | Find records matching filters |
| `create_record` | Create a single record |
| `update_record` | Update a single record |
| `batch_upsert_records` | Create/update up to 100 records (use `email` as dedup key for contacts) |

### Associations
| Tool | Use When |
|------|----------|
| `create_association` | Link two records (e.g., contact → company) |
| `batch_create_associations` | Link up to 2,000 record pairs at once |

### Lists & Segments
| Tool | Use When |
|------|----------|
| `list_lists` | See all static and dynamic lists |
| `create_list` | Create a new list with optional filter criteria |

### Workflows
| Tool | Use When |
|------|----------|
| `list_workflows` | See all automation workflows |
| `deploy_workflow` | Create a new workflow (always disabled by default) |
| `save_workflow_draft` | Save workflow spec for review before deploying |

### Templates & Config Engine
| Tool | Use When |
|------|----------|
| `validate_config` | Check a template payload before executing |
| `execute_config` | Install template resources (properties, pipelines, workflows, lists) |
| `install_template` | Install a saved template by ID |
| `save_template_draft` | Save template for later installation |

### Drafts (Save Without Deploying)
| Tool | Use When |
|------|----------|
| `save_pipeline_draft` | Save pipeline spec for review |
| `save_property_draft` | Save property spec for review |
| `save_list_draft` | Save list spec for review |
| `save_custom_object_draft` | Save custom object spec for review |
| `save_script_draft` | Save bulk operation script for review |

## Critical Rules

### 1. Always Pass portalId
Every tool that modifies data requires `portalId`. Get it from `list_portals` first.

### 2. Pipeline Names Get `[VD]` Prefix
All pipelines created through this connector are automatically prefixed with `[VD]`. Don't add it yourself — the system handles it.

### 3. Workflows Deploy Disabled
All workflows are created with `isEnabled: false`. Users enable them manually in HubSpot after review.

### 4. Attribution
All changes are logged with `initiatedBy: "VeroDigital"` for audit trail.

### 5. Batch Over Individual
If operating on more than 3 records, use `batch_upsert_records` instead of individual `create_record`/`update_record` calls.

### 6. Data Privacy
Never store portal IDs, owner IDs, owner names, or any client PII in skills, memories, or CLAUDE.md. All examples in this connector use `{portal_id}` and `{owner_id}` as placeholders. When adding new patterns, always sanitize real data before persisting.

## Workflow Creation Rules (CRITICAL)

When creating workflows via `deploy_workflow`, follow these rules exactly:

### LIST_BRANCH (If/Then) Rules
- **Multiple branches supported** — a single LIST_BRANCH action can contain multiple `listBranches` entries (tested and confirmed working).
- **No Create task (`0-3`)** inside LIST_BRANCH — use notification (`0-8`) or set property (`0-5`) instead.
- **Always include `includeObjectsWithNoValueSet: false`** in filter operations.

### Deal Workflows
- **Use CONTACT_FLOW + dataSources** instead of PLATFORM_FLOW for deal-based workflows with LIST_BRANCH.
- Add `dataSources` array to fetch deal data:
```json
{
  "type": "CONTACT_FLOW",
  "objectTypeId": "0-1",
  "dataSources": [{"type": "ASSOCIATED_OBJECTS", "objectTypeId": "0-3"}]
}
```

### Filter Structure
Always wrap filters in OR → AND → filters hierarchy:
```json
{
  "filterBranchType": "OR",
  "filterBranches": [{
    "filterBranchType": "AND",
    "filters": [{
      "property": "dealstage",
      "operation": { "operator": "IS_ANY_OF", "values": ["closedwon"], "includeObjectsWithNoValueSet": false }
    }]
  }]
}
```

### Workflow Operators by Property Type
| Property Type | Operator | Value Field |
|--------------|----------|-------------|
| String/text | `MULTISTRING CONTAINS` | `value` (singular) |
| Enumeration | `ENUMERATION IS_ANY_OF` | `values` (array) |
| Number | `NUMBER IS_BETWEEN` | `value`, `highValue` |
| Date | `DATE IS_AFTER` | `value` (timestamp) |
| Boolean | `BOOLEAN IS_EQUAL_TO` | `value` |

### Action ID Format
- `actionId` must be a string (e.g., `"1"`, `"2"`)
- `nextAvailableActionId` must be a string equal to highest actionId + 1
- `startActionId` is the first action's ID (usually `"1"`)

### Rate Limiting
Add 3-second delay between workflow creations. The `deploy_workflow` tool handles this automatically.

## Common Shortcuts

### "Set up a new client portal"
1. `list_portals` — find the portal
2. `install_template` with a standard template — creates properties, pipelines, workflows
3. `audit_pipelines` — verify pipeline structure
4. `audit_properties` — verify property setup

### "Create a deal pipeline"
```
create_pipeline with objectType: "deals", label: "My Pipeline", stages: [
  { label: "Discovery", displayOrder: 0 },
  { label: "Proposal", displayOrder: 1, metadata: { probability: "0.4" } },
  { label: "Negotiation", displayOrder: 2, metadata: { probability: "0.7" } },
  { label: "Closed Won", displayOrder: 3, metadata: { isClosed: "true", closedWon: "true", probability: "1.0" } },
  { label: "Closed Lost", displayOrder: 4, metadata: { isClosed: "true", closedWon: "false", probability: "0.0" } }
]
```
Note: Pipeline will be auto-prefixed to `[VD] My Pipeline`.

### "Audit a portal"
1. `audit_properties` for contacts, companies, deals
2. `audit_pipelines` for deals and tickets
3. `activity_log` for recent changes

### "Bulk update contacts"
```
batch_upsert_records with objectType: "contacts", idProperty: "email", records: [
  { email: "john@example.com", firstname: "John", lastname: "Doe" },
  { email: "jane@example.com", firstname: "Jane", lastname: "Smith" }
]
```

### "Search for records"
```
search_records with objectType: "contacts", filters: [
  { propertyName: "email", operator: "CONTAINS_TOKEN", value: "*@company.com" }
], properties: ["email", "firstname", "lastname", "lifecyclestage"]
```

## Property Creation Reference

### Required Fields
| Field | Description |
|-------|-------------|
| `objectType` | contacts, companies, deals, tickets |
| `name` | Internal name (lowercase, underscores) |
| `label` | Display label |
| `type` | string, number, date, datetime, bool, enumeration |
| `fieldType` | text, textarea, number, select, radio, checkbox, date, booleancheckbox, phonenumber |

### Type + FieldType Combinations
| type | fieldType | Use |
|------|-----------|-----|
| string | text | Short text |
| string | textarea | Long text |
| number | number | Numeric values |
| enumeration | select | Dropdown single-select |
| enumeration | radio | Radio buttons |
| enumeration | checkbox | Multi-checkbox |
| date | date | Date picker |
| bool | booleancheckbox | Yes/No toggle |
| string | phonenumber | Phone number |

### Enumeration Options Format
```json
{
  "type": "enumeration",
  "fieldType": "select",
  "options": [
    { "label": "Option A", "value": "option_a", "displayOrder": 0 },
    { "label": "Option B", "value": "option_b", "displayOrder": 1 }
  ]
}
```

## Error Handling

- **429 Too Many Requests** — the app handles rate limiting with exponential backoff
- **401 Unauthorized** — portal token may be expired; check `portal_capabilities`
- **409 Conflict** — resource already exists; use update instead of create
- **422 Validation Error** — check field names, types, and required parameters

## Self-Updating Action Patterns

This connector's Workflow Creation Rules section is a living document. When new action field formats, value types, or enrollment patterns are discovered during workflow deployment:

1. The discovering skill (usually `hubspot-workflow-drafts`) flags which format was missing
2. Update the relevant section of this connector with the new pattern
3. Include a dated comment noting when and why the pattern was added

**When to update this file:**
- A new action type is used successfully for the first time
- An existing action type requires a field format not currently documented
- A new enrollment criteria pattern is confirmed working
- A workaround is found for a documented limitation

## Object Type IDs

| Object | ID |
|--------|-----|
| Contact | `0-1` |
| Company | `0-2` |
| Deal | `0-3` |
| Note | `0-4` |
| Ticket | `0-5` |
| Product | `0-7` |
| Line Item | `0-8` |
| Custom Objects | `2-XXXXXX` |
