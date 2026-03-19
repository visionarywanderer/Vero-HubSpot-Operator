---
name: hubspot-integration
description: "Expert patterns for HubSpot CRM integration including OAuth authentication, CRM objects, associations, batch operations, webhooks, and custom objects. Covers Node.js and Python SDKs. Use when: hubspot, hubspot api, hubspot crm, hubspot integration, contacts api."
source: vibeship-spawner-skills (Apache 2.0)
---

# HubSpot Integration

## Reference Files

Before performing any HubSpot operation, consult the relevant reference file:

| Task | Reference File |
|------|---------------|
| **Workflows & Automation** | `hubspot-workflows-reference.md` + `hubspot-workflow-templates.md` |
| Contacts CRUD | `hubspot-contacts-reference.md` |
| Deals CRUD | `hubspot-deals-reference.md` |
| Properties management | `hubspot-properties-reference.md` |
| Associations | `hubspot-associations-reference.md` |
| Custom objects | `hubspot-custom-objects-reference.md` |
| OAuth & auth | `hubspot-authentication-and-oauth-reference.md` |
| Webhooks vs polling | `hubspot-webhooks-vs-polling-reference.md` |
| Rate limits | `hubspot-usage-and-limits-reference.md` |
| Anti-patterns | `hubspot-integration-antipatterns-reference.md` |

## Critical Rules

**ALWAYS read the relevant reference file BEFORE attempting any create/update/deploy operation.** Each API has format-specific requirements that cause silent failures if not followed exactly.

### Before Creating Anything
1. **Workflows** → Read `hubspot-workflows-reference.md` + `hubspot-workflow-templates.md`
2. **Properties** → Read `hubspot-properties-reference.md` (type/fieldType combos, required fields, enumeration format)
3. **Records (contacts/deals)** → Read `hubspot-contacts-reference.md` or `hubspot-deals-reference.md` (required properties, batch formats, search operators)
4. **Associations** → Read `hubspot-associations-reference.md` (body is array `[]` not object `{}` for PUT, type IDs are directional)
5. **Pipelines** → Read `hubspot-deals-reference.md` (stage metadata: `probability` is a string, `isClosed` is a string)

### Architecture
The MCP server communicates ONLY with the Railway app API endpoints. It never reads or writes from HubSpot portals directly. Architecture: **MCP → Railway App API → HubSpot**.

### Deploying Changes
All workflows deploy as `isEnabled: false` (disabled drafts). Users configure final details in HubSpot UI and enable manually.

### VeroHub Operator Defaults
- All resources created through the app are attributed to **VeroDigital** (`initiatedBy: "VeroDigital"`)
- Pipeline names are automatically prefixed with **`[VD]`** (e.g., `[VD] Sales Pipeline`)
- Templates are portal-independent — same template can be installed to any connected portal
- Template installs bypass `workflowEngine.deploy()` and `normalizeWorkflowDefaults` — JSON is sent directly to HubSpot API

### Critical Workflow Deployment Rules
1. **Single-branch LIST_BRANCH only** — multi-branch (2+ branches in one action) fails via API; chain single-branch actions instead
2. **No `0-3` (Create task) inside LIST_BRANCH** — use `0-8` (notification) or `0-5` (set property)
3. **Deal workflows → CONTACT_FLOW + dataSources** — LIST_BRANCH fails on PLATFORM_FLOW for deals
4. **3-second delay between workflow creations** — prevents HubSpot rate limiting
5. **Always include `includeObjectsWithNoValueSet: false`** in LIST_BRANCH filter operations

## Patterns

### OAuth 2.0 Authentication
Secure authentication for public apps. See `hubspot-authentication-and-oauth-reference.md`.

### CRM Object CRUD Operations
Create, read, update, delete CRM records. See `hubspot-contacts-reference.md` and `hubspot-deals-reference.md`.

### Workflow Automation
Create, deploy, and manage workflows via v4 API. See `hubspot-workflows-reference.md` for the complete action catalog, branch formats, triggers, and operators. See `hubspot-workflow-templates.md` for ready-to-deploy JSON patterns.

### Associations
Link records across object types. See `hubspot-associations-reference.md`.

### Batch Operations
Process up to 100 records per batch call. See `hubspot-usage-and-limits-reference.md`.

## Anti-Patterns

- Using deprecated API keys instead of OAuth or private app tokens
- Individual requests instead of batch operations
- Polling instead of webhooks for real-time updates
- Creating workflows without reading the workflow reference first
- Attempting to directly compare cross-object properties in workflow branches (use HubSpot UI)
- See `hubspot-integration-antipatterns-reference.md` for the full list
