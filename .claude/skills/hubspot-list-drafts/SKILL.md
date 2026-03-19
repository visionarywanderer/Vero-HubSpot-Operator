---
description: "Create HubSpot list and segment drafts via the app. Use when: user asks to create, build, or save a list, segment, or audience for HubSpot."
---

# HubSpot List & Segment Draft Skill

When asked to create HubSpot lists or segments, generate valid list specs and save them as drafts using the `save_list_draft` MCP tool. The user deploys from the Lists & Segments page.

---

## List Spec Format

```yaml
# YAML reference — translate to JSON for the MCP tool
name: "Active MQLs"            # REQUIRED — must be globally unique across all public lists
objectTypeId: "0-1"            # REQUIRED — see Object Type IDs
processingType: DYNAMIC        # REQUIRED — "DYNAMIC", "MANUAL", or "SNAPSHOT"
filterBranch:                  # REQUIRED for DYNAMIC/SNAPSHOT, omit for MANUAL
  filterBranchType: OR         # root branch is always OR
  filterBranchOperator: OR
  filters: []                  # root level: always empty array
  filterBranches:              # child branches (AND groups)
    - filterBranchType: AND
      filterBranchOperator: AND
      filters:                 # actual filter conditions
        - filterType: PROPERTY
          property: lifecyclestage
          operation:
            operator: IS_ANY_OF
            values: ["marketingqualifiedlead"]
            operationType: ENUMERATION
      filterBranches: []       # empty for leaf, or UNIFIED_EVENTS/ASSOCIATION branches
```

## JSON Example — Dynamic Contact List

```json
{
  "name": "Active MQLs - Last 30 Days",
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
            "property": "lifecyclestage",
            "operation": {
              "operator": "IS_ANY_OF",
              "values": ["marketingqualifiedlead"],
              "operationType": "ENUMERATION"
            }
          },
          {
            "filterType": "PROPERTY",
            "property": "hs_lead_status",
            "operation": {
              "operator": "IS_ANY_OF",
              "values": ["NEW", "OPEN"],
              "operationType": "ENUMERATION"
            }
          },
          {
            "filterType": "PROPERTY",
            "property": "firstname",
            "operation": {
              "operator": "IS_EQUAL_TO",
              "values": ["test"],
              "operationType": "MULTISTRING"
            }
          }
        ],
        "filterBranches": []
      }
    ]
  }
}
```

## JSON Example — Manual (Static) List

```json
{
  "name": "Event Attendees - March 2026",
  "objectTypeId": "0-1",
  "processingType": "MANUAL"
}
```

## JSON Example — Multi-Condition OR List

```json
{
  "name": "High-Value or Enterprise Contacts",
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
            "property": "annualrevenue",
            "operation": {
              "operator": "IS_BETWEEN",
              "value": 1000000,
              "highValue": 999999999,
              "operationType": "NUMBER"
            }
          }
        ],
        "filterBranches": []
      },
      {
        "filterBranchType": "AND",
        "filterBranchOperator": "AND",
        "filters": [
          {
            "filterType": "PROPERTY",
            "property": "company_size",
            "operation": {
              "operator": "IS_ANY_OF",
              "values": ["enterprise"],
              "operationType": "ENUMERATION"
            }
          }
        ],
        "filterBranches": []
      }
    ]
  }
}
```

## JSON Example — Rolling Date Window (TIME_RANGED)

```json
{
  "filterType": "PROPERTY",
  "property": "createdate",
  "operation": {
    "operationType": "TIME_RANGED",
    "operator": "IS_BETWEEN",
    "lowerBoundEndpointBehavior": "INCLUSIVE",
    "upperBoundEndpointBehavior": "INCLUSIVE",
    "lowerBoundTimePoint": {
      "timezoneSource": "CUSTOM",
      "zoneId": "US/Eastern",
      "indexReference": { "referenceType": "TODAY" },
      "offset": { "days": -30 },
      "timeType": "INDEXED"
    },
    "upperBoundTimePoint": {
      "timezoneSource": "CUSTOM",
      "zoneId": "US/Eastern",
      "indexReference": { "referenceType": "NOW" },
      "timeType": "INDEXED"
    }
  }
}
```

---

## Critical Rules (Pre-flight Checklist)

