---
description: "Self-improving knowledge base for HubSpot API patterns. MUST READ before any workflow deploy, property create, pipeline create, list create, or template install. Append new learnings after every failure or new success pattern. Categories: WORKFLOW, PROPERTY, PIPELINE, LIST, TEMPLATE, BULK, GENERAL."
---

# HubSpot Self-Improving Knowledge Base

## How This Works (Instructions for Claude)

### BEFORE Every Operation
1. **Read this entire file** before deploying any workflow, creating any property/pipeline/list, or installing any template
2. **Cross-check** your spec against the Quick Reference rules and the Learnings Log
3. **If a similar pattern exists** in the log, follow the documented fix — don't repeat the mistake

### AFTER a Failure
1. **Append a new entry** to the Learnings Log below with this format:
```
### YYYY-MM-DD — CATEGORY — Short Title
**Trigger:** What was being attempted
**Failed because:** Root cause (be specific — include field names, error messages)
**Fix:** What actually works (include code/JSON if helpful)
**Pattern:** One-line reusable rule for future reference
```
2. **If the failure was due to an unknown API format — Doc Check**: Before just retrying, use WebSearch to find the official HubSpot v4 API docs for the specific action/field that failed. Use WebFetch on the most relevant result to extract the correct format. If no docs help, use `list_workflows` to find an existing workflow on the same portal that uses the problematic action type and reverse-engineer the correct format. Include the source of the fix in the learnings entry.
3. **Update the Quick Reference** if this is a critical rule that prevents common failures
4. **Update `hubspot-connector` SKILL.md** if the discovery reveals action field formats not already documented
5. **Sanitize before saving** — replace any real portal IDs, owner IDs, or names with `{portal_id}`, `{owner_id}`, `{owner_name}` placeholders
6. **Copy this file** to `skills-package/hubspot-learnings/SKILL.md` to keep the shareable package in sync
7. **Offer to commit and deploy**: After appending, ask the user:
   "I've added a new learning. Want me to commit this to git, push, and deploy? This will update the app and skills-package for everyone."
   If they say yes, execute: create branch → commit → push → PR → wait for CI → merge → confirm deploy.

### AFTER a New Success Pattern
1. If a new approach was used for the first time and succeeded, **append a CONFIRMED entry**:
```
### YYYY-MM-DD — CATEGORY — ✅ Short Title (CONFIRMED WORKING)
**What:** Description of what was done
**Pattern:** Reusable rule
```

### Categories
`WORKFLOW` | `PROPERTY` | `PIPELINE` | `LIST` | `TEMPLATE` | `BULK` | `GENERAL`

---

## Quick Reference (Most Critical Rules)

These 15 rules prevent 90% of failures. Check every one before deploying.

| # | Rule | Category |
|---|------|----------|
| 1 | LIST_BRANCH uses `listBranches` — NEVER `filterListBranches` | WORKFLOW |
| 2 | `defaultBranch` must have `nextActionId` — empty `{}` causes 500 | WORKFLOW |
| 3 | ENUMERATION fields: `values: []` (array). MULTISTRING fields: `value:` (singular) | WORKFLOW |
| 4 | Match `operationType` to property type — ENUMERATION for dropdowns, MULTISTRING for text | WORKFLOW |
| 5 | Action type `0-3` (Create task) needs `tasks` scope — check portal scopes via deep_health_check first | WORKFLOW |
| 6 | Action types `0-9` (in-app notification) and `0-11` (rotate owner) cause silent 500s | WORKFLOW |
| 7 | Use Set Property `0-5` with `hubspot_owner_id` instead of rotate-to-owner `0-11` | WORKFLOW |
| 8 | Deal workflows: use `CONTACT_FLOW` + `dataSources` — NOT `PLATFORM_FLOW` with LIST_BRANCH | WORKFLOW |
| 9 | `nextAvailableActionId` must be a **string** equal to highest actionId + 1 | WORKFLOW |
| 10 | All workflow names must start with `[VD]` prefix | GENERAL |
| 11 | Pipeline names are auto-prefixed with `[VD]` — don't add it yourself | GENERAL |
| 12 | Use `0-8` (internal email notification) as alternative to `0-3` (create task) | WORKFLOW |
| 13 | Wrap filters in OR → AND → filters hierarchy, even for single conditions | WORKFLOW |
| 14 | `isEnabled` MUST be `false` on all deployed workflows | WORKFLOW |
| 15 | 3-second delay between workflow creations to avoid rate limits | WORKFLOW |
| 16 | Every level needs `type` field: enrollment=`LIST_BASED`, branches=`OR`/`AND`, filters=`PROPERTY`, operations=match `operationType`, actions=`SINGLE_CONNECTION` | WORKFLOW |
| 17 | Actions need `actionTypeVersion: 0` and `connection: {edgeType: "STANDARD", nextActionId: "X"}` for chaining | WORKFLOW |
| 18 | Date "set to today" → use `OBJECT_PROPERTY` with `hs_lastmodifieddate`. Static dates → epoch ms string in `STATIC_VALUE` | WORKFLOW |

