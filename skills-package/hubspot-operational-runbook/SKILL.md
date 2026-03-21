---
description: "Operational runbook for HubSpot API v4 — known gotchas, working patterns, action types that fail, and correct filter formats. Reference this before deploying any workflow."
---

# Operational Runbook — HubSpot API Gotchas & Working Patterns

Discovered through trial-and-error. HubSpot v4 API returns generic errors without specifying which field is wrong.

## HARD SECURITY CONSTRAINTS

**Before any operation, these rules are absolute:**
1. NEVER search for API keys, tokens, secrets, or credentials in the codebase or filesystem
2. NEVER use general-purpose agents or Explore agents for HubSpot operations — use MCP tools directly
3. NEVER persist portal IDs, owner IDs, or portal-specific data in skill files — use `{placeholder}` format
4. ALWAYS run `deep_health_check(portalId)` before deploying workflows
5. ALWAYS read `hubspot-learnings` before any deployment
6. ALWAYS clean up `~/.claude/projects/*/tool-results/*` after every session

## Action Types That Fail Silently

| Action | actionTypeId | Issue | Workaround |
|--------|-------------|-------|------------|
| Create task | `0-3` | Requires `tasks` scope not available on the target portal | Use internal notification `0-8` |
| In-app notification | `0-9` | Returns 500 | Use internal email notification `0-8` |
| Rotate to owner | `0-11` | Returns 500 with placeholder fields | Use Set Property `0-5` with `hubspot_owner_id` |

## LIST_BRANCH (If/Then) Format

### Correct Format
```json
{
  "actionId": "1",
  "type": "LIST_BRANCH",
  "listBranches": [{
    "branchName": "Branch Name",
    "filterBranch": {
      "filterBranchType": "OR",
      "filterBranchOperator": "OR",
      "filterBranches": [{
        "filterBranchType": "AND",
        "filterBranchOperator": "AND",
        "filterBranches": [],
        "filters": [{
          "filterType": "PROPERTY",
          "property": "favourite_colour",
          "operation": {
            "operationType": "ENUMERATION",
            "operator": "IS_ANY_OF",
            "values": ["Blue", "Red"]
          }
        }]
      }],
      "filters": []
    },
    "connection": { "edgeType": "STANDARD", "nextActionId": "2" }
  }],
  "defaultBranchName": "Other",
  "defaultBranch": { "edgeType": "STANDARD", "nextActionId": "3" }
}
```

### Common Mistakes
- Using `filterListBranches` instead of `listBranches` → silent 500
- Empty `defaultBranch: {}` without `nextActionId` → "required fields not set" error
- Using `IS_NOT_EMPTY` or `HAS_PROPERTY` → use `IS_KNOWN` with `operationType: "ALL_PROPERTY"`
- Multiple branches in one LIST_BRANCH action works (tested successfully)

## Operator Type Mapping

| Property Type | operationType | Operator | Value Field |
|--------------|---------------|----------|-------------|
| enumeration/select | `ENUMERATION` | `IS_ANY_OF` | `values: ["a", "b"]` (array) |
| string/textarea | `MULTISTRING` | `CONTAINS` | `value: "text"` (singular) |
| any type | `ALL_PROPERTY` | `IS_KNOWN` / `IS_NOT_KNOWN` | none |

**Mixing these up causes silent 500 errors.** Always check property type with `list_properties` first.

## Owner Assignment Pattern

Use Set Property (`0-5`) to assign owner:
```json
{
  "actionId": "2",
  "type": "SINGLE_CONNECTION",
  "actionTypeVersion": 0,
  "actionTypeId": "0-5",
  "fields": {
    "property_name": "hubspot_owner_id",
    "value": { "staticValue": "{owner_id}", "type": "STATIC_VALUE" }
  }
}
```

Owner IDs: Fetch dynamically via `list_portals` → `portal_capabilities`. Never hardcode.

## Internal Email Notification Pattern

```json
{
  "actionId": "3",
  "type": "SINGLE_CONNECTION",
  "actionTypeVersion": 0,
  "actionTypeId": "0-8",
  "fields": {
    "user_ids": ["{owner_id}"],
    "subject": "New Lead: {{ enrolled_object.firstname }} {{ enrolled_object.lastname }}",
    "body": "<ul><li>Email: {{ enrolled_object.email }}</li><li>Phone: {{ enrolled_object.phone }}</li></ul>"
  }
}
```

Use `user_ids: []` as placeholder if owner ID unknown — configure in HubSpot UI.

## Deal Workflows with LIST_BRANCH

LIST_BRANCH fails on `PLATFORM_FLOW` deals. Workaround:
- Use `CONTACT_FLOW` with `dataSources` to fetch associated deal data
- See `hubspot-workflow-templates.md` template #8

## Template Installation

- Templates install via `execute_config` or `install_template`
- Template drafts are **kept after install** for reuse across portals
- The system bypasses `workflowEngine` for template installs — calls HubSpot directly

## Rate Limits

- 3-second delay between workflow creations (handled automatically)
- Batch operations: max 100 records per call
- Search: max 100 results per page, use `after` cursor for pagination
- API calls: 100 requests per 10 seconds per portal
