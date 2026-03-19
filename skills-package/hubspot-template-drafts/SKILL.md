---
description: "Create HubSpot configuration template drafts via the app. Use when: user asks to create, build, or save a CRM template, config template, full CRM setup, or RevOps template for HubSpot."
---

# HubSpot Config Template Draft Skill

When asked to create HubSpot configuration templates (bundles of properties, pipelines, workflows, lists, custom objects, and associations), generate valid template specs and save them as drafts using the `save_template_draft` MCP tool. The user installs from the Templates page.

---

## Template Spec Format

```yaml
# YAML reference — translate to JSON for the MCP tool
name: "SaaS CRM Setup"                    # REQUIRED — template display name
description: "Complete CRM for SaaS"       # recommended
version: "1.0.0"                           # REQUIRED — semver
tags: ["saas", "crm"]                      # optional — for filtering
resources:                                 # at least one resource array must be non-empty
  propertyGroups: [...]                    # created FIRST (dependency)
  properties: [...]                        # created SECOND (depends on groups)
  pipelines: [...]                         # independent
  workflows: [...]                         # may depend on properties/lists
  lists: [...]                             # may depend on properties
  customObjects: [...]                     # independent
  associations: [...]                      # created LAST (depends on objects)
```

## JSON Example — Full CRM Template

```json
{
  "name": "SaaS Startup CRM",
  "description": "Complete CRM setup for a SaaS startup with sales pipeline, lead scoring properties, and automated workflows",
  "version": "1.0.0",
  "tags": ["saas", "startup", "crm", "full-setup"],
  "resources": {
    "propertyGroups": [
      {
        "objectType": "contacts",
        "name": "saas_metrics",
        "label": "SaaS Metrics"
      },
      {
        "objectType": "deals",
        "name": "saas_deal_info",
        "label": "SaaS Deal Info"
      }
    ],
    "properties": [
      {
        "objectType": "contacts",
        "name": "product_interest",
        "label": "Product Interest",
        "type": "enumeration",
        "fieldType": "checkbox",
        "groupName": "saas_metrics",
        "description": "Products the contact is interested in",
        "options": [
          { "label": "Core Platform", "value": "core", "displayOrder": 0 },
          { "label": "Analytics Add-on", "value": "analytics", "displayOrder": 1 },
          { "label": "API Access", "value": "api", "displayOrder": 2 }
        ]
      },
      {
        "objectType": "contacts",
        "name": "trial_start_date",
        "label": "Trial Start Date",
        "type": "date",
        "fieldType": "date",
        "groupName": "saas_metrics",
        "description": "When the contact started their trial"
      },
      {
        "objectType": "contacts",
        "name": "mrr_value",
        "label": "MRR Value",
        "type": "number",
        "fieldType": "number",
        "groupName": "saas_metrics",
        "description": "Monthly recurring revenue for this customer"
      },
      {
        "objectType": "deals",
        "name": "contract_length_months",
        "label": "Contract Length (Months)",
        "type": "number",
        "fieldType": "number",
        "groupName": "saas_deal_info",
        "description": "Length of the contract in months"
      }
    ],
    "pipelines": [
      {
        "objectType": "deals",
        "label": "SaaS Sales Pipeline",
        "stages": [
          { "label": "Demo Scheduled", "displayOrder": 0, "metadata": { "probability": "0.1" } },
          { "label": "Trial Started", "displayOrder": 1, "metadata": { "probability": "0.3" } },
          { "label": "Trial Active", "displayOrder": 2, "metadata": { "probability": "0.5" } },
          { "label": "Proposal Sent", "displayOrder": 3, "metadata": { "probability": "0.7" } },
          { "label": "Negotiation", "displayOrder": 4, "metadata": { "probability": "0.85" } },
          { "label": "Closed Won", "displayOrder": 5, "metadata": { "isClosed": "true", "closedWon": "true", "probability": "1.0" } },
          { "label": "Closed Lost", "displayOrder": 6, "metadata": { "isClosed": "true", "closedWon": "false", "probability": "0.0" } }
        ]
      }
    ],
    "workflows": [
      {
        "name": "New Trial Notification",
        "type": "CONTACT_FLOW",
        "objectTypeId": "0-1",
        "isEnabled": false,
        "startActionId": "1",
        "nextAvailableActionId": 3,
        "enrollmentCriteria": {
          "shouldReEnroll": false,
          "type": "EVENT_BASED",
          "eventFilterBranches": [
            {
              "filters": [
                {
                  "property": "trial_start_date",
                  "operation": {
                    "operator": "HAS_PROPERTY",
                    "operationType": "DATE"
                  },
                  "filterType": "PROPERTY"
                }
              ],
              "eventTypeId": "0-1",
              "operator": "HAS_COMPLETED",
              "filterBranchType": "UNIFIED_EVENTS",
              "filterBranchOperator": "AND"
            }
          ]
        },
        "actions": [
          {
            "actionId": "1",
            "actionTypeId": "0-5",
            "actionTypeVersion": 0,
            "type": "SINGLE_CONNECTION",
            "fields": [
              { "name": "property", "value": "lifecyclestage" },
              { "name": "newValue", "value": "opportunity" }
            ],
            "connection": { "nextActionId": "2" }
          },
          {
            "actionId": "2",
            "actionTypeId": "0-7",
            "actionTypeVersion": 0,
            "type": "SINGLE_CONNECTION",
            "fields": [
              { "name": "subject", "value": "New trial started — follow up" }
            ],
            "connection": {}
          }
        ]
      }
    ],
    "lists": [
      {
        "name": "Active Trialists",
        "objectTypeId": "0-1",
        "processingType": "DYNAMIC",
        "filterBranch": {
          "filterBranchType": "OR",
          "filterBranchOperator": "OR",
          "filters": [],
          "filterBranches": [
            {
              "filterBranchType": "AND",
              "filterBranchOperator": "AND",
              "filters": [
                {
                  "filterType": "PROPERTY",
                  "property": "trial_start_date",
                  "operation": {
                    "operator": "IS_BETWEEN",
                    "lowerBound": 0,
                    "upperBound": 14,
                    "timeUnit": "DAYS",
                    "operationType": "DATE"
                  }
                }
              ],
              "filterBranches": []
            }
          ]
        }
      }
    ],
    "customObjects": [],
    "associations": []
  }
}
```

