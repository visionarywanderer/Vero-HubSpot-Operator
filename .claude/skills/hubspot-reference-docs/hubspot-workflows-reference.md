# HubSpot Workflows API v4 — Complete Reference

The Workflows API (v4, beta) lets you create, read, update, and delete automated workflows programmatically. **Always use v4** — v3 is legacy and lacks modern action types, AI actions, and labeled associations. Requires Professional tier or higher.

## Required Scopes

- `automation` (base scope for all workflow operations)
- Additional sensitive-data scopes if workflows touch restricted properties

## Endpoints

| Method | Path | Summary |
|--------|------|---------|
| POST | `/automation/v4/flows` | Create a workflow |
| GET | `/automation/v4/flows` | List workflows (paginated, max 100) |
| GET | `/automation/v4/flows/{flowId}` | Get a specific workflow |
| POST | `/automation/v4/flows/batch/read` | Batch read workflows |
| PUT | `/automation/v4/flows/{flowId}` | Update a workflow |
| DELETE | `/automation/v4/flows/{flowId}` | Delete a workflow (permanent!) |

## Workflow Types

| Type | objectTypeId | Use |
|------|-------------|-----|
| `CONTACT_FLOW` | `0-1` | Contact-based workflows |
| `PLATFORM_FLOW` | `0-2`, `0-3`, `0-5`, etc. | Company, deal, ticket, custom object workflows |

`flowType` is always `"WORKFLOW"`.

## Object Type IDs

| Object | ID | Object | ID |
|--------|-----|--------|-----|
| Contact | `0-1` | Company | `0-2` |
| Deal | `0-3` | Note | `0-4` |
| Ticket | `0-5` | Product | `0-7` |
| Line Item | `0-8` | Payment | `0-47` |
| Invoice | `0-53` | Lead | `0-136` |
| Custom Objects | `2-XXXXXX` | | |

---

## Top-Level Workflow Structure

```json
{
  "name": "Workflow Name",
  "type": "CONTACT_FLOW",
  "objectTypeId": "0-1",
  "flowType": "WORKFLOW",
  "isEnabled": false,
  "startActionId": "1",
  "nextAvailableActionId": "4",
  "enrollmentCriteria": { ... },
  "actions": [ ... ],
  "dataSources": [ ... ],
  "timeWindows": [],
  "blockedDates": [],
  "suppressionListIds": [],
  "canEnrollFromSalesforce": false
}
```

**Required fields:** `name`, `type`, `objectTypeId`, `startActionId`, `nextAvailableActionId` (string!), `enrollmentCriteria`, `actions`.

**Safety:** Always deploy with `isEnabled: false`. The app enforces this automatically.

---

## Action Types — Complete Catalog

### Core CRM Actions

| actionTypeId | Action | Fields | Placeholder? |
|---|---|---|---|
| `0-1` | **Delay (set time)** | `delta` (string), `time_unit` | No |
| `0-3` | **Create task** | `task_type`, `subject`, `body`, `priority` | Partial |
| `0-4` | **Send email** | `content_id` (email template ID) | Yes — set in UI |
| `0-5` | **Set property value** | `property_name`, `value` | No |
| `0-8` | **Send internal notification** | `user_ids[]`, `subject`, `body` | Yes — `user_ids: []` |
| `0-9` | **Send in-app notification** | `user_ids[]`, `subject`, `body` | Yes — `user_ids: []` |
| `0-11` | **Rotate to owner** | | Yes |
| `0-14` | **Create record** | `object_type_id`, `properties[]`, `associations[]` | Partial |
| `0-15` | **Go to workflow** | | Yes — `fields: {}` |
| `0-18224765` | **Delete contact** | | Yes — `fields: {}` |

### Delay Variants

| actionTypeId | Variant | Key Fields |
|---|---|---|
| `0-1` | Set time delay | `delta`, `time_unit` (MINUTES/HOURS/DAYS) |
| `0-29` | Wait for event | `event_filter_branches[]`, `expiration_minutes` |
| `0-35` | Delay until date | `date` (STATIC_VALUE or OBJECT_PROPERTY), `delta`, `time_unit`, `time_of_day` |

### List & Sequence Management

