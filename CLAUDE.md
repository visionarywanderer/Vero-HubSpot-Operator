# Vero HubSpot Operator — Claude Instructions

## Session Start Protocol

**Every new session, do these in order:**

1. **Read `hubspot-learnings` skill** — the self-improving knowledge base with all known API patterns and failures. Cross-check against this before ANY deploy/create operation.
2. **Read `hubspot-portal-config` skill** — owner IDs, naming conventions, portal limitations.
3. **Verify data privacy** — if any learnings or skills reference specific portal IDs or owner names, flag them for sanitization.
4. **Route the request** using the skill map below.

## How to Route Requests

| User says... | Skill to invoke | What it does |
|-------------|----------------|--------------|
| Pastes meeting notes or client requirements | `hubspot-meeting-analysis` | Extracts fields, processes, automations → produces structured plan → chains to resource skills |
| "Create a workflow" / "automate X" | `hubspot-workflow-drafts` | Builds v4 workflow spec with branching, actions, enrollment |
| "Create a property" / "add a field" | `hubspot-property-drafts` | Validates type/fieldType, creates property spec |
| "Create a pipeline" / "deal stages" | `hubspot-pipeline-drafts` | Builds pipeline with stages, probabilities, closed stages |
| "Create a list" / "segment contacts" | `hubspot-list-drafts` | Builds dynamic/manual list with filter structure |
| "Bulk update" / "data cleanup" | `hubspot-bulk-drafts` | Generates Node.js script with dry-run, retry, logging |
| "Full CRM setup" / "template" | `hubspot-template-drafts` | Bundles properties + pipelines + workflows + lists |
| Complex multi-resource request | `hubspot-master-orchestrator` | Coordinates multiple skills in dependency order |

## Skill Execution Chain

```
CLAUDE.md (this file — loaded at session start)
  │
  ▼
hubspot-learnings (ALWAYS read first — avoids repeating past mistakes)
  │
  ▼
hubspot-master-orchestrator (routes to the right skill)
  │
  ├─► Meeting notes ──► hubspot-meeting-analysis ──► plan ──► resource skills
  │
  ├─► Single resource ──► property / pipeline / workflow / list / bulk skill
  │
  └─► Full setup ──► hubspot-template-drafts (bundles everything)
      │
      Each resource skill reads:
      ├── hubspot-connector (which MCP tool to call)
      ├── hubspot-operational-runbook (portal-specific gotchas)
      └── hubspot-learnings (past failures to avoid)
```

## Dependency Order (for multi-resource requests)

When creating multiple resources, always follow this order:

```
1. Property Groups  → needed before properties
2. Properties       → needed before workflows, lists
3. Pipelines        → needed before deal-stage workflows
4. Lists            → needed before list-enrollment workflows
5. Workflows        → reference properties, pipelines, lists
6. Bulk Scripts     → run after everything exists
7. Templates        → optional bundle for reuse
```

## Architecture

MCP Server → Railway App API → HubSpot. Never call HubSpot directly.

## Portal Data — ALWAYS Fetch Dynamically

**NEVER hardcode portal IDs, owner IDs, or owner names.** Always fetch at session start:

1. Call `list_portals` → get portal IDs and names
2. Call `portal_capabilities` with portalId → get available scopes and features
3. Call `deep_health_check` with portalId → get action type availability, broken actions, missing scopes

Owner IDs, portal limitations, and scope availability change over time. The app is the source of truth — not these files.

**Privacy rule:** Never persist portal IDs, owner IDs, owner names, or any client data in CLAUDE.md, skills files, or memory files. Use `{portal_id}` and `{owner_id}` placeholders in all documentation examples. After completing work on a portal, state: "No portal-specific data has been persisted."

**Stale data rule:** NEVER reference portal data from earlier in the conversation. Always use the LATEST tool result as the single source of truth. If you called `list_portals` 10 minutes ago and call it again now, ONLY use the new result — the old one is stale. Never state portal counts, IDs, names, owner IDs, or workflow lists from memory — always from the most recent API response.

**Temp data cleanup:** After every successful workflow deploy, template install, or bulk operation, clean up temp files that contain portal data:
```bash
rm -rf ~/.claude/projects/-Users-pietro-Documents-Vero-HubSpot-Operator/*/tool-results/*
```
This prevents portal data from persisting in Claude's temp folders between sessions.

## Naming Conventions

- **Workflows:** Always prefix with `[VD]` (e.g., `[VD] Lead Router`)
- **Pipelines:** Auto-prefixed by the system — don't add `[VD]` yourself
- **Attribution:** All changes logged with `initiatedBy: "VeroDigital"`

## Known General Limitations

- `Rotate to owner` (`0-11`) and `In-app notification` (`0-9`) often cause silent 500 errors — avoid in workflow deployments. Use `0-5` (Set Property on `hubspot_owner_id`) and `0-8` (Internal email) instead.
- No `delete_workflow` MCP tool — delete workflows manually in HubSpot UI.
- Always run `deep_health_check` to verify which action types work on the target portal before deploying workflows.

## Workflow Deployment Rules

1. Always deploy with `isEnabled: false`
2. `nextAvailableActionId` must be a **string**, equals highest actionId + 1
3. LIST_BRANCH uses `listBranches` (NOT `filterListBranches`)
4. `defaultBranch` must include `nextActionId` — empty `{}` causes 500
5. ENUMERATION fields use `values: []` (array). MULTISTRING fields use `value:` (singular).
6. Match `operationType` to property type: enumeration → `ENUMERATION`, string → `MULTISTRING`
7. 3-second delay between workflow creations to avoid rate limits
8. Wrap filters in OR → AND → filters hierarchy, even for single conditions

## Skills Reference

| Skill | Purpose |
|-------|---------|
| `hubspot-learnings` | ⚡ Self-improving — reads before ops, appends after failures |
| `hubspot-connector` | Tool reference — all 35+ MCP tools |
| `hubspot-master-orchestrator` | Routes multi-step requests |
| `hubspot-operational-runbook` | API gotchas and working patterns |
| `hubspot-workflow-drafts` | v4 workflow API, action types, branching |
| `hubspot-property-drafts` | Type/fieldType matrix, validation |
| `hubspot-pipeline-drafts` | Deal/ticket stages, metadata |
| `hubspot-list-drafts` | Filter structure, operators |
| `hubspot-meeting-analysis` | Meeting notes → implementation plan |
| `hubspot-template-drafts` | Bundle multiple resources |
| `hubspot-bulk-drafts` | Data cleanup, mass updates |
| `hubspot-architecture` | Visual data flow diagrams |
| `hubspot-portal-config` | Owner IDs, naming rules, limitations |
| `hubspot-integration` | SDK patterns, OAuth, rate limiting |
| `hubspot-reference-docs` | Full API reference + 12 docs |
