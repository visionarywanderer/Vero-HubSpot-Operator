---
description: "Create HubSpot workflow drafts via the app. Use when: user asks to create, build, or save a workflow, automation, or flow for HubSpot."
---

# HubSpot Workflow Draft Skill

When asked to create a HubSpot workflow, generate a valid **v4 automation API** spec and save it as a draft using the `save_workflow_draft` MCP tool. The user deploys from the app UI.

**Note**: The v4 Automation API is in BETA.

---

## Workflow Spec Format (HubSpot Automation v4)

```yaml
# YAML reference — translate to JSON for the MCP tool
name: "Workflow Name"                  # REQUIRED — string, max 256 chars
type: CONTACT_FLOW                     # REQUIRED — see Flow Types table
objectTypeId: "0-1"                    # REQUIRED — must match type
isEnabled: false                       # MUST be false (safety)
flowType: WORKFLOW                     # auto-filled by engine
startActionId: "1"                     # REQUIRED — must reference an existing action
nextAvailableActionId: "3"             # REQUIRED — STRING, must equal max(actionId) + 1
enrollmentCriteria:                    # REQUIRED — see Enrollment section
  type: EVENT_BASED
  shouldReEnroll: false
  eventFilterBranches: [...]
actions:                               # REQUIRED — array, min 1 action
  - actionId: "1"                      # string, sequential from "1"
    actionTypeId: "0-5"                # REQUIRED — numeric ID, NOT name
    actionTypeVersion: 0               # REQUIRED — always 0
    type: SINGLE_CONNECTION            # REQUIRED — connection type
    fields:                            # 0-5 uses property_name + value as separate keys
      property_name: "fieldName"       # REQUIRED for 0-5
      value:                           # REQUIRED for 0-5
        type: STATIC_VALUE
        staticValue: "newValue"
    connection:
      edgeType: STANDARD
      nextActionId: "2"                # OMIT connection entirely for last action
```

## JSON Example (copy-paste ready)

```json
{
  "name": "Lead Qualification Flow",
  "type": "CONTACT_FLOW",
  "objectTypeId": "0-1",
  "isEnabled": false,
  "startActionId": "1",
  "nextAvailableActionId": "4",
  "enrollmentCriteria": {
    "shouldReEnroll": false,
    "type": "EVENT_BASED",
    "eventFilterBranches": [
      {
        "filters": [
          {
            "property": "lifecyclestage",
            "operation": {
              "operator": "IS_ANY_OF",
              "values": ["lead"],
              "operationType": "ENUMERATION"
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
      "fields": {
        "property_name": "hs_lead_status",
        "value": {
          "type": "STATIC_VALUE",
          "staticValue": "NEW"
        }
      },
      "connection": { "edgeType": "STANDARD", "nextActionId": "2" }
    },
    {
      "actionId": "2",
      "actionTypeId": "0-1",
      "actionTypeVersion": 0,
      "type": "SINGLE_CONNECTION",
      "fields": {
        "delta": "1440",
        "time_unit": "MINUTES"
      },
      "connection": { "edgeType": "STANDARD", "nextActionId": "3" }
    },
    {
      "actionId": "3",
      "actionTypeId": "0-3",
      "actionTypeVersion": 0,
      "type": "SINGLE_CONNECTION",
      "fields": {
        "subject": "Follow up with new lead",
        "priority": "HIGH"
      },
    }
  ]
}
```

**NOTE:** The last action OMITS the `connection` field entirely. Do NOT use `"connection": {}`.

---

## Critical Rules (Pre-flight Checklist)

| # | Rule | What fails if violated |
|---|------|----------------------|
| 1 | `isEnabled` MUST be `false` | Engine rejects: `SAFETY: isEnabled must be false` |
| 2 | SINGLE_CONNECTION actions MUST have `type: "SINGLE_CONNECTION"` | HubSpot 400: `required fields: [type]` |
| 3 | Every SINGLE_CONNECTION action MUST have `actionTypeVersion: 0` | HubSpot 400: `required fields: [type]` |
| 4 | `actionTypeId` must be numeric string (`"0-5"`) NOT name (`"SET_CONTACT_PROPERTY"`) | HubSpot 400: invalid action type |
| 5 | `nextAvailableActionId` must be a **string** equal to `max(actionId) + 1` | Engine rejects with calculated correct value |
| 6 | `startActionId` must reference an existing action's `actionId` | Engine rejects: `startActionId not found` |
| 7 | Last action MUST omit `connection` field entirely — do NOT use `{}` | "Invalid request to flow creation" or "required fields not set: [nextActionId]" |
| 7b | All actions must be reachable from startActionId — no orphaned actions | "Invalid request to flow creation" |
| 8 | `enrollmentCriteria` is required | Engine rejects: `Missing: enrollmentCriteria` |
| 9 | `objectTypeId` and `type` must match (see Flow Types) | Engine rejects with mismatch message |
| 10 | Branch actions (`LIST_BRANCH`, `STATIC_BRANCH`, `AB_TEST_BRANCH`) have NO `actionTypeId` | Validation error |
| 11 | `0-3` is Create task (NOT `0-7`) | Wrong action type |
| 12 | `0-13` is deprecated — use `0-63809083` (add to list) / `0-63863438` (remove) | May fail silently |