---

## Resource Types Reference

| Resource | Key | Format | Dependency Order |
|---|---|---|---|
| Property Groups | `propertyGroups` | `{ objectType, name, label }` | 1st — no deps |
| Custom Objects | `customObjects` | See Custom Object format | 1st — no deps |
| Properties | `properties` | See Property skill format | 2nd — needs groups |
| Pipelines | `pipelines` | See Pipeline skill format | 2nd — no deps |
| Lists | `lists` | See List skill format | 3rd — may need properties |
| Workflows | `workflows` | See Workflow skill format | 4th — may need properties/lists |
| Associations | `associations` | `{ fromObjectType, toObjectType, category, label }` | Last — needs objects |

---

## Critical Rules (Pre-flight Checklist)

| # | Rule | Error if violated |
|---|------|------------------|
| 1 | `name` and `version` are required at template level | Template save fails |
| 2 | ALL property rules apply (type/fieldType, naming, etc.) | Property creation fails on install |
| 3 | ALL pipeline rules apply (Closed Won/Lost for deals) | Pipeline creation fails on install |
| 4 | ALL workflow rules apply (v4 format, numeric action IDs) | Workflow deploy fails on install |
| 5 | ALL list rules apply (filterBranch structure) | List creation fails on install |
| 6 | Resource arrays can be empty `[]` if not needed | Never omit — use `[]` |
| 7 | Dependencies are resolved by install order | Groups before properties, objects before associations |
| 8 | Property `groupName` must match a group in `propertyGroups` or existing portal group | Property creation fails |
| 9 | Workflow properties must exist (either in template or portal) | Workflow actions may silently fail |
| 10 | Custom object names: `^[a-zA-Z][a-zA-Z0-9_]*$`, max 64 chars, max 10 per portal | Custom object creation fails |
| 11 | Custom object `name` and `labels` are IMMUTABLE after creation | Cannot rename — choose carefully |
| 12 | Custom objects require Enterprise tier | 403 on non-Enterprise portals |
| 13 | `primaryDisplayProperty` must reference a string-type property | Schema creation fails |

---

## Custom Object Format

**IMPORTANT**: Custom objects require Enterprise tier. `name` and `labels` are **immutable** after creation.