---

## Learnings Log

### 2026-03-18 — WORKFLOW — LIST_BRANCH uses `listBranches` not `filterListBranches`
**Trigger:** Deployed a workflow with if/then colour branching
**Failed because:** Used `filterListBranches` as the field name in LIST_BRANCH action
**Fix:** The correct field is `listBranches` — no "filter" prefix
**Pattern:** LIST_BRANCH action → always use `listBranches` array, never `filterListBranches`

---

### 2026-03-18 — WORKFLOW — Empty defaultBranch causes "required fields not set"
**Trigger:** Deployed workflow with LIST_BRANCH and `defaultBranch: {}`
**Failed because:** HubSpot requires `nextActionId` inside `defaultBranch` even for the "else" path
**Fix:** Always include: `"defaultBranch": { "edgeType": "STANDARD", "nextActionId": "X" }` or point to a valid action
**Pattern:** defaultBranch must include `nextActionId` — empty `{}` causes 500 error

---

### 2026-03-18 — WORKFLOW — ENUMERATION vs MULTISTRING value format
**Trigger:** Deployed workflow with property filter for an enumeration field
**Failed because:** Used `value: "Blue"` (singular) instead of `values: ["Blue"]` (array) for ENUMERATION operationType
**Fix:** ENUMERATION → `values: ["a", "b"]` (array). MULTISTRING → `value: "text"` (singular string)
**Pattern:** Check property type FIRST: enum = `values[]`, string = `value`

---

### 2026-03-18 — WORKFLOW — PLATFORM_FLOW rejects LIST_BRANCH on deals
**Trigger:** Created deal-based workflow using `PLATFORM_FLOW` with `objectTypeId: "0-3"` and LIST_BRANCH branching
**Failed because:** LIST_BRANCH actions fail silently or return 500 when used in PLATFORM_FLOW deal workflows
**Fix:** Use `CONTACT_FLOW` with `objectTypeId: "0-1"` and add `dataSources` array to fetch associated deal data:
```json
{
  "type": "CONTACT_FLOW",
  "objectTypeId": "0-1",
  "dataSources": [{"type": "ASSOCIATED_OBJECTS", "objectTypeId": "0-3"}]
}
```
**Pattern:** Deal workflows with branching → CONTACT_FLOW + dataSources, never PLATFORM_FLOW

---

### 2026-03-18 — WORKFLOW — Action type 0-3 (Create task) requires tasks scope
**Trigger:** Deployed workflow with Create task action (`0-3`) on the target portal
**Failed because:** Portal doesn't have `tasks` scope available via API
**Fix:** Use internal email notification (`0-8`) as alternative. Sends email to specified HubSpot users with subject and body.
```json
{
  "actionTypeId": "0-8",
  "fields": {
    "user_ids": ["{owner_id}"],
    "subject": "New Lead: {{ enrolled_object.firstname }} {{ enrolled_object.lastname }}",
    "body": "<ul><li>Email: {{ enrolled_object.email }}</li><li>Phone: {{ enrolled_object.phone }}</li></ul>"
  }
}
```
**Pattern:** On the target portal, replace Create task (0-3) with Internal email (0-8)

---

### 2026-03-18 — WORKFLOW — Action types 0-9 and 0-11 cause silent 500 errors
**Trigger:** Attempted to use in-app notification (`0-9`) and rotate-to-owner (`0-11`) in workflows
**Failed because:** Both return HTTP 500 with no useful error message. HubSpot v4 API doesn't support these reliably.
**Fix:**
- Instead of `0-9` (in-app notification) → use `0-8` (internal email notification)
- Instead of `0-11` (rotate to owner) → use `0-5` (Set Property) with `hubspot_owner_id`
**Pattern:** Avoid 0-9 and 0-11 entirely. Use 0-8 for notifications, 0-5 for owner assignment.

---

### 2026-03-18 — WORKFLOW — Owner assignment via Set Property
**Trigger:** Needed to assign contacts to specific owners based on colour preference
**Failed because:** Initially tried `0-11` rotate-to-owner which returned 500
**Fix:** Use Set Property (`0-5`) with `hubspot_owner_id`:
```json
{
  "actionTypeId": "0-5",
  "fields": {
    "property_name": "hubspot_owner_id",
    "value": { "staticValue": "{owner_id}", "type": "STATIC_VALUE" }
  }
}
```
Owner IDs: Fetch dynamically via `list_portals` → `portal_capabilities`
**Pattern:** Owner assignment → Set Property 0-5 on hubspot_owner_id with STATIC_VALUE

