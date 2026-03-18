---
description: "Portal-specific configuration for Vero HubSpot Operator. Contains owner IDs, naming conventions, known limitations, and deployment rules. Reference this at the start of every HubSpot session."
---

# Vero HubSpot Operator — Portal Configuration

## Architecture

MCP Server → Railway App API → HubSpot. Never call HubSpot directly.

## Portal: 45609142

| Person | Owner ID | Role |
|--------|----------|------|
| Marcus Torrisi | 551898020 | Blue/Red colour leads |
| Pietro | 86844231 | Purple/Green colour leads |

## Naming Conventions

- **Workflows:** Always prefix with `[VD]` (e.g., `[VD] Lead Router`)
- **Pipelines:** Auto-prefixed by the system — don't add `[VD]` yourself
- **Attribution:** All changes logged with `initiatedBy: "VeroDigital"`

## Known Portal Limitations

- `tasks` scope is **not available** via API — cannot use Create Task action (`0-3`) in workflows. Use internal email notification (`0-8`) as alternative.
- No `delete_workflow` MCP tool — delete workflows manually in HubSpot UI.
- `Rotate to owner` (`0-11`) and `In-app notification` (`0-9`) cause silent 500 errors — avoid in workflow deployments.

## Workflow Deployment Rules

1. Always deploy with `isEnabled: false`
2. `nextAvailableActionId` must be a **string**, equals highest actionId + 1
3. LIST_BRANCH uses `listBranches` (NOT `filterListBranches`)
4. `defaultBranch` must include `nextActionId` — empty `{}` causes 500
5. ENUMERATION fields use `values: []` (array). MULTISTRING fields use `value:` (singular).
6. Match `operationType` to property type: enumeration → `ENUMERATION`, string → `MULTISTRING`
7. 3-second delay between workflow creations to avoid rate limits
8. Wrap filters in OR → AND → filters hierarchy, even for single conditions