```json
{
  "name": "subscription",
  "description": "Tracks customer subscriptions and plan details",
  "labels": {
    "singular": "Subscription",
    "plural": "Subscriptions"
  },
  "primaryDisplayProperty": "subscription_name",
  "secondaryDisplayProperties": ["plan_type"],
  "searchableProperties": ["subscription_name", "plan_type"],
  "requiredProperties": ["subscription_name", "plan_type"],
  "associatedObjects": ["CONTACT", "COMPANY"],
  "properties": [
    {
      "name": "subscription_name",
      "label": "Subscription Name",
      "type": "string",
      "fieldType": "text"
    },
    {
      "name": "plan_type",
      "label": "Plan Type",
      "type": "enumeration",
      "fieldType": "select",
      "options": [
        { "label": "Free", "value": "free", "displayOrder": 0 },
        { "label": "Pro", "value": "pro", "displayOrder": 1 },
        { "label": "Enterprise", "value": "enterprise", "displayOrder": 2 }
      ]
    },
    {
      "name": "monthly_amount",
      "label": "Monthly Amount",
      "type": "number",
      "fieldType": "number"
    }
  ]
}
```

## Association Format

```json
{
  "fromObjectType": "contacts",
  "toObjectType": "companies",
  "category": "USER_DEFINED",
  "label": "Decision Maker"
}
```

Valid categories: `HUBSPOT_DEFINED`, `USER_DEFINED`, `INTEGRATOR_DEFINED`

Standard association pairs: contacts↔companies, contacts↔deals, contacts↔tickets, companies↔deals, companies↔tickets, deals↔line_items, deals↔quotes

---

## Troubleshooting Guide

| Error | Cause | Fix |
|---|---|---|
| `Group not found` on property install | Property references group not in template or portal | Add group to `propertyGroups` array |
| `Property already exists` | Portal already has property with same name | Use unique names or check existing properties first |
| `Custom object limit exceeded` | Portal already has 10 custom objects | Remove an existing custom object first |
| `Workflow action type invalid` | Used text action names instead of `0-X` IDs | Use numeric IDs per workflow skill |
| `Template install partial failure` | Some resources created, others failed | Check which resources exist, fix spec, re-install |

---

## Common Template Patterns

| Pattern | Property Groups | Properties | Pipelines | Workflows | Lists |
|---|---|---|---|---|---|
| SaaS Startup | saas_metrics | MRR, trial dates, plan type | Sales + Renewal | Trial notification, churn risk | Active trials, At-risk |
| Services/Agency | project_info | Project type, budget, timeline | Sales + Delivery | New project, milestone alerts | Active projects, Proposals |
| E-commerce | ecommerce_data | Order value, category, frequency | Sales + Returns | Cart abandonment, VIP alert | High-value, Repeat buyers |
| ABM | abm_data | Account tier, ICP score, intent | ABM pipeline | Account qualified, Tier change | Target accounts, Engaged |
| Lead Scoring | lead_scoring | Score, grade, behavior signals | Scoring pipeline | Score threshold, MQL alert | MQLs, SQLs, Hot leads |

---

## Procedure

1. **⚡ FIRST: Read `hubspot-learnings` skill** — cross-check your planned template against ALL known patterns and failures. Do NOT skip this step.
2. **Read `docs/workflow-pattern-catalog.md`** — for any workflows in the template, use the exact JSON patterns from the catalog as your starting point.
3. Ask the user what kind of CRM setup they need.
4. Design the template with appropriate resources for their use case.
5. Follow ALL format rules from the individual resource skills:
   - Properties: type/fieldType matrix, naming constraints
   - Pipelines: Closed Won/Lost for deals, metadata as strings
   - **Workflows: Use patterns from the catalog (enrollment 1A-1G, actions 3A-3L, branching 4A-4E). Follow the 4-tier failure recovery from `hubspot-workflow-drafts` skill if any workflow in the template fails.**
   - Lists: filterBranch structure, correct operationType for property types
6. Ensure dependency order: groups → properties → pipelines → lists → workflows → associations.
7. **Pre-flight check**: Cross-reference each resource against its skill's checklist.
8. Call `save_template_draft` or `execute_config` MCP tool with the spec.
9. If install partially fails (especially workflows), use the same 4-tier recovery:
   - Tier 1: Fix from learnings patterns
   - Tier 2: Check HubSpot docs
   - Tier 3: Reverse-engineer from portal workflows via `get_workflow`
   - Tier 4: Partial install — deploy what works, surface `manualSteps` for the rest
10. **Update learnings** with any new patterns discovered. Sanitize all portal data.
11. State: "No portal-specific data has been persisted to skills or memory."