| actionTypeId | Action | Fields |
|---|---|---|
| `0-63809083` | **Add to static list** | `listId` |
| `0-63863438` | **Remove from static list** | `listId` |
| `0-46510720` | **Enroll in sequence** | `sequenceId`, `senderType`, `userId` |
| `0-4702372` | **Unenroll from sequence** | |

### Association Actions

| actionTypeId | Action | Fields |
|---|---|---|
| `0-63189541` | **Create association** | Yes — `fields: {}` (configure in UI) |
| `0-61139476` | **Remove association labels** | |
| `0-61139484` | **Update association labels** | |

### Communication Actions

| actionTypeId | Action | Fields |
|---|---|---|
| `0-25` | **Send SMS** | |
| `0-25085031` | **Send marketing email** | `targetContact` |
| `0-43347357` | **Manage subscriptions** | `channel`, `optState`, `subscriptionId`, `legalBasis` |

### Record Management

| actionTypeId | Action | Fields |
|---|---|---|
| `0-169425243` | **Create note** | `note_body` (HTML), `pin_note` |
| `0-33` | **Custom value formatting** | `template`, `locale` |
| `0-225935194` | **Validate phone number** | |

### Breeze AI Actions (Beta)

| actionTypeId | Action | Fields |
|---|---|---|
| `0-177946906` | **Enrich record** | `bi_enrichment_overwrite`, `object_to_enrich` |
| `0-195318603` | **Summarize record** | `objectToSummarize` |
| `0-207702619` | **Company research (ICP)** | `domain` |
| `0-216647524` | **AI agent (research)** | `prompt`, `tools`, `outputDataType`, `targetObject` |
| `0-172351286` | **Custom AI prompt** | |
| `0-201091202` | **Fill smart property** | |

### Integration Actions (third-party, prefix `1-`)

| actionTypeId | Action |
|---|---|
| `1-179507819` | Send Slack notification |
| `1-100451` | Create Asana task |
| `1-2825058` | Create Trello card |
| `1-26047300` | Google Drive create folder |
| `1-2796901` | Google Sheets add row |
| `1-1549914` | MessageMedia SMS |
| `1-75765850` | Generate invoice |

---

## Action Field Formats

### Set Property (0-5) — 4 Variations

**Direct static value:**
```json
{
  "property_name": "favourite_colour",
  "value": { "staticValue": "Blue", "type": "STATIC_VALUE" }
}
```

**Copy from object property:**
```json
{
  "property_name": "custom_field",
  "value": { "propertyName": "email", "type": "OBJECT_PROPERTY" }
}
```

**Set on associated object (static):**
```json
{
  "property_name": "dealname",
  "association": { "associationCategory": "HUBSPOT_DEFINED", "associationTypeId": 280 },
  "value": { "staticValue": "New Value", "type": "STATIC_VALUE" }
}
```

**Set on associated object (copy property):**
```json
{
  "property_name": "dealname",
  "association": { "associationCategory": "HUBSPOT_DEFINED", "associationTypeId": 280 },
  "value": { "propertyName": "company", "type": "OBJECT_PROPERTY" }
}
```

### Create Task (0-3)
```json
{
  "task_type": "TODO",
  "subject": "Follow up with {{ enrolled_object.firstname }}",
  "body": "<p>Contact needs follow up</p>",
  "priority": "HIGH",
  "associations": [{
    "target": { "associationCategory": "HUBSPOT_DEFINED", "associationTypeId": 204 },
    "value": { "type": "ENROLLED_OBJECT" }
  }],
  "use_explicit_associations": "true"
}
```
`task_type`: `"TODO"` | `"CALL"`. `priority`: `"NONE"` | `"LOW"` | `"MEDIUM"` | `"HIGH"`.

### Create Record (0-14)
```json
{
  "object_type_id": "0-3",
  "properties": [
    { "targetProperty": "dealname", "value": { "staticValue": "New Deal", "type": "STATIC_VALUE" } },
    { "targetProperty": "pipeline", "value": { "propertyName": "hs_pipeline", "type": "OBJECT_PROPERTY" } },
    { "targetProperty": "closedate", "value": { "timeDelay": { "delta": 30, "timeUnit": "DAYS" }, "type": "RELATIVE_DATETIME" } }
  ],
  "associations": [{
    "target": { "associationCategory": "HUBSPOT_DEFINED", "associationTypeId": 3 },
    "value": { "type": "ENROLLED_OBJECT" }
  }],
  "use_explicit_associations": "true"
}
```