---

## Flow Types

| objectTypeId | type | Use for |
|---|---|---|
| `0-1` | `CONTACT_FLOW` | Contact-based workflows |
| `0-2` | `PLATFORM_FLOW` | Company-based workflows |
| `0-3` | `PLATFORM_FLOW` | Deal-based workflows |
| `0-5` | `PLATFORM_FLOW` | Ticket-based workflows |
| `0-47` | `PLATFORM_FLOW` | Meeting-based workflows |
| `0-48` | `PLATFORM_FLOW` | Call-based workflows |
| `0-53` | `PLATFORM_FLOW` | Invoice-based workflows |
| `2-XXXXX` | `PLATFORM_FLOW` | Custom object workflows |

**CRITICAL**: Only `0-1` uses `CONTACT_FLOW`. ALL other object types use `PLATFORM_FLOW`.

---

## Action Type IDs (Complete Reference)

### Core Actions

| actionTypeId | Name | Required fields | Notes |
|---|---|---|---|
| `0-1` | Delay | `delta`, `time_unit` | time_unit: `MINUTES`, `HOURS`, `DAYS`, `WEEKS`. delta is a string. |
| `0-3` | Create task | `subject` | Optional: `body`, `priority` (`LOW`/`MEDIUM`/`HIGH`), `ownerIds` |
| `0-4` | Send email | `content_id` | content_id is the email template ID from HubSpot |
| `0-5` | Set property | `property_name` + `value` | **CRITICAL:** Use `"property_name": "X"` and `"value": {type, staticValue}` as separate fields. NEVER use property name as the key. |
| `0-8` | Send internal email | `user_ids`, `subject`, `body` | Sends to specified HubSpot users |
| `0-9` | Send in-app notification | `user_ids`, `subject`, `body` | In-app notification to HubSpot users |
| `0-11` | Rotate record to owner | | Round-robin assignment |
| `0-14` | Create record | `object_type_id`, `properties`, `associations` | Creates associated record |
| `0-15` | Go to workflow | | Enroll in another workflow |
| `0-35` | Delay until date | | Calendar date or date property |

### List Actions

| actionTypeId | Name | Required fields | Notes |
|---|---|---|---|
| `0-63809083` | Add to static list | `list_id` | **Replaces deprecated `0-13`** |
| `0-63863438` | Remove from static list | `list_id` | |

### Association Actions

| actionTypeId | Name | Notes |
|---|---|---|
| `0-63189541` | Create associations | |
| `0-61139484` | Update association labels | |
| `0-61139476` | Remove association labels | |

### Sequence & Contact Actions

| actionTypeId | Name | Notes |
|---|---|---|
| `0-46510720` | Enroll in a sequence | |
| `0-4702372` | Unenroll from sequence | |
| `0-18224765` | Delete contact | Permanent! |
| `0-31` | Set marketing contact status | |
| `0-169425243` | Create note | |

### Communication Actions

| actionTypeId | Name | Notes |
|---|---|---|
| `0-25085031` | Send WhatsApp message | |
| `0-40900952` | Send SMS message | |
| `0-43347357` | Manage communication subscriptions | |
| `0-44475148` | Assign conversation owner | |
| `0-199186210` | Send survey | |

### Integration Actions

| actionTypeId | Name | Notes |
|---|---|---|
| `1-179507819` | Send Slack notification | |
| `1-100451` | Create Asana task | |
| `1-2825058` | Create Trello card | |

**WARNING**: Do NOT use human-readable names like `SET_CONTACT_PROPERTY`, `CREATE_TASK`, `SEND_EMAIL`, `DELAY`. These are prompt pack aliases that the v4 API does NOT accept. Always use the `0-X` numeric IDs.