| # | Rule | Error if violated |
|---|------|------------------|
| 1 | `processingType` must be `"DYNAMIC"`, `"MANUAL"`, or `"SNAPSHOT"` | 400: invalid processing type |
| 2 | `objectTypeId` must be a valid ID (see table) | 400: invalid object type |
| 3 | Dynamic/Snapshot lists MUST have `filterBranch` | 400: filterBranch required |
| 4 | Manual lists MUST NOT have `filterBranch` | 400: unexpected field |
| 5 | Root `filterBranch` must be type `"OR"` | Filter logic breaks |
| 6 | Root `filters` array must be empty `[]` | Unexpected filter behavior |
| 7 | Child branches must be type `"AND"` | Filter logic breaks |
| 8 | Child `filterBranches` must be empty `[]` (unless using UNIFIED_EVENTS or ASSOCIATION) | Max 2 levels of nesting |
| 9 | Each filter needs `filterType`, `property`, `operation` | 400: missing fields |
| 10 | `operation` needs `operator` and `operationType` | 400: invalid operation |
| 11 | `operationType` must match the property's actual type | Silently returns wrong results |
| 12 | List `name` must be globally unique across all public lists in the portal | 400: duplicate name |
| 13 | Max 250 filters per list | 400: filter limit exceeded |
| 14 | Dynamic list membership CANNOT be modified via API | 400: membership is filter-driven |

---

## Processing Type Differences

| Aspect | MANUAL | DYNAMIC | SNAPSHOT |
|---|---|---|---|
| Filter definition | None | Required | Required at creation |
| Membership updates | API/manual only | Automatic (filter-driven) | API/manual after initial processing |
| Can add/remove via API | Yes | **No** | Yes (after processing) |
| Use case | Static list of records | Auto-updating segment | Point-in-time snapshot |

---

## Filter Branch Structure (Visual)

```
Root (OR) ─── filters: []
  ├── Branch 1 (AND) ─── filters: [filter_a, filter_b]   ← AND conditions
  │                      filterBranches: []
  ├── Branch 2 (AND) ─── filters: [filter_c]              ← OR with Branch 1
  │                      filterBranches: []
  └── Branch 3 (AND) ─── filters: [filter_d, filter_e]    ← OR with Branch 1 & 2
                         filterBranches: [UNIFIED_EVENTS or ASSOCIATION branches]
```

**Logic**: `(filter_a AND filter_b) OR (filter_c) OR (filter_d AND filter_e)`

**Valid filterBranchType values**: `OR`, `AND`, `UNIFIED_EVENTS`, `ASSOCIATION`, `NOT_ALL`, `NOT_ANY`

---

## Object Type IDs

| Object | ID | Notes |
|---|---|---|
| Contacts | `0-1` | Most common |
| Companies | `0-2` | Company lists |
| Deals | `0-3` | Deal lists |
| Tickets | `0-5` | Ticket lists |
| Products | `0-7` | |
| Line Items | `0-8` | |
| Quotes | `0-14` | |
| Leads | `0-136` | |
| Orders | `0-123` | |
| Custom Objects | `2-XXXXX` | Portal-specific ID |

---

## Filter Operators (Complete Reference)

### For ENUMERATION operationType

| Operator | Input | Description |
|---|---|---|
| `IS_ANY_OF` | `values: ["a", "b"]` | Matches any listed value |
| `IS_NONE_OF` | `values: ["a", "b"]` | Excludes listed values |
| `IS_EXACTLY` | `values: ["a", "b"]` | Matches exact set (multi-select checkbox) |
| `CONTAINS_ALL` | `values: ["a", "b"]` | Contains all listed values (multi-select) |
| `HAS_EVER_BEEN_ANY_OF` | `values: ["a"]` | Property historically had any listed value |
| `HAS_NEVER_BEEN_ANY_OF` | `values: ["a"]` | Property never had any listed value |
| `HAS_PROPERTY` | (none) | Has any value set |
| `NOT_HAS_PROPERTY` | (none) | Is empty/not set |

### For MULTISTRING operationType

**IMPORTANT**: `MULTISTRING` is the correct operationType for most string properties when using substring matching (contains, starts with, ends with). Use this instead of `STRING` for those operators.

| Operator | Input | Description |
|---|---|---|
| `IS_EQUAL_TO` | `values: ["a", "b"]` | Matches any listed value |
| `IS_NOT_EQUAL_TO` | `values: ["a", "b"]` | Does not match any listed value |
| `CONTAINS` | `values: ["keyword"]` | Contains substring |
| `DOES_NOT_CONTAIN` | `values: ["keyword"]` | Does not contain |
| `STARTS_WITH` | `values: ["prefix"]` | Starts with value |
| `ENDS_WITH` | `values: ["suffix"]` | Ends with value |

### For STRING operationType