---

### 2026-03-18 — WORKFLOW — Internal email notification with contact tokens
**Trigger:** Needed to notify owners about new leads with contact details
**Failed because:** First attempt didn't include contact detail tokens in the email body
**Fix:** Use HubSpot token syntax `{{ enrolled_object.PROPERTY }}` in subject and body:
```json
{
  "actionTypeId": "0-8",
  "fields": {
    "user_ids": ["{owner_id}"],
    "subject": "New Lead: {{ enrolled_object.firstname }} {{ enrolled_object.lastname }}",
    "body": "<h3>New Lead Assigned</h3><ul><li><strong>Name:</strong> {{ enrolled_object.firstname }} {{ enrolled_object.lastname }}</li><li><strong>Email:</strong> {{ enrolled_object.email }}</li><li><strong>Phone:</strong> {{ enrolled_object.phone }}</li></ul><p>Please follow up within 24 hours.</p>"
  }
}
```
**Pattern:** Use `{{ enrolled_object.propertyname }}` tokens in 0-8 email subject/body for dynamic contact data

---

### 2026-03-18 — WORKFLOW — IS_KNOWN requires operationType ALL_PROPERTY
**Trigger:** Tried to use `IS_NOT_EMPTY` or `HAS_PROPERTY` operator in enrollment criteria
**Failed because:** These operators don't exist in v4 API enrollment criteria
**Fix:** Use `IS_KNOWN` with `operationType: "ALL_PROPERTY"`:
```json
{
  "property": "favourite_colour",
  "operation": {
    "operator": "IS_KNOWN",
    "operationType": "ALL_PROPERTY"
  },
  "filterType": "PROPERTY"
}
```
**Pattern:** "Property has any value" → IS_KNOWN + ALL_PROPERTY. "Property is empty" → IS_UNKNOWN + ALL_PROPERTY

---

### 2026-03-18 — WORKFLOW — Filter hierarchy must be OR → AND → filters
**Trigger:** Deployed workflow with flat filter structure (filters at root level)
**Failed because:** HubSpot v4 requires nested hierarchy even for single conditions
**Fix:** Always wrap in OR → AND → filters:
```json
{
  "filterBranchType": "OR",
  "filterBranches": [{
    "filterBranchType": "AND",
    "filters": [{ "property": "...", "operation": { ... } }]
  }]
}
```
**Pattern:** Even single conditions need OR wrapper → AND wrapper → filters array

---

### 2026-03-18 — WORKFLOW — Multiple LIST_BRANCH branches work in single action
**Trigger:** Previously chained single-branch LIST_BRANCH actions sequentially
**Failed because:** N/A — this was a cautious approach from early failures
**Fix:** Multiple `listBranches` entries in a single LIST_BRANCH action DO work. Tested successfully with 4 colour branches (Blue, Red, Purple, Green) in one action.
**Pattern:** Multi-branch LIST_BRANCH is supported — no need to chain single-branch actions

---

### 2026-03-18 — GENERAL — All workflow names must have [VD] prefix
**Trigger:** Created workflow without `[VD]` prefix in the name
**Failed because:** Violated Vero Digital naming convention for attribution tracking
**Fix:** Always prefix workflow names with `[VD]`: e.g., `[VD] Lead Router`, `[VD] Colour Assignment`
**Pattern:** Workflow names → always start with `[VD]`

---

### 2026-03-18 — WORKFLOW — nextAvailableActionId must be string type
**Trigger:** Set `nextAvailableActionId: 5` (integer) in workflow spec
**Failed because:** Engine validation rejects non-string values
**Fix:** Must be a string: `"nextAvailableActionId": "5"` — equal to highest actionId + 1
**Pattern:** nextAvailableActionId → always a string, always highest actionId + 1

---

### 2026-03-18 — GENERAL — No delete_workflow MCP tool available
**Trigger:** Attempted to delete test workflows programmatically
**Failed because:** No `delete_workflow` tool exists in the MCP toolset
**Fix:** Delete workflows manually through HubSpot UI: Automation → Workflows → select → delete
**Pattern:** Workflow deletion → manual only via HubSpot UI

---

### 2026-03-18 — WORKFLOW — ✅ Colour-based lead routing with notifications (CONFIRMED WORKING)
**What:** Full workflow: enrollment on `favourite_colour` IS_KNOWN → LIST_BRANCH with 4 branches (Blue/Red → {owner_a}, Purple/Green → {owner_b}) → Set owner via 0-5 → Internal email notification via 0-8 with contact tokens
**Pattern:** Complete lead routing pattern: IS_KNOWN enrollment → multi-branch LIST_BRANCH → Set Property owner → Internal email with {{ enrolled_object.X }} tokens