### Send Internal Notification (0-8)
```json
{
  "user_ids": ["82517039"],
  "subject": "New lead: {{ enrolled_object.firstname }} {{ enrolled_object.lastname }}",
  "body": "<p>HTML content with {{ template_vars }}</p>"
}
```
Use `"user_ids": []` as placeholder — configure recipient in HubSpot UI.

### Send Email (0-4)
```json
{ "content_id": "178784073234" }
```
Use `fields: {}` or omit `content_id` as placeholder — configure email template in HubSpot UI.

### Delay Until Date (0-35)
```json
{
  "date": { "propertyName": "closedate", "type": "OBJECT_PROPERTY" },
  "delta": "14",
  "time_unit": "DAYS",
  "time_of_day": { "hour": 9, "minute": 0 }
}
```

### Create Note (0-169425243)
```json
{
  "note_body": "<p>{{ enrolled_object.firstname }} - summary here</p>",
  "pin_note": "false"
}
```

### Manage Subscriptions (0-43347357)
```json
{
  "channel": "EMAIL",
  "optState": "OPT_IN",
  "subscriptionId": "422372447",
  "legalBasis": "LEGITIMATE_INTEREST_CLIENT",
  "legalBasisExplanation": "Opted in via workflow",
  "targetContact": "{{ enrolled_object }}"
}
```

### Enroll in Sequence (0-46510720)
```json
{
  "sequenceId": "102740497",
  "senderType": "SPECIFIC_USER",
  "userId": "46753420"
}
```

---

## Field Value Types

| type | Format | Use |
|------|--------|-----|
| `STATIC_VALUE` | `{ staticValue: "...", type }` | Hardcoded value (supports `{{ }}` templates) |
| `OBJECT_PROPERTY` | `{ propertyName: "...", type }` | Copy from enrolled record |
| `FIELD_DATA` | `{ actionId: "1", dataKey: "...", type }` | Output from previous action |
| `ENROLLED_OBJECT` | `{ type }` | Reference to enrolled object (for associations) |
| `COPY_ASSOCIATION` | `{ sourceSpec: {...}, type }` | Copy association from enrolled object |
| `FETCHED_OBJECT_PROPERTY` | Via template: `{{ fetched_objects.name.prop }}` | Associated object property |
| `RELATIVE_DATETIME` | `{ timeDelay: { delta, timeUnit }, type }` | Date relative to enrollment |

### Template Syntax
- `{{ enrolled_object.propertyName }}` — enrolled record's property
- `{{ fetched_objects.fetched_object_NNN.propertyName }}` — associated object's property
- `{{ action_outputs.action_output_N.key }}` — output from prior action

---

## Branch Types

### STATIC_BRANCH — Value Equals (switch/case)

Checks a specific value from a property or prior action output. Up to 250 branches.

```json
{
  "actionId": "3",
  "type": "STATIC_BRANCH",
  "inputValue": {
    "type": "FIELD_DATA",
    "actionId": "2",
    "dataKey": "hs_execution_state"
  },
  "staticBranches": [
    {
      "branchValue": "SUCCESS",
      "connection": { "edgeType": "STANDARD", "nextActionId": "4" }
    },
    {
      "branchValue": "FAILURE",
      "connection": { "edgeType": "STANDARD", "nextActionId": "5" }
    }
  ],
  "defaultBranchName": "Other",
  "defaultBranch": { "edgeType": "STANDARD", "nextActionId": "6" }
}
```

`inputValue.type` options: `OBJECT_PROPERTY`, `FIELD_DATA`, `STATIC_VALUE`, `TIMESTAMP`, `FETCHED_OBJECT_PROPERTY`.

**Important:** `branchValue` must be a literal string — dynamic `{{ }}` expressions are NOT supported here.

### LIST_BRANCH — If/Then with Filters

Property-based if/then with AND/OR filter logic. Up to 20 branches.

**CRITICAL: The field name is `listBranches` (NOT `filterListBranches`).**

