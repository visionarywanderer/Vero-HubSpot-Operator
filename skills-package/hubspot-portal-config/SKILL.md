---
description: "Portal-specific configuration for Vero HubSpot Operator. Contains owner IDs, naming conventions, known limitations, and deployment rules. Reference this at the start of every HubSpot session."
---

# Vero HubSpot Operator — Portal Configuration

## Architecture

MCP Server → Railway App API → HubSpot. Never call HubSpot directly.

## Portal Data — ALWAYS Fetch Dynamically

**NEVER hardcode portal IDs, owner IDs, or owner names.** Always fetch at session start:

1. Call `list_portals` → get portal IDs and names
2. Call `portal_capabilities` with portalId → get available scopes and features
3. Call `deep_health_check` with portalId → get action type availability

## Naming Conventions

- **Workflows:** Always prefix with `[VD]` (e.g., `[VD] Lead Router`)
- **Pipelines:** Auto-prefixed by the system — don't add `[VD]` yourself
- **Attribution:** All changes logged with `initiatedBy: "VeroDigital"`

## Known Portal Limitations

- Some portals may lack `tasks` scope — always run `deep_health_check` first. Use internal email notification (`0-8`) as alternative to Create Task (`0-3`).
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
