---
description: "Master orchestrator for all HubSpot skills. Use when: user has a complex or multi-step HubSpot request that spans multiple resource types (properties AND workflows, pipeline AND lists, full CRM setup, meeting notes to execution, or any request that requires coordinating across properties, pipelines, workflows, lists, bulk operations, and templates)."
---

# HubSpot Master Orchestrator

This is the central coordinator for the Vero HubSpot Operator skill system. It routes requests to the right skill(s), manages execution order, resolves dependencies, and ensures every resource is valid before saving.

**Use this skill when a request touches more than one resource type, or when the user needs end-to-end execution from planning to drafting.**

---

## CRITICAL: Portal Isolation Rules

**Every operation MUST be portal-scoped. Never mix resources across portals.**

1. **First action in EVERY session**: Call `list_portals` to see all connected portals
2. **If multiple portals exist**: Ask the user which portal they want to work with. Show portal names, Hub IDs, and environments (production vs sandbox)
3. **Store the chosen portalId** and pass it to EVERY subsequent MCP tool call — never omit it
4. **Never assume a default portal** when multiple are connected — the MCP server will error if you try
5. **When the user says a portal name** (e.g. "Acme Corp"), match it against the portal list and confirm before proceeding
6. **Drafts are portal-scoped**: A draft saved for Portal A will only be visible and deployable for Portal A
7. **If the user switches context** to a different portal mid-conversation, call `list_portals` again and confirm the new target

---

## Data Privacy Rules

**Portal data MUST NOT persist in Claude's context between sessions.** The app (Railway middleware) is the authorized store for portal data. Claude's skills, memories, and CLAUDE.md are NOT authorized stores.

### What MUST NOT be stored in skills, memories, or CLAUDE.md:
- Portal IDs (Hub IDs like `12345678`)
- Owner IDs (numeric HubSpot user IDs)
- Owner names or any person names associated with portals
- Contact names, email addresses, phone numbers, or any PII from portal records
- API keys, OAuth tokens, or any credentials
- Company names associated with specific portal configurations

### What CAN be stored:
- Generic API patterns with placeholder values (`{portal_id}`, `{owner_id}`)
- Error patterns and fixes with sanitized examples
- Structural rules (field formats, type mappings, filter hierarchies)
- Action type references and their required fields

### Rules for learnings entries:
- Use `{portal_id}`, `{owner_id}`, `{owner_name}` as placeholders — never real values
- Describe portals generically: "a portal", "the target portal" — never by Hub ID
- JSON examples must use placeholder values, not real data

### After completing work on a portal:
- State: "No portal-specific data has been persisted to skills or memory."
- If a learnings entry was added, verify it uses placeholders before saving

### Stale data prevention:
- NEVER reference portal data from earlier in the conversation — always use the LATEST tool result
- If `list_portals` was called earlier and returns different results now, ONLY use the new result
- Never state portal counts, IDs, names, workflows, or properties from conversation memory — always re-fetch
- Treat every MCP tool response as the single source of truth, discarding any prior knowledge from the same session

---

## Skill Catalog

| Skill | File | Trigger Phrases | MCP Tool |
|---|---|---|---|
| Meeting Analysis | `hubspot-meeting-analysis.md` | "meeting notes", "client call", "discovery notes", "analyse requirements" | — (produces plan) |
| Property Drafts | `hubspot-property-drafts.md` | "create property", "add field", "custom field" | `save_property_draft` |
| Pipeline Drafts | `hubspot-pipeline-drafts.md` | "create pipeline", "deal stages", "ticket pipeline" | `save_pipeline_draft` |
| Workflow Drafts | `hubspot-workflow-drafts.md` | "create workflow", "automation", "when X happens do Y" | `save_workflow_draft` |
| List Drafts | `hubspot-list-drafts.md` | "create list", "segment", "audience", "filter contacts" | `save_list_draft` |
| Bulk Script Drafts | `hubspot-bulk-drafts.md` | "bulk update", "mass change", "data cleanup", "import" | `save_script_draft` |
| Template Drafts | `hubspot-template-drafts.md` | "CRM template", "full setup", "RevOps template" | `save_template_draft` |

---

## Routing Logic

### Step 1: Classify the Request

Read the user's message and classify it:

| If the request contains... | Route to... |
|---|---|
| Meeting notes, call notes, client requirements (pasted text) | **Meeting Analysis** → then chain to resource skills |
| Single resource type (just properties, just a pipeline, etc.) | **Directly to that resource skill** |
| Multiple resource types mentioned together | **This orchestrator** — plan then execute in order |
| "Full CRM setup", "complete template", "RevOps setup" | **Meeting Analysis** (for plan) → **Template Skill** (for bundle) |
| "Clone portal", "copy config" | Direct to clone tools |
| Question about existing config | Direct to `list_*` or `audit_*` MCP tools |