```json
{
  "actionId": "2",
  "type": "LIST_BRANCH",
  "listBranches": [
    {
      "branchName": "Has email",
      "filterBranch": {
        "filterBranchType": "OR",
        "filterBranchOperator": "OR",
        "filterBranches": [{
          "filterBranchType": "AND",
          "filterBranchOperator": "AND",
          "filterBranches": [],
          "filters": [{
            "filterType": "PROPERTY",
            "property": "email",
            "operation": { "operationType": "ALL_PROPERTY", "operator": "IS_KNOWN" }
          }]
        }],
        "filters": []
      },
      "connection": { "edgeType": "STANDARD", "nextActionId": "3" }
    }
  ],
  "defaultBranchName": "None matched",
  "defaultBranch": { "edgeType": "STANDARD", "nextActionId": "4" }
}
```

**LIST_BRANCH filter structure:** Always wrap filters in OR → AND → filters hierarchy, even for a single condition.

---

## Enrollment Criteria

### MANUAL
```json
{ "shouldReEnroll": false, "type": "MANUAL" }
```

### LIST_BASED — Filter-based enrollment

```json
{
  "shouldReEnroll": false,
  "type": "LIST_BASED",
  "listFilterBranch": {
    "filterBranchType": "OR",
    "filterBranches": [{
      "filterBranchType": "AND",
      "filterBranchOperator": "AND",
      "filterBranches": [],
      "filters": [
        {
          "filterType": "PROPERTY",
          "property": "lifecyclestage",
          "operation": { "operationType": "ENUMERATION", "operator": "IS_ANY_OF", "values": ["lead"] }
        },
        {
          "filterType": "PROPERTY",
          "property": "email",
          "operation": { "operationType": "STRING", "operator": "CONTAINS", "value": "@" }
        }
      ]
    }],
    "filters": []
  }
}
```

Multiple filters in the same AND block = all must match. Multiple AND blocks under OR = any group can match.

### EVENT_BASED — Trigger on events

```json
{
  "shouldReEnroll": true,
  "type": "EVENT_BASED",
  "eventFilterBranches": [{
    "filters": [{
      "property": "lifecyclestage",
      "operation": { "operationType": "ENUMERATION", "operator": "IS_ANY_OF", "values": ["lead"] },
      "filterType": "PROPERTY"
    }],
    "filterBranches": [],
    "eventTypeId": "4-655002",
    "operator": "HAS_COMPLETED",
    "filterBranchType": "UNIFIED_EVENTS",
    "filterBranchOperator": "AND"
  }]
}
```

---

## Event Type IDs

### CRM Events
| Event | eventTypeId |
|-------|-------------|
| Property value changed | `4-655002` |
| CRM object created | `4-1463224` |
| Playbook log | `4-1814177` |

### Email Events
| Event | eventTypeId |
|-------|-------------|
| Email sent | `4-667638` |
| Email delivered | `4-665536` |
| Email opened | `4-666440` |
| Clicked link in email | `4-666288` |
| Replied to email | `4-665538` |
| Email bounced | `4-5470331` |
| Updated subscription | `4-666289` |

### Form Events
| Event | eventTypeId |
|-------|-------------|
| Form submission | `4-1639801` |
| Form interaction | `4-1639799` |
| Form view | `4-1639797` |

### Meeting & Call Events
| Event | eventTypeId |
|-------|-------------|
| Meeting booked | `4-1720599` |
| Meeting outcome change | `4-1724222` |
| Call started | `4-1733817` |
| Call ended | `4-1741072` |

### Sequence Events
| Event | eventTypeId |
|-------|-------------|
| Enrolled in sequence | `4-675777` |
| Finished sequence | `4-675778` |
| Unenrolled from sequence | `4-675776` |
| Booked meeting through sequence | `4-675773` |

### Web & Ad Events
| Event | eventTypeId |
|-------|-------------|
| Page visited | `4-96000` |
| Ad interaction | `4-1553675` |
| CTA click | `4-1555805` |
| CTA viewed | `4-1555804` |

### Workflow Events
| Event | eventTypeId |
|-------|-------------|
| Achieved workflow goal | `4-1753168` |
| Enrolled in workflow | `4-1466013` |
| Unenrolled from workflow | `4-1466014` |

### SMS Events
| Event | eventTypeId |
|-------|-------------|
| SMS sent | `4-1719453` |
| SMS delivered | `4-1721168` |
| Link in SMS clicked | `4-1722276` |

