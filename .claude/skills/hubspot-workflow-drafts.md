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
nextAvailableActionId: 3               # REQUIRED — must equal max(actionId) + 1
enrollmentCriteria:                    # REQUIRED — see Enrollment section
  type: EVENT_BASED
  shouldReEnroll: false
  eventFilterBranches: [...]
actions:                               # REQUIRED — array, min 1 action
  - actionId: "1"                      # string, sequential from "1"
    actionTypeId: "0-5"                # REQUIRED — numeric ID, NOT name
    actionTypeVersion: 0               # REQUIRED — always 0
    type: SINGLE_CONNECTION            # REQUIRED — connection type
    fields:                            # action-specific — object with value types
      propertyName:
        type: STATIC_VALUE
        staticValue: "newValue"
    connection:
      edgeType: STANDARD
      nextActionId: "2"                # omit or {} for last action
```

## JSON Example (copy-paste ready)

```json
{
  "name": "Lead Qualification Flow",
  "type": "CONTACT_FLOW",
  "objectTypeId": "0-1",
  "isEnabled": false,
  "startActionId": "1",
  "nextAvailableActionId": 4,
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
        "hs_lead_status": {
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
      "connection": {}
    }
  ]
}
```

---

## Critical Rules (Pre-flight Checklist)

| # | Rule | What fails if violated |
|---|------|----------------------|
| 1 | `isEnabled` MUST be `false` | Engine rejects: `SAFETY: isEnabled must be false` |
| 2 | SINGLE_CONNECTION actions MUST have `type: "SINGLE_CONNECTION"` | HubSpot 400: `required fields: [type]` |
| 3 | Every SINGLE_CONNECTION action MUST have `actionTypeVersion: 0` | HubSpot 400: `required fields: [type]` |
| 4 | `actionTypeId` must be numeric string (`"0-5"`) NOT name (`"SET_CONTACT_PROPERTY"`) | HubSpot 400: invalid action type |
| 5 | `nextAvailableActionId` must equal `max(actionId) + 1` | Engine rejects with calculated correct value |
| 6 | `startActionId` must reference an existing action's `actionId` | Engine rejects: `startActionId not found` |
| 7 | Last action's `connection` must be `{}` (empty object) | HubSpot error: circular reference |
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
| `0-5` | Set property | `{propertyName: {type, staticValue}}` | Field key = property name. Value = input value type object. |
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
  "fields": { "propertyName": { "type": "STATIC_VALUE", "staticValue": "value" } },
  "connection": { "edgeType": "STANDARD", "nextActionId": "2" }
}
```

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

## Procedure

1. **Portal check**: Call `list_portals` to identify connected portals. If multiple portals exist, ask the user which one to target. Pass `portalId` to every subsequent MCP tool call.
2. Ask the user what the workflow should do if not clear
3. **Duplicate check**: Call `list_workflows` MCP tool (with `portalId`) to see existing workflows in the portal. Compare the planned workflow name against existing ones. If a workflow with the same or similar name exists, show the user and ask whether to skip, modify, or create with a different name.
3. **Property check**: Call `list_properties` MCP tool for the target object type to verify that any properties referenced in set-property actions or enrollment filters actually exist. If they don't, flag them and offer to create property drafts first.
4. Determine: object type → flow type, trigger → enrollment criteria, actions → action chain
5. Build the spec following the JSON format above EXACTLY
6. **Pre-flight check**: Verify ALL 12 critical rules from the checklist
7. Call `save_workflow_draft` MCP tool with the spec — the tool will also check for duplicate drafts and portal conflicts, returning warnings if found
8. If the tool returns `warning_portal_duplicates`, stop and inform the user
9. Tell the user to deploy from the Workflows page in the app
10. If deploy fails, read the error, match against Troubleshooting Guide, fix the spec, and save a new draft
