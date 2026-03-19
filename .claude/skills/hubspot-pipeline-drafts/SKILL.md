---
description: "Create HubSpot pipeline drafts via the app. Use when: user asks to create, build, or save a pipeline, deal stages, or ticket stages for HubSpot."
---

# HubSpot Pipeline Draft Skill

When asked to create HubSpot pipelines, generate valid pipeline specs and save them as drafts using the `save_pipeline_draft` MCP tool. The user deploys from the Pipelines page.

---

## Pipeline Spec Format

```yaml
# YAML reference — translate to JSON for the MCP tool
objectType: deals             # REQUIRED — "deals" or "tickets" only
label: Sales Pipeline         # REQUIRED — pipeline display name
displayOrder: 0               # optional — ordering among pipelines
stages:                       # REQUIRED — min 2 stages, max 100
  - label: Qualification      # REQUIRED — stage display name
    displayOrder: 0            # REQUIRED — integer, sequential from 0
    metadata:                  # deal pipelines: optional per open stage, REQUIRED for closed
      probability: "0.2"      # string "0.0" to "1.0"
  - label: Closed Won
    displayOrder: 4
    metadata:                  # REQUIRED for deal closed stages
      isClosed: "true"        # string, not boolean
      closedWon: "true"       # string, not boolean
      probability: "1.0"      # string
```

## JSON Example — Deal Pipeline

```json
{
  "objectType": "deals",
  "label": "SaaS Sales Pipeline",
  "stages": [
    { "label": "Discovery", "displayOrder": 0, "metadata": { "probability": "0.1" } },
    { "label": "Qualification", "displayOrder": 1, "metadata": { "probability": "0.2" } },
    { "label": "Demo Completed", "displayOrder": 2, "metadata": { "probability": "0.4" } },
    { "label": "Proposal Sent", "displayOrder": 3, "metadata": { "probability": "0.6" } },
    { "label": "Negotiation", "displayOrder": 4, "metadata": { "probability": "0.8" } },
    {
      "label": "Closed Won",
      "displayOrder": 5,
      "metadata": { "isClosed": "true", "closedWon": "true", "probability": "1.0" }
    },
    {
      "label": "Closed Lost",
      "displayOrder": 6,
      "metadata": { "isClosed": "true", "closedWon": "false", "probability": "0.0" }
    }
  ]
}
```

## JSON Example — Ticket Pipeline

```json
{
  "objectType": "tickets",
  "label": "Customer Support Pipeline",
  "stages": [
    { "label": "New", "displayOrder": 0, "metadata": { "ticketState": "OPEN" } },
    { "label": "Awaiting Triage", "displayOrder": 1, "metadata": { "ticketState": "OPEN" } },
    { "label": "In Progress", "displayOrder": 2, "metadata": { "ticketState": "OPEN" } },
    { "label": "Waiting on Customer", "displayOrder": 3, "metadata": { "ticketState": "OPEN" } },
    { "label": "Waiting on Third Party", "displayOrder": 4, "metadata": { "ticketState": "OPEN" } },
    { "label": "Resolved", "displayOrder": 5, "metadata": { "ticketState": "CLOSED" } },
    { "label": "Closed", "displayOrder": 6, "metadata": { "ticketState": "CLOSED" } }
  ]
}
```

---

## Critical Rules (Pre-flight Checklist)

| # | Rule | Error if violated |
|---|------|------------------|
| 1 | `objectType` must be `"deals"` or `"tickets"` | 400: invalid object type |
| 2 | Minimum 2 stages required | 400: insufficient stages |
| 3 | Maximum 100 stages per pipeline (deals/tickets/custom) | 400: too many stages |
| 4 | Pipeline limits vary by tier: Free=1, Starter=2, Pro=15, Enterprise=100 | 400: pipeline limit exceeded |
| 5 | `displayOrder` must be integers (ties sorted alphabetically by label) | Stages appear in wrong order |
| 6 | Deal pipelines MUST have a Closed Won stage | Reporting/forecasting breaks |
| 7 | Deal pipelines MUST have a Closed Lost stage | Reporting/forecasting breaks |
| 8 | Closed Won: `probability: "1.0"` (`isClosed` auto-set by HubSpot) | Deals won't close properly |
| 9 | Closed Lost: `probability: "0.0"` (`isClosed` auto-set by HubSpot) | Deals won't close properly |
| 10 | ALL metadata values must be STRINGS (`"true"` not `true`, `"0.5"` not `0.5`) | 400: type validation error |
| 11 | Every stage must have both `label` and `displayOrder` | 400: missing required fields |
| 12 | `probability` is REQUIRED on ALL deal stages (not optional) | 400: must specify probability |
| 13 | `probability` must be in 0.1 increments: `"0.0"`, `"0.1"`, ... `"1.0"` | 400: invalid probability |
| 14 | Stage labels must be unique within a pipeline | 400: duplicate label |