| Operator | Input | Description |
|---|---|---|
| `IS_EQUAL_TO` | `value: "exact"` | Exact match |
| `IS_NOT_EQUAL_TO` | `value: "exact"` | Not exact match |
| `HAS_EVER_BEEN_EQUAL_TO` | `value: "val"` | Property historically had this value |
| `HAS_NEVER_BEEN_EQUAL_TO` | `value: "val"` | Property never had this value |
| `HAS_PROPERTY` | (none) | Has any value |
| `NOT_HAS_PROPERTY` | (none) | Is empty |

### For NUMBER operationType

| Operator | Input | Description |
|---|---|---|
| `IS_EQUAL_TO` | `value: 100` | Exact match |
| `IS_NOT_EQUAL_TO` | `value: 100` | Not equal |
| `IS_BETWEEN` | `value: 10, highValue: 100` | Range (inclusive) |
| `IS_NOT_BETWEEN` | `value: 10, highValue: 100` | Outside range |
| `IS_GREATER_THAN` | `value: 100` | Greater than |
| `IS_GREATER_THAN_OR_EQUAL_TO` | `value: 100` | Greater than or equal |
| `IS_LESS_THAN` | `value: 100` | Less than |
| `IS_LESS_THAN_OR_EQUAL_TO` | `value: 100` | Less than or equal |
| `HAS_PROPERTY` | (none) | Has any value |
| `NOT_HAS_PROPERTY` | (none) | Is empty |

### For TIME_POINT operationType (precise date filtering)

| Operator | Input | Description |
|---|---|---|
| `IS_AFTER` | `timePoint: {...}` | After a specific date/time |
| `IS_BEFORE` | `timePoint: {...}` | Before a specific date/time |

### For TIME_RANGED operationType (date range / rolling window)

| Operator | Input | Description |
|---|---|---|
| `IS_BETWEEN` | `lowerBoundTimePoint, upperBoundTimePoint` | Between two dates |
| `IS_NOT_BETWEEN` | `lowerBoundTimePoint, upperBoundTimePoint` | Outside date range |

**TimePoint types**: `DATE` (absolute), `INDEXED` (relative/rolling with offset), `PROPERTY_REFERENCED` (compare to another property)

### For BOOL operationType

| Operator | Input | Description |
|---|---|---|
| `IS_EQUAL_TO` | `value: true` | Is true |
| `IS_NOT_EQUAL_TO` | `value: true` | Is false |
| `HAS_EVER_BEEN_EQUAL_TO` | `value: true` | Was ever true |
| `HAS_PROPERTY` | (none) | Has been set |
| `NOT_HAS_PROPERTY` | (none) | Never set |

### Operation Object Optional Fields

| Field | Description |
|---|---|
| `includeObjectsWithNoValueSet` | Boolean — when `true`, records with no value for the property are also included |
| `propertyParser` | `"VALUE"` (default — filter on value) or `"UPDATED_AT"` (filter on when property was last changed) |

---

## Special Filter Types

### Association Filter (filter by associated records)

```json
{
  "filterBranchType": "ASSOCIATION",
  "filterBranchOperator": "AND",
  "objectTypeId": "0-3",
  "operator": "IN_LIST",
  "associationTypeId": 280,
  "associationCategory": "HUBSPOT_DEFINED",
  "filters": [
    {
      "filterType": "PROPERTY",
      "property": "dealstage",
      "operation": {
        "operationType": "ENUMERATION",
        "operator": "IS_ANY_OF",
        "values": ["closedwon"]
      }
    }
  ],
  "filterBranches": []
}
```

### Behavioral Event Filter (UNIFIED_EVENTS)

```json
{
  "filterBranchType": "UNIFIED_EVENTS",
  "filterBranchOperator": "AND",
  "eventTypeId": "pe1234567_my_event",
  "operator": "HAS_COMPLETED",
  "filters": [
    {
      "filterType": "PROPERTY",
      "property": "event_property",
      "operation": {
        "operationType": "MULTISTRING",
        "operator": "IS_EQUAL_TO",
        "values": ["some_value"]
      }
    }
  ],
  "filterBranches": []
}
```

---

## Common Filter Patterns

### Has email address
```json
{ "filterType": "PROPERTY", "property": "email", "operation": { "operator": "HAS_PROPERTY", "operationType": "MULTISTRING" } }
```

### Name contains keyword
```json
{ "filterType": "PROPERTY", "property": "firstname", "operation": { "operator": "CONTAINS", "values": ["keyword"], "operationType": "MULTISTRING" } }
```