### Step 2: Detect Multi-Skill Requests

A request needs orchestration when it mentions ANY combination of:
- Properties/fields AND workflows/automations
- Pipeline AND properties (stages reference properties)
- Workflows AND lists (enrollment or suppression lists)
- Any "set up everything for [use case]"
- Meeting notes with multiple action items across categories

### Step 3: Build Execution Plan

For multi-skill requests, build the plan following the dependency order:

```
Phase 1: FOUNDATION
  ├── Property Groups (needed before properties)
  └── Custom Objects (Enterprise only, needed before associations)

Phase 2: DATA MODEL
  ├── Properties (reference groups, referenced by everything else)
  └── Pipelines (independent, but workflows may reference stages)

Phase 3: SEGMENTATION
  └── Lists (reference properties, referenced by workflows)

Phase 4: AUTOMATION
  └── Workflows (reference properties, pipelines, lists)

Phase 5: DATA OPERATIONS
  └── Bulk Scripts (reference properties, run after everything is created)

Phase 6: BUNDLE (optional)
  └── Template (bundles everything for reuse/cloning)
```

---

## Execution Protocol

### Before Execution — Portal Inventory

**CRITICAL: Always read existing portal state before drafting anything.**

1. **Fetch existing resources** from the connected portal via the app:
   - Call `list_properties` for each relevant object type (contacts, companies, deals, tickets)
   - Call `list_pipelines` for deals and tickets
   - Call `list_workflows` to see existing automations
   - Call `list_lists` to see existing lists/segments
2. **Build an inventory** of what already exists — property names, pipeline labels, workflow names, list names
3. **Compare the plan against inventory** and flag:
   - **Exact duplicates**: resource already exists with the same name → skip or update
   - **Similar names**: resource with a similar name exists → ask user to clarify
   - **Missing dependencies**: plan references a property/pipeline/list that doesn't exist yet and isn't in the plan → add it
4. **Present the full plan** to the user with all resources listed, including any conflicts found
5. **Flag any concerns**: duplicates, tier limits, missing info, ambiguous requirements
6. **Get explicit approval** before creating any drafts
7. **Confirm the target portal** if multiple portals are connected

### During Execution

For each resource in dependency order:

```
1. Load the appropriate skill's rules and constraints
2. Build the spec following that skill's format EXACTLY
3. Run the pre-flight checklist from that skill
4. Call the appropriate save_*_draft MCP tool
5. Check the response for warning_draft_duplicates or warning_portal_duplicates
6. If duplicates found: stop, inform the user, ask how to proceed
7. Report success/failure to the user
8. Tell them which app page to deploy from
```

### Cross-Skill Validation

Before saving any draft, validate cross-references:

| What to Check | Why |
|---|---|
| Workflow references property → property exists in plan or portal | Workflow action silently fails if property missing |
| List filter references property → property exists in plan or portal | List returns empty or errors |
| Pipeline stages referenced in workflow → pipeline exists in plan or portal | Workflow enrollment/actions fail |
| Property groupName → group exists in plan or portal | Property creation fails with "group not found" |
| Template resources → all cross-references resolved | Partial install failure |
| Workflow list enrollment → list exists or will be created first | Enrollment criteria fails |
| Custom object associations → both objects exist | Association creation fails |

### After Execution

1. **Summarize** everything that was drafted:
   ```
   Drafted Resources:
   ✓ 1 property group (saas_metrics)
   ✓ 4 properties (lead_source, product_interest, trial_start_date, mrr_value)
   ✓ 1 deal pipeline (SaaS Sales Pipeline, 7 stages)
   ✓ 1 dynamic list (Active Trialists)
   ✓ 1 workflow (Trial Start Notification)
   ✓ 1 bulk script (Phone Number Cleanup)
   ```

2. **Deploy instructions**:
   ```
   Deploy from the app:
   1. Properties page → deploy property drafts
   2. Pipelines page → deploy pipeline draft
   3. Lists page → deploy list draft
   4. Workflows page → deploy workflow draft
   5. Bulk page → register and run script (dry-run first!)
   ```

3. **Post-deploy verification suggestions**:
   - Check properties appear in HubSpot object settings
   - Verify pipeline stages and probabilities in HubSpot
   - Test list membership by checking a known matching record
   - Verify workflow is created (disabled) in HubSpot automation
   - Run bulk script in dry-run first, review logs

---

## Common Multi-Skill Patterns

### Pattern 1: "Set up lead management"

```
Property Group: lead_management
  → Properties: lead_source (enum), lead_score (number), qualification_status (enum)
  → Pipeline: Lead Qualification (Discovery → Qualified → Opportunity → Won/Lost)
  → List: Hot Leads (lead_score > 80, DYNAMIC)
  → Workflow: Score Threshold → set qualification_status, create task
```