---

## Action Structure Types

### SINGLE_CONNECTION (most common)

```json
{
  "type": "SINGLE_CONNECTION",
  "actionId": "1",
  "actionTypeId": "0-5",
  "actionTypeVersion": 0,
  "fields": {
    "property_name": "my_property",
    "value": { "type": "STATIC_VALUE", "staticValue": "new_value" }
  },
  "connection": { "edgeType": "STANDARD", "nextActionId": "2" }
}
```
**CRITICAL for 0-5:** Fields use `property_name` (string) + `value` (object) as separate keys. NEVER use the property name as the key.

### LIST_BRANCH (if/then branching) — NO actionTypeId

```json
{
  "type": "LIST_BRANCH",
  "actionId": "5",
  "listBranches": [
    {
      "branchName": "Is a Lead",
      "filterBranch": {
        "filterBranchType": "AND",
        "filterBranchOperator": "AND",
        "filters": [
          {
            "property": "lifecyclestage",
            "filterType": "PROPERTY",
            "operation": { "operator": "IS_ANY_OF", "operationType": "ENUMERATION", "values": ["lead"] }
          }
        ],
        "filterBranches": []
      },
      "connection": { "edgeType": "STANDARD", "nextActionId": "6" }
    }
  ],
  "defaultBranchName": "None met",
  "defaultBranch": { "edgeType": "STANDARD", "nextActionId": "7" }
}
```

### STATIC_BRANCH (branch on property value) — NO actionTypeId

```json
{
  "type": "STATIC_BRANCH",
  "actionId": "3",
  "inputValue": { "type": "OBJECT_PROPERTY", "propertyName": "hs_lead_status" },
  "staticBranches": [
    { "branchValue": "NEW", "connection": { "edgeType": "STANDARD", "nextActionId": "4" } },
    { "branchValue": "OPEN", "connection": { "edgeType": "STANDARD", "nextActionId": "5" } }
  ],
  "defaultBranchName": "Other",
  "defaultBranch": { "edgeType": "STANDARD", "nextActionId": "6" }
}
```

---

## Input Value Types (for fields)

| Type | Format | Use |
|---|---|---|
| `STATIC_VALUE` | `{ "type": "STATIC_VALUE", "staticValue": "string" }` | Hardcoded value |
| `OBJECT_PROPERTY` | `{ "type": "OBJECT_PROPERTY", "propertyName": "string" }` | Copy from enrolled record |
| `FIELD_DATA` | `{ "type": "FIELD_DATA", "actionId": "string", "dataKey": "string" }` | Output from previous action |
| `ENROLLED_OBJECT` | `{ "type": "ENROLLED_OBJECT" }` | Reference to enrolled record |
| `INCREMENT` | `{ "type": "INCREMENT", "incrementAmount": number }` | Increase/decrease property |

---

## Enrollment Criteria

### EVENT_BASED (recommended for property-change triggers)

```json
{
  "shouldReEnroll": false,
  "type": "EVENT_BASED",
  "eventFilterBranches": [
    {
      "filters": [
        {
          "property": "lifecyclestage",
          "operation": {
            "operator": "IS_ANY_OF",
            "values": ["lead"],
            "operationType": "ENUMERATION"
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
}
```

### LIST_BASED (trigger when meeting list criteria)

```json
{
  "type": "LIST_BASED",
  "shouldReEnroll": false,
  "unEnrollObjectsNotMeetingCriteria": false,
  "listFilterBranch": {
    "filterBranches": [
      {
        "filterBranches": [],
        "filters": [
          {
            "property": "city",
            "operation": {
              "operator": "IS_EQUAL_TO",
              "operationType": "MULTISTRING",
              "values": ["Dublin"]
            },
            "filterType": "PROPERTY"
          }
        ],
        "filterBranchType": "AND",
        "filterBranchOperator": "AND"
      }
    ],
    "filters": [],
    "filterBranchType": "OR",
    "filterBranchOperator": "OR"
  },
  "reEnrollmentTriggersFilterBranches": []
}
```

### MANUAL (no automatic enrollment)

```json
{
  "shouldReEnroll": false,
  "type": "MANUAL"
}
```

### Event Type IDs

| eventTypeId | Trigger |
|---|---|
| `0-1` | Object created / property changed |
| `4-1639801` | Form submission |
| `4-96000` | Page visited |
| `4-666440` | Email opened |