---

### 2026-03-19 — WORKFLOW — v4 API requires `type` field on filters, branches, actions, and enrollment
**Trigger:** Deploying deal-based workflow on a portal failed repeatedly with "required fields not set: [type]"
**Failed because:** The v4 API requires a `type` field at EVERY level of the workflow spec:
- `enrollmentCriteria.type` → must be `"LIST_BASED"`, `"EVENT_BASED"`, or `"MANUAL"`
- `listFilterBranch.type` → must match `filterBranchType` (e.g., `"OR"`)
- Each `filterBranch.type` → must match its `filterBranchType` (e.g., `"AND"`)
- Each `filter.type` → must be `"PROPERTY"` (AND keep `filterType: "PROPERTY"`)
- Each `operation.type` → must match `operationType` (e.g., `"ENUMERATION"`)
- Each `action.type` → must be `"SINGLE_CONNECTION"` for simple actions (0-5, 0-8), or `"LIST_BRANCH"`, `"STATIC_BRANCH"` etc for branching
**Fix:** Add `type` field at every level. Complete working pattern:
```json
{
  "enrollmentCriteria": {
    "type": "LIST_BASED",
    "listFilterBranch": {
      "type": "OR", "filterBranchType": "OR",
      "filterBranches": [{
        "type": "AND", "filterBranchType": "AND",
        "filters": [{
          "type": "PROPERTY", "filterType": "PROPERTY",
          "property": "prop_name",
          "operation": { "type": "ENUMERATION", "operator": "IS_ANY_OF", "operationType": "ENUMERATION", "values": ["true"] }
        }]
      }]
    }
  },
  "actions": [{ "type": "SINGLE_CONNECTION", "actionTypeId": "0-5", ... }]
}
```
**Pattern:** v4 API needs `type` at EVERY level — enrollment, branches, filters, operations, AND actions. Always include both `type` and the legacy field (`filterBranchType`, `filterType`, `operationType`).

---

### 2026-03-19 — WORKFLOW — Actions need `actionTypeVersion: 0` and `connection` object
**Trigger:** Deploying workflow with chained actions on Hub 2 failed with "Invalid request to flow creation"
**Failed because:** Actions used `nextActionId` at the top level instead of the `connection` object
**Fix:** Each action needs:
- `"actionTypeVersion": 0` — required field
- `"connection": { "edgeType": "STANDARD", "nextActionId": "X" }` — instead of top-level `nextActionId`
```json
{
  "type": "SINGLE_CONNECTION",
  "actionTypeId": "0-5",
  "actionId": "1",
  "actionTypeVersion": 0,
  "connection": { "edgeType": "STANDARD", "nextActionId": "2" },
  "fields": { ... }
}
```
**Pattern:** Always use `connection` object for chaining + `actionTypeVersion: 0` on every action

---

### 2026-03-19 — WORKFLOW — Date properties: use OBJECT_PROPERTY value type
**Trigger:** Tried to set `tcs_approved_date` to current date in a deal workflow
**Failed because:** `STATIC_VALUE` with `{{now}}`, ISO dates, and non-epoch strings all rejected. Only epoch ms as string works for static dates.
**Fix:** Two approaches work:
1. **Static date (epoch ms):** `{"type": "STATIC_VALUE", "staticValue": "1773890346945"}` — hardcoded, won't update
2. **Dynamic date (copy from property):** `{"type": "OBJECT_PROPERTY", "propertyName": "hs_lastmodifieddate"}` — copies the enrolled object's last modified date, which equals "now" at enrollment time
```json
{
  "type": "SINGLE_CONNECTION",
  "actionTypeId": "0-5",
  "actionId": "2",
  "actionTypeVersion": 0,
  "fields": {
    "property_name": "tcs_approved_date",
    "value": { "type": "OBJECT_PROPERTY", "propertyName": "hs_lastmodifieddate" }
  }
}
```
**Pattern:** For "set date to today" → use OBJECT_PROPERTY with hs_lastmodifieddate. For specific dates → use STATIC_VALUE with epoch ms string.

---

### 2026-03-19 — WORKFLOW — ✅ Deal workflow with boolean + date set property (CONFIRMED WORKING)
**What:** Deal PLATFORM_FLOW workflow triggered on `quote_signed = true`. Action 1: Set `t_c_s_approved = true` (STATIC_VALUE). Action 2: Set `tcs_approved_date` to `hs_lastmodifieddate` (OBJECT_PROPERTY). Both chained via `connection` objects with `actionTypeVersion: 0`.
**Pattern:** Complete deal property update pattern: LIST_BASED enrollment + SINGLE_CONNECTION actions + connection chaining + OBJECT_PROPERTY for dynamic dates