Execution: group → properties → pipeline → list → workflow

### Pattern 2: "Build customer onboarding flow"

```
Property Group: onboarding
  → Properties: onboarding_status (enum), onboarding_start_date (date), assigned_csm (string)
  → Pipeline: Customer Onboarding (tickets) — New → Kickoff → Training → Go-Live → Complete
  → Workflow: Deal Closed Won → create ticket in onboarding pipeline, set contact properties
  → List: Active Onboarding (onboarding_status = in_progress, DYNAMIC)
```

Execution: group → properties → pipeline → workflow → list

### Pattern 3: "Clean up and standardize CRM data"

```
Properties: Audit existing, identify low-fill-rate candidates
  → Bulk Script 1: Normalize phone numbers
  → Bulk Script 2: Deduplicate by email
  → Bulk Script 3: Backfill missing lifecycle stages
  → List: Records Needing Review (missing required fields, DYNAMIC)
```

Execution: audit → scripts → list

### Pattern 4: "Full SaaS CRM from scratch"

```
Template bundle containing:
  → Property Groups: saas_metrics, sales_properties
  → Properties: 8-12 custom properties across contacts and deals
  → Pipeline: SaaS Sales Pipeline (7 stages)
  → Pipeline: Customer Support (tickets, 5 stages)
  → Lists: Active Trials, MQLs, At-Risk Customers
  → Workflows: Trial Start, Score Threshold, Churn Risk Alert
```

Execution: Use Template skill to bundle everything → install from /templates page

### Pattern 5: "Meeting notes → everything"

```
Meeting Analysis skill:
  → Extract all requirements
  → Gap analysis
  → Structured plan
  → User approves
  → Execute plan using resource skills in dependency order
  → Optionally bundle as template for portal cloning
```

---

## Error Recovery

When a draft save fails or a deploy fails:

| Error Type | Recovery |
|---|---|
| Spec validation error | Fix the spec based on the skill's troubleshooting guide, re-save |
| Property already exists (409) | Check if existing property is compatible, skip or rename |
| Group not found (400) | Create the group first, then retry property |
| Pipeline limit exceeded | Check tier, suggest upgrade or consolidation |
| Workflow deploy fails | Read error, match against workflow troubleshooting, fix and re-save |
| List filter returns empty | Check operationType matches property type (most common issue) |
| Partial template install | Check which resources exist, fix failed ones, re-install |

---

## Tier Awareness

Before creating any resource, check the client's HubSpot tier:

| Feature | Free | Starter | Pro | Enterprise |
|---|---|---|---|---|
| Custom properties | 10 | 1,000 | 1,000 | 1,000 |
| Pipelines per object | 1 | 2 | 15 | 100 |
| Active lists | 5 | 25 | 1,000 | 1,500 |
| Workflows | 0 | 0 | 300 | 1,000 |
| Custom objects | 0 | 0 | 0 | 10 |
| Calculated properties | No | No | Yes | Yes |
| Labeled associations | No | No | No | Yes |
| Custom code in workflows | No | No | Ops Hub Pro | Ops Hub Ent |

If the plan requires features above the client's tier, flag it clearly and suggest alternatives.

---

## Decision Trees

### "Should I use a Template or individual drafts?"

```
Is this a reusable setup pattern?
  ├── YES → Template (save_template_draft)
  │         (e.g., "SaaS CRM", "Agency Setup", "E-commerce")
  │
  └── NO → Individual drafts
            (e.g., "add a field for tracking X")
```

### "Should I use a Workflow or a Bulk Script?"

```
Is this a one-time operation?
  ├── YES → Bulk Script
  │         (e.g., "update all contacts where X")
  │
  └── NO → Workflow
            (e.g., "whenever X happens, do Y")

Is this for existing records?
  ├── YES → Bulk Script (backfill)
  └── NO → Workflow (going forward)
```

### "Should I use a Dynamic List or a Workflow?"

```
Do I need real-time membership updates?
  ├── YES → Dynamic List
  │
  └── NO → Static List + Workflow to add/remove
```

---

## Procedure

1. **⚡ FIRST: Read `hubspot-learnings` skill** — cross-check against ALL known patterns and failures before any operation. Do NOT skip this step.
2. **Receive** the user's request
3. **Classify** — single-skill or multi-skill? (see Routing Logic)
4. **If meeting notes** — invoke Meeting Analysis skill first
4. **If multi-skill** — build dependency-resolved execution plan
5. **Present** the plan with all resources, flags, and tier checks
6. **Get approval** — "Shall I create these drafts?"
7. **Execute** in dependency order, calling each skill's MCP tool
8. **Cross-validate** — ensure all references are satisfied
9. **Summarize** what was drafted and where to deploy
10. **Suggest** post-deploy verification steps