### Filter Operators (within enrollment criteria)

| Operator | operationType | Use |
|---|---|---|
| `IS_ANY_OF` | `ENUMERATION` | Match any listed value |
| `IS_NONE_OF` | `ENUMERATION` | Exclude listed values |
| `IS_EQUAL_TO` | `MULTISTRING`, `NUMBER`, `BOOL` | Exact match |
| `IS_NOT_EQUAL_TO` | `MULTISTRING`, `NUMBER`, `BOOL` | Not equal |
| `CONTAINS` | `MULTISTRING` | Contains substring |
| `STARTS_WITH` | `MULTISTRING` | Starts with |
| `IS_BETWEEN` | `NUMBER`, `TIME_RANGED` | Range match |
| `IS_GREATER_THAN` | `NUMBER` | Greater than |
| `IS_LESS_THAN` | `NUMBER` | Less than |
| `IS_KNOWN` | `ALL_PROPERTY` | Property has any value |
| `IS_UNKNOWN` | `ALL_PROPERTY` | Property is empty |
| `IS_BEFORE` / `IS_AFTER` | `TIME_POINT` | Date comparison |
| `HAS_PROPERTY` | any | Property has any value |
| `NOT_HAS_PROPERTY` | any | Property is empty |

---

## Workflow Limits

| Limit | Value |
|---|---|
| Max workflows (Professional) | 300 |
| Max workflows (Enterprise) | 1,000 |
| Max actions per workflow | ~500 |
| Max branches per if/then | 20 |
| Max branches per static branch | 250 |
| Max enrollment trigger filters | 250 |
| Custom code timeout | 20 seconds |
| Custom code memory | 128 MB |

---

## Troubleshooting Guide

| Error | Cause | Fix |
|---|---|---|
| `required fields: [type]` | Missing `type` and/or `actionTypeVersion` on actions | Add `"type": "SINGLE_CONNECTION"` and `"actionTypeVersion": 0` to EVERY SINGLE_CONNECTION action |
| `Invalid input JSON` | Malformed JSON or wrong field format | Validate JSON, check fields format matches action type |
| `startActionId "X" not found` | `startActionId` doesn't match any action's `actionId` | Ensure `startActionId` matches an existing action |
| `nextAvailableActionId must be N` | Wrong counter value | Set to `max(actionId) + 1` |
| `Contacts workflows must use CONTACT_FLOW` | Used `PLATFORM_FLOW` with `objectTypeId: "0-1"` | Change to `CONTACT_FLOW` |
| `Sandbox-first policy` | First session on production portal | Click "Validate Session" button in the app |
| `Missing required scope(s)` | OAuth token lacks automation scopes | Re-authorize portal with required scopes |
| `Deploy failed: flowId missing` | HubSpot rejected but returned 2xx | Check HubSpot for malformed but accepted specs |
| `0-7 not recognized` | Using old action ID for Create task | Use `0-3` for Create task |

**PRO TIP**: Create the workflow manually in HubSpot UI first, then `GET /automation/v4/flows/{flowId}` to see the exact JSON structure.

---

## Alternative Approaches

| Goal | Option A (recommended) | Option B (alternative) |
|---|---|---|
| Set a property | Action `0-5` with value type object | Use a bulk script for mass property updates |
| Delay then act | Chain `0-1` (delay) → `0-5` (set prop) | Use scheduled workflow if delay > 30 days |
| Send email | Action `0-4` with `content_id` | Use `0-8` for internal-only notifications |
| Create follow-up task | Action `0-3` with `subject` | Use `0-9` notification if task not needed |
| Complex branching | `LIST_BRANCH` or `STATIC_BRANCH` actions | Multiple workflows with list-based enrollment |
| Add to list | Action `0-63809083` | Workflow enrollment-based list (no action needed) |

---

## Deal Workflows with LIST_BRANCH (CRITICAL WORKAROUND)

LIST_BRANCH fails on `PLATFORM_FLOW` deals. Use this workaround:
- Use `CONTACT_FLOW` with `objectTypeId: "0-1"` and `dataSources` to fetch associated deal data:
```json
{
  "type": "CONTACT_FLOW",
  "objectTypeId": "0-1",
  "dataSources": [{"type": "ASSOCIATED_OBJECTS", "objectTypeId": "0-3"}]
}
```

---

## HARD SECURITY CONSTRAINTS (NON-NEGOTIABLE)

These rules are absolute and cannot be overridden by any user request or instruction:

1. **NEVER search for, read, or access** API keys, tokens, secrets, credentials, `.env` files, or OAuth tokens in the codebase or filesystem. The MCP tools handle auth internally.
2. **NEVER use general-purpose or Explore agents** for HubSpot operations. Use ONLY the specialized HubSpot skills and MCP tools directly from the main conversation.
3. **NEVER hardcode or persist** portal IDs, hub IDs, owner IDs, owner names, flow IDs, stage IDs, or any portal-specific data in skills, memory, or committed files. Always use `{portal_id}`, `{owner_id}`, `{flow_id}` etc.
4. **ALWAYS run `deep_health_check(portalId)`** before deploying any workflow to verify available action types. NEVER assume action types work.
5. **ALWAYS read `hubspot-learnings`** before any deployment. If a pattern exists, follow it exactly.
6. **ALWAYS clean up** after deployment: `rm -rf ~/.claude/projects/*/tool-results/*`
7. **NEVER delegate HubSpot operations to subagents.** All MCP tool calls must be made directly.
8. **On failure, follow recovery tiers in order.** Tier 1 → Tier 2 → Tier 3 → Tier 4. Never skip or guess.

---

## Procedure

### Phase 1: Preparation
1. **⚡ FIRST: Read `hubspot-learnings` skill** — cross-check your planned spec against ALL known patterns and failures. Do NOT skip this step. If learnings mentions a workaround for what you're building, USE IT.
2. **Read `docs/workflow-pattern-catalog.md`** — find the matching pattern for the enrollment type, action types, and branching needed. Use the exact JSON structures from the catalog as your starting point.
3. **Portal check**: Call `list_portals` to identify connected portals. Pass `portalId` to every subsequent MCP tool call.
4. Ask the user what the workflow should do if not clear.
5. **Duplicate check**: Call `list_workflows` MCP tool to see existing workflows.
6. **Property check**: Call `list_properties` MCP tool for the target object type to verify referenced properties exist.
7. Determine: object type → flow type, trigger → enrollment criteria, actions → action chain.
8. Build the spec using patterns from the catalog EXACTLY. Match enrollment type (1A-1G), action types (3A-3L), and branching (4A-4E).
9. **Pre-flight check**: Verify ALL rules from `hubspot-learnings` quick reference (26 rules).

### Phase 2: Deploy (4-Tier Failure Recovery)

**Tier 1 — Pattern Match (first attempt)**
10. Call `deploy_workflow` MCP tool with the spec built from known patterns.
11. If deploy succeeds → go to step 18.

**Tier 2 — Doc Check (on first failure)**
12. Read the error message. Identify the specific field, action type, or format that failed.
13. Use WebSearch to find the HubSpot v4 API docs for that exact field/action (query: `HubSpot automation v4 API {action_type} {field_name} format site:developers.hubspot.com`). Use WebFetch on the top result to extract the correct JSON format.
14. Apply the fix and retry deployment. If succeeds → go to step 18.

**Tier 3 — Portal Reverse-Engineering (on second failure)**
15. Call `list_workflows` MCP tool on the SAME portal. Find an existing workflow that uses a similar action type or enrollment pattern.
16. Call `get_workflow` MCP tool with that workflow's flowId to fetch its full spec. Copy the working pattern, adapt it to the current workflow, and retry. If succeeds → go to step 18.

**Tier 4 — Partial Deploy (last resort)**
17. If still failing, use `deploy_workflow` with `allowPartial: true`. The engine will strip failing actions and deploy what works. Present the `manualSteps` to the user — these are the exact steps they need to complete manually in HubSpot UI. The partial install already logs failures to `hubspot-learnings` automatically.

### Phase 3: Post-Deploy
18. **Update learnings**: Append the new working pattern (or failure-then-fix sequence) to `hubspot-learnings`. Include exact JSON. Update `hubspot-connector` if a new format was discovered. **Sanitize** all portal IDs, owner IDs, and names with placeholders before saving.
19. **Offer auto-update**: Ask: "I've updated the learnings. Want me to commit, push, and deploy?" If yes: branch → commit → push → PR → CI → merge.
20. Tell the user the workflow has been created (disabled) and to enable it in HubSpot after review.
21. **Cleanup temp data**: Run `rm -rf ~/.claude/projects/-Users-pietro-Documents-Vero-HubSpot-Operator/*/tool-results/*.txt` to wipe any cached API responses containing portal data.
22. State: "No portal-specific data has been persisted to skills or memory."