---

## Filter Operators & Operation Types

### Operation Types

| operationType | Use | Operators |
|---|---|---|
| `ALL_PROPERTY` | Known/unknown check | `IS_KNOWN`, `IS_NOT_KNOWN` |
| `ENUMERATION` | Dropdowns/multi-select | `IS_ANY_OF`, `IS_NONE_OF`, `HAS_EVER_BEEN_ANY_OF`, `HAS_NEVER_BEEN_ANY_OF` |
| `STRING` | Single-line text | `IS_EQUAL_TO`, `IS_NOT_EQUAL_TO`, `CONTAINS`, `DOES_NOT_CONTAIN`, `STARTS_WITH`, `ENDS_WITH` |
| `MULTISTRING` | Multi-line text | Same as STRING |
| `NUMBER` | Numeric | `IS`, `IS_NOT`, `IS_GREATER_THAN`, `IS_LESS_THAN`, `IS_BETWEEN`, `IS_NOT_BETWEEN` |
| `BOOL` | Boolean | `IS`, `IS_NOT`, `HAS_EVER_BEEN`, `HAS_NEVER_BEEN` |
| `TIME_POINT` | Date comparison | `IS_AFTER`, `IS_BEFORE` |
| `TIME_RANGED` | Date range | `IS_BETWEEN`, `IS_NOT_BETWEEN` |

### Filter Types

| filterType | Use | Key Fields |
|---|---|---|
| `PROPERTY` | Record property filter | `property`, `operation` |
| `FORM_SUBMISSION` | Form fill | `formId`, `operator: "FILLED_OUT"` |
| `FORM_SUBMISSION_ON_PAGE` | Form on specific page | `formId`, `pageId` |
| `IN_LIST` | List membership | `listId`, `operator: "IN_LIST"` |
| `ASSOCIATION` | Associated record | `objectTypeId`, `associationTypeId` |

### Filter Branch Types

| filterBranchType | Use |
|---|---|
| `OR` | Root level — any sub-branch matches |
| `AND` | Nested under OR — all filters must match |
| `UNIFIED_EVENTS` | Event completion (EVENT_BASED enrollment) |
| `ASSOCIATION` | Associated object filter |

---

## Data Sources (Fetched Objects)

Use `dataSources` to fetch associated objects for use in actions via `{{ fetched_objects.name.property }}`.

```json
{
  "dataSources": [{
    "name": "fetched_company",
    "objectTypeId": "0-2",
    "associationTypeId": 279,
    "associationCategory": "HUBSPOT_DEFINED",
    "sortBy": { "property": "hs_lastmodifieddate", "order": "DESC" },
    "type": "ASSOCIATION"
  }]
}
```

Common association type IDs:
- Contact → Company: `279`
- Contact → Deal: `4`
- Deal → Contact: `3`
- Deal → Company: `342`

---

## Placeholder Pattern for Draft Workflows

Deploy workflows as disabled drafts with placeholder fields. Configure the specifics in HubSpot UI.

| Action | Placeholder Format |
|---|---|
| Send email (`0-4`) | `fields: {}` or omit `content_id` |
| Internal notification (`0-8`) | `user_ids: []` |
| In-app notification (`0-9`) | `user_ids: []` |
| Create association (`0-63189541`) | `fields: {}` |
| Go to workflow (`0-15`) | `fields: {}` |
| Add/remove from list | Needs `listId` — use a known list or create one first |
| Send email (`0-4`) | `fields: {}` |

---

## Action Node Types

| type | Description | Has actionTypeId? |
|------|-------------|---|
| `SINGLE_CONNECTION` | Standard linear action | Yes |
| `STATIC_BRANCH` | Value-equals switch/case | No |
| `LIST_BRANCH` | If/then with filters | No |
| `CUSTOM_CODE` | JavaScript/Python code | Has special fields |
| `WEBHOOK` | HTTP request | Has special fields |

---

## Update Workflow (PUT) — Critical Rules

1. **Include `revisionId`** from current GET response (optimistic concurrency lock).
2. **Include ALL actions** — omitted actions are permanently deleted.
3. **Remove** `createdAt`, `updatedAt`, and `dataSources` fields before sending.
4. Must include `type` field.
5. Always GET before PUT to get current state.