---

## Stage Metadata Reference (Deals Only)

| Key | Type | Values | Required? |
|---|---|---|---|
| `isClosed` | string | `"true"` / `"false"` | Required on closed stages |
| `closedWon` | string | `"true"` / `"false"` | Required when `isClosed: "true"` |
| `probability` | string | `"0.0"` to `"1.0"` | Recommended on all stages |

**Ticket pipelines** use optional `ticketState` metadata:

| Key | Type | Values | Effect |
|---|---|---|---|
| `ticketState` | string | `"OPEN"` / `"CLOSED"` | Auto-sets close date on transition; auto-reopens on customer reply |

```json
{ "label": "Resolved", "displayOrder": 3, "metadata": { "ticketState": "CLOSED" } }
```

### Probability Guidelines

| Stage Position | Suggested Probability |
|---|---|
| First open stage | `"0.1"` - `"0.2"` |
| Mid-funnel | `"0.3"` - `"0.6"` |
| Late-funnel | `"0.7"` - `"0.9"` |
| Closed Won | `"1.0"` (always) |
| Closed Lost | `"0.0"` (always) |

---

## Troubleshooting Guide

| Error | Cause | Fix |
|---|---|---|
| `Pipeline limit exceeded` (400) | Exceeded tier limit (Free=1, Starter=2, Pro=15, Ent=100) | Upgrade tier or delete unused pipelines |
| `Stage limit exceeded` (400) | More than 100 stages | Consolidate stages (recommended max: 8-10) |
| `must specify probability` (400) | Deal stage missing `probability` in metadata | Add `probability` to EVERY deal stage |
| `Invalid metadata value` (400) | Used boolean `true` instead of string `"true"` | Wrap ALL metadata values in quotes |
| `Duplicate label` (400) | Stage label not unique within pipeline | Use unique stage labels |
| `STAGE_ID_IN_USE` (409) | Delete pipeline/stage with existing records | Move records first, then delete |
| `Pipeline cannot be deleted` (409) | Referenced by workflows or last remaining pipeline | Remove references or rename to "UNUSED" |
| `Missing closed stages` (audit) | No Closed Won/Lost stages in deal pipeline | Add both closed stages with proper metadata |

---

## Alternative Approaches

| Goal | Option A (recommended) | Option B (alternative) |
|---|---|---|
| Multiple sales processes | Separate pipelines per process | Single pipeline with more stages |
| Simple support flow | 3-4 stages: New → In Progress → Resolved → Closed | More granular with waiting states |
| Complex approval flow | Ticket pipeline with approval stages | Workflow-based approval with property tracking |
| Renewal tracking | Dedicated renewal pipeline (deals) | Properties + workflow on existing pipeline |
| Best practice stage count | 5-8 stages for deals, 4-6 for tickets | Fewer is better — each stage should represent a meaningful milestone |

---

## Procedure

1. **⚡ FIRST: Read `hubspot-learnings` skill** — cross-check your planned spec against ALL known patterns and failures. Do NOT skip this step.
2. **Portal check**: Call `list_portals` to identify connected portals. If multiple portals exist, ask the user which one to target. Pass `portalId` to every subsequent MCP tool call.
3. Ask the user: deals or tickets pipeline? What stages do they need?
4. **Duplicate check**: Call `list_pipelines` MCP tool (with `portalId`) for the target `objectType` (deals or tickets) to see existing pipelines and their stages. Compare the planned pipeline label against existing ones. If a similar pipeline exists, show the user its stages and ask whether to skip, extend, or create a new one.
5. Build stages with sequential `displayOrder` starting at 0
4. For deal pipelines:
   - Add `probability` metadata to each stage (increasing)
   - Always include Closed Won (`isClosed: "true"`, `closedWon: "true"`, `probability: "1.0"`)
   - Always include Closed Lost (`isClosed: "true"`, `closedWon: "false"`, `probability: "0.0"`)
5. For ticket pipelines: stages are simpler — just `label` + `displayOrder`
6. **Pre-flight check**: Verify ALL critical rules, especially string metadata values
7. Call `save_pipeline_draft` MCP tool with the spec — the tool will also check for duplicate drafts and portal conflicts, returning warnings if found
8. If the tool returns `warning_portal_duplicates`, stop and inform the user
9. Tell the user to deploy from the Pipelines page
10. If deploy fails, match error against Troubleshooting Guide, fix, AND **append the new failure pattern to `hubspot-learnings`**