### Specific owner
```json
{ "filterType": "PROPERTY", "property": "hubspot_owner_id", "operation": { "operator": "IS_ANY_OF", "values": ["12345678"], "operationType": "ENUMERATION" } }
```

### Not in lifecycle stage
```json
{ "filterType": "PROPERTY", "property": "lifecyclestage", "operation": { "operator": "IS_NONE_OF", "values": ["customer", "evangelist"], "operationType": "ENUMERATION" } }
```

### Revenue above threshold
```json
{ "filterType": "PROPERTY", "property": "annualrevenue", "operation": { "operator": "IS_GREATER_THAN", "value": 100000, "operationType": "NUMBER" } }
```

---

## Troubleshooting Guide

| Error | Cause | Fix |
|---|---|---|
| `Invalid filterBranch structure` (400) | Wrong nesting — filters at root, or wrong branch types | Root=OR with empty filters, children=AND with actual filters |
| `Invalid operationType` (400) | operationType doesn't match the property's actual type | Check property definition — use MULTISTRING for string properties with substring matching |
| `Property not found` (400) | Typo in property name or using label instead of internal name | Use the API internal name (e.g., `lifecyclestage` not `Lifecycle Stage`) |
| `List limit exceeded` (400) | Portal list limit reached (varies by tier) | Delete unused lists; Free=5, Starter=25, Pro=1000, Enterprise=1500 |
| `Invalid operator for type` (400) | Using `CONTAINS` with wrong operationType | `CONTAINS` requires `MULTISTRING`, not `STRING` |
| `Duplicate list name` (400) | List name already exists | List names must be globally unique — choose a unique name |
| Empty list results | Correct structure but wrong operationType | Most common: using STRING when ENUMERATION or MULTISTRING is needed |
| `Membership update failed` (400) | Trying to add/remove members on a DYNAMIC list | Dynamic list membership is filter-driven — cannot be modified via API |

**PRO TIP**: Create the desired filter in HubSpot UI first, then `GET /crm/v3/lists/{listId}?includeFilters=true` to see the exact JSON structure.

---

## Alternative Approaches

| Goal | Option A (recommended) | Option B (alternative) |
|---|---|---|
| Complex multi-criteria segment | Dynamic list with OR branches | Multiple simple lists + workflow logic |
| One-time event list | Manual list, add members via API | Snapshot list with date filter |
| Suppression list | Dynamic list with exclusion criteria | Manual list maintained by team |
| Customer segment by revenue | Dynamic list with NUMBER filter | Workflow → set property → list by property |
| Point-in-time snapshot | Snapshot list (processes once) | Dynamic list → schedule conversion to static |

---

## Procedure

1. **⚡ FIRST: Read `hubspot-learnings` skill** — cross-check your planned spec against ALL known patterns and failures. Do NOT skip this step.
2. **Portal check**: Call `list_portals` to identify connected portals. If multiple portals exist, ask the user which one to target. Pass `portalId` to every subsequent MCP tool call.
3. Ask the user: what should the list filter for? Dynamic, manual, or snapshot?
3. **Duplicate check**: Call `list_lists` MCP tool (with `portalId`) to see existing lists in the portal. Compare the planned list name against existing ones. If a list with the same name exists, tell the user — list names must be globally unique and deploying will fail.
3. **Property check**: Call `list_properties` MCP tool for the target object type to verify that any properties used in filters actually exist. If they don't, flag them and offer to create property drafts first.
4. Determine object type and appropriate `objectTypeId`
5. For dynamic/snapshot lists:
   - Identify filter conditions (AND groups within OR branches)
   - Map each condition to correct `operationType`:
     - Dropdowns/selects → `ENUMERATION`
     - Text fields with substring matching → `MULTISTRING`
     - Text fields with exact/historical matching → `STRING`
     - Numbers → `NUMBER`
     - Dates → `TIME_POINT` or `TIME_RANGED`
     - Booleans → `BOOL`
   - Structure: root OR → child AND branches → individual filters
6. For manual lists: just `name`, `objectTypeId`, `processingType: "MANUAL"`
7. **Pre-flight check**: Verify filter structure, operator/operationType matches, unique list name
8. Call `save_list_draft` MCP tool with the spec — the tool will also check for duplicate drafts and portal conflicts, returning warnings if found
9. If the tool returns `warning_portal_duplicates`, stop and inform the user — list names must be unique
10. Tell the user to deploy from the Lists & Segments page
11. If list returns unexpected results, check operationType matches the property's actual type, AND **append the new failure pattern to `hubspot-learnings`**