---

## Best Practices

- Always deploy with `isEnabled: false`, verify in HubSpot UI, then enable.
- Use `LIST_BRANCH` for property-based if/then logic (field: `listBranches`).
- Use `STATIC_BRANCH` for checking action output values (field: `staticBranches`).
- `nextAvailableActionId` must be a **string**, set to highest actionId + 1.
- Use `dataSources` to access associated object properties in actions.
- For cross-object property comparisons (e.g., contact owner = company owner), deploy the structure as a draft and configure the comparison in HubSpot's UI.

## Chaining Multiple LIST_BRANCH Actions

Multiple LIST_BRANCH actions can be used sequentially in the same workflow. The default branch of one LIST_BRANCH can point to another LIST_BRANCH, creating nested if/then logic:

```
Branch 1: Has follow-up date?
  → Yes: delay → create task
  → No (default): Branch 2: Closed lost reason contains "Not Ready"?
    → Yes: 45-day delay → call task
    → No (default): 90-day delay → email task
```

Each LIST_BRANCH is a separate action with its own `actionId`. The `defaultBranch.nextActionId` of the first branch points to the `actionId` of the second branch.

---

## Choosing the Right Operator by Property Type

**CRITICAL: Match the `operationType` to the actual property type in the portal.** Using the wrong combination causes "Invalid request" errors.

| Property type in portal | operationType | Common operators |
|---|---|---|
| `enumeration` / `select` / `radio` / `checkbox` | `ENUMERATION` | `IS_ANY_OF` (uses `values` array) |
| `string` / `text` / `textarea` | `MULTISTRING` | `CONTAINS` (uses singular `value`) |
| `number` | `NUMBER` | `IS_EQUAL_TO`, `IS_GREATER_THAN` |
| `bool` / `booleancheckbox` | `BOOL` | `IS_EQUAL_TO` |
| `date` / `datetime` | `TIME_POINT` | `IS_AFTER`, `IS_BEFORE` |
| Any type (existence check) | `ALL_PROPERTY` | `IS_KNOWN`, `IS_NOT_KNOWN` |

**Key difference:** `ENUMERATION IS_ANY_OF` takes `values: ["a", "b"]` (array). `MULTISTRING CONTAINS` takes `value: "text"` (singular string). Mixing these up causes silent 500 errors.

**Before using a property in a filter**, check its type via `list_properties` or the portal UI. A property named `closed_lost_reason` might be `string/textarea` (use `MULTISTRING`) in one portal and `enumeration/select` (use `ENUMERATION`) in another.

---

## Template Validator vs HubSpot API Format

The app's template validator checks action fields at the **action top level**, not nested inside a `fields` object. But HubSpot's actual v4 API uses `fields: { ... }`. When building templates for the config engine, put fields at the top level:

**Template format (for validator):**
```json
{"actionId": "1", "actionTypeId": "0-1", "delta": "5", "time_unit": "DAYS"}
```

**HubSpot API format (for deploy_workflow):**
```json
{"actionId": "1", "actionTypeId": "0-1", "type": "SINGLE_CONNECTION", "fields": {"delta": "5", "time_unit": "DAYS"}}
```

The `deploy_workflow` tool handles the conversion. When using `save_template_draft`, use the top-level format.

---

## Anti-Patterns

- Using `filterListBranches` instead of `listBranches` for LIST_BRANCH — causes silent 500.
- Using `nextAvailableActionId` as a number instead of string — the error message tells you the correct value.
- Setting `branchValue` to `{{ }}` template in STATIC_BRANCH — must be literal strings.
- Using `IS_NOT_EMPTY` or `HAS_PROPERTY` as string operators — use `IS_KNOWN` with `operationType: "ALL_PROPERTY"`.
- Using `ENUMERATION` operationType on a `string/textarea` property — use `MULTISTRING` instead.
- Using `values` (array) with `MULTISTRING CONTAINS` — it takes singular `value` (string).
- Using `value` (string) with `ENUMERATION IS_ANY_OF` — it takes `values` (array).
- Not checking property types before building filters — same property name can be different types across portals.
- Updating without current `revisionId` — causes validation error.
- Sending partial action list in PUT — missing actions are permanently deleted.
- Using v3 API for new workflows — lacks modern action types, AI actions.
