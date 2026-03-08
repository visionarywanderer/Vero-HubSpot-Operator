# 06 — Workflow Engine (Generator & Deployer)

## Purpose
Generate HubSpot workflow specifications from natural language prompts, deploy them via the Automation v4 API, and manage existing workflows. This is the most complex module.

## Priority: P1 | Dependencies: 02-api-client, 04-orchestrator, 05-change-logger

---

## API Reference

**Base**: `https://api.hubapi.com/automation/v4/flows`
**Scope required**: `automation`
**Status**: Beta (subject to change)

| Method | Endpoint | Action |
|--------|----------|--------|
| POST | `/automation/v4/flows` | Create workflow |
| GET | `/automation/v4/flows` | List all (metadata only) |
| GET | `/automation/v4/flows/{flowId}` | Get full workflow spec |
| PUT | `/automation/v4/flows/{flowId}` | Update workflow (full replace) |
| DELETE | `/automation/v4/flows/{flowId}` | Delete workflow (irreversible) |
| POST | `/automation/v4/flows/batch/read` | Batch fetch by IDs |

---

## Workflow Types

| User Says | type Field | objectTypeId |
|-----------|------------|--------------|
| "contact workflow" | `CONTACT_FLOW` | `0-1` |
| "deal workflow" | `PLATFORM_FLOW` | `0-3` |
| "company workflow" | `PLATFORM_FLOW` | `0-2` |
| "ticket workflow" | `PLATFORM_FLOW` | `0-5` |

**Rule**: Only contact-based workflows use `CONTACT_FLOW`. Everything else uses `PLATFORM_FLOW`.

---

## Action Type Reference

The LLM must know these `actionTypeId` values to generate valid workflows.

| actionTypeId | Action | Key Fields |
|-------------|--------|------------|
| `0-1` | **Delay** | `delta` (minutes), `time_unit` ("MINUTES") |
| `0-4` | **Send marketing email** | `content_id` (email ID from HubSpot) |
| `0-5` | **Set property value** | `property`, `newValue` |
| `0-7` | **Create task** | `subject`, `body`, `hs_timestamp`, `hs_task_priority` |
| `0-9` | **Send internal notification** | `user_ids`, `subject`, `body`, `delivery_method` ("APP" or "EMAIL") |
| `0-13` | **Add to static list** | `list_id`, `operation` ("ADD") |
| `0-14` | **Create CRM record** | `object_type_id`, `properties[]`, `associations[]` |
| `0-35` | **Branch (if/then)** | Uses `BRANCH` type with `filterBranches` |
| `0-45` | **Webhook / HTTP request** | `method`, `url`, `headers`, `body` |

### Action Chaining

Actions are linked via `connection.nextActionId`:

```json
{
  "type": "SINGLE_CONNECTION",
  "actionId": "1",
  "actionTypeId": "0-5",
  "connection": {
    "edgeType": "STANDARD",
    "nextActionId": "2"
  },
  "fields": { ... }
}
```

The last action in the chain has NO `connection` property.

`startActionId` must point to the first action. `nextAvailableActionId` must be one higher than the highest `actionId`.

---

## Enrollment Criteria

### Event-Based (form submission, page view, etc.)

```json
"enrollmentCriteria": {
  "shouldReEnroll": false,
  "type": "EVENT_BASED",
  "eventFilterBranches": [
    {
      "filterBranches": [],
      "filters": [
        {
          "property": "hs_form_id",
          "operation": {
            "operator": "IS_ANY_OF",
            "includeObjectsWithNoValueSet": false,
            "values": ["form-uuid-here"],
            "operationType": "ENUMERATION"
          },
          "filterType": "PROPERTY"
        }
      ],
      "eventTypeId": "4-1639801",
      "operator": "HAS_COMPLETED",
      "filterBranchType": "UNIFIED_EVENTS",
      "filterBranchOperator": "AND"
    }
  ],
  "listMembershipFilterBranches": []
}
```

### Property-Based (lifecycle stage changes, deal stage changes)

```json
"enrollmentCriteria": {
  "shouldReEnroll": true,
  "type": "PROPERTY_BASED",
  "filterBranches": [
    {
      "filterBranches": [],
      "filters": [
        {
          "property": "lifecyclestage",
          "operation": {
            "operator": "IS_ANY_OF",
            "values": ["marketingqualifiedlead"],
            "operationType": "ENUMERATION"
          },
          "filterType": "PROPERTY"
        }
      ],
      "filterBranchType": "AND",
      "filterBranchOperator": "AND"
    }
  ]
}
```

### Manual Enrollment

```json
"enrollmentCriteria": {
  "shouldReEnroll": true,
  "type": "MANUAL"
}
```

---

## Generation Pipeline

### Step 1: User Input Format

The orchestrator normalizes user input into this structure:

```
Workflow: {name}
Object: contact | deal | company | ticket
Trigger: {description}
Actions:
  1. {action description}
  2. {action description}
  ...
Branching (if any):
  If {condition} then {action} else {action}
```

### Step 2: LLM System Prompt for Workflow Generation

```
You are a HubSpot workflow generator. Given a workflow description, output ONLY a valid JSON body for POST /automation/v4/flows.

RULES:
1. Set isEnabled: false (always deploy disabled)
2. Use CONTACT_FLOW for contacts, PLATFORM_FLOW for everything else
3. Chain actions with connection.nextActionId
4. Use sequential actionIds starting from "1"
5. Set nextAvailableActionId to (highest actionId + 1) as string
6. Include flowType: "WORKFLOW"
7. Include crmObjectCreationStatus: "COMPLETE"
8. Include empty arrays for: timeWindows, blockedDates, suppressionListIds
9. Set canEnrollFromSalesforce: false

ACTION TYPE IDS:
- Delay: actionTypeId "0-1", fields: { delta: "minutes", time_unit: "MINUTES" }
- Send email: actionTypeId "0-4", fields: { content_id: "email_id" }
- Set property: actionTypeId "0-5", fields: { property: "prop_name", newValue: "value" }
- Create task: actionTypeId "0-7", fields: { subject: "...", body: "..." }
- Send notification: actionTypeId "0-9", fields: { user_ids: [...], subject: "...", body: "...", delivery_method: "APP" }
- Add to list: actionTypeId "0-13", fields: { list_id: "...", operation: "ADD" }
- Create record: actionTypeId "0-14", fields: { object_type_id: "0-5", properties: [...] }

ENROLLMENT TYPES:
- Form submission: EVENT_BASED with eventTypeId "4-1639801"
- Property change: PROPERTY_BASED with filter on the property
- Manual: type "MANUAL"

Output ONLY the JSON. No markdown, no explanation. Valid JSON only.
```

### Step 3: Validation

Before deploying, validate the generated JSON:

```typescript
function validateWorkflowSpec(spec: object): ValidationResult {
  const errors: string[] = [];
  
  // Required fields
  if (!spec.name) errors.push("Missing: name");
  if (!spec.type) errors.push("Missing: type (CONTACT_FLOW or PLATFORM_FLOW)");
  if (!spec.objectTypeId) errors.push("Missing: objectTypeId");
  if (!spec.startActionId) errors.push("Missing: startActionId");
  if (!spec.actions || !spec.actions.length) errors.push("Missing: actions array");
  if (!spec.enrollmentCriteria) errors.push("Missing: enrollmentCriteria");
  
  // Safety checks
  if (spec.isEnabled !== false) errors.push("SAFETY: isEnabled must be false");
  
  // Action chain validation
  const actionIds = new Set(spec.actions.map(a => a.actionId));
  if (!actionIds.has(spec.startActionId)) {
    errors.push(`startActionId "${spec.startActionId}" not found in actions`);
  }
  
  for (const action of spec.actions) {
    if (action.connection?.nextActionId) {
      if (!actionIds.has(action.connection.nextActionId)) {
        errors.push(`Action ${action.actionId} points to non-existent ${action.connection.nextActionId}`);
      }
    }
    if (!action.actionTypeId) {
      errors.push(`Action ${action.actionId} missing actionTypeId`);
    }
  }
  
  return { valid: errors.length === 0, errors };
}
```

### Step 4: Human Review

Display the spec in a readable format:

```
━━━ WORKFLOW SPEC ━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Name: New Lead Follow-Up
Type: CONTACT_FLOW (contacts)
Status: DISABLED (will be enabled after review)

TRIGGER: Contact submits form "demo-request"

ACTIONS:
  1. Create ticket → "Review demo request"
  2. Delay → 1 day (1440 minutes)
  3. Send email → content_id: 113782603056

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Deploy this workflow? (yes/no)
```

### Step 5: Deploy

```typescript
async function deployWorkflow(spec: object): Promise<DeployResult> {
  // Validate
  const validation = validateWorkflowSpec(spec);
  if (!validation.valid) {
    return { success: false, errors: validation.errors };
  }
  
  // Deploy
  const response = await apiClient.post('/automation/v4/flows', spec);
  
  // Log
  await changeLogger.log({
    layer: 'api',
    module: 'B2',
    action: 'workflow_deploy',
    objectType: 'workflow',
    recordId: response.id,
    description: `Deployed workflow "${spec.name}" (disabled)`,
    after: spec,
    status: 'success'
  });
  
  // Verify
  const deployed = await apiClient.get(`/automation/v4/flows/${response.id}`);
  
  return {
    success: true,
    flowId: response.id,
    revisionId: deployed.revisionId,
    name: deployed.name,
    isEnabled: deployed.isEnabled
  };
}
```

---

## Example: Complete Workflow Generation

**User prompt**:
```
Create a workflow: when a contact's lifecycle stage becomes MQL,
create a task for the contact owner "Follow up with new MQL" due in 1 day,
then wait 3 days, then send notification to sales manager if no meeting booked.
```

**Generated v4 JSON**:
```json
{
  "isEnabled": false,
  "flowType": "WORKFLOW",
  "name": "MQL Follow-Up Automation",
  "startActionId": "1",
  "nextAvailableActionId": "4",
  "actions": [
    {
      "type": "SINGLE_CONNECTION",
      "actionId": "1",
      "actionTypeVersion": 0,
      "actionTypeId": "0-7",
      "connection": { "edgeType": "STANDARD", "nextActionId": "2" },
      "fields": {
        "subject": "Follow up with new MQL",
        "body": "This contact just became an MQL. Please follow up within 24 hours.",
        "hs_task_priority": "HIGH"
      }
    },
    {
      "type": "SINGLE_CONNECTION",
      "actionId": "2",
      "actionTypeVersion": 0,
      "actionTypeId": "0-1",
      "connection": { "edgeType": "STANDARD", "nextActionId": "3" },
      "fields": {
        "delta": "4320",
        "time_unit": "MINUTES"
      }
    },
    {
      "type": "SINGLE_CONNECTION",
      "actionId": "3",
      "actionTypeVersion": 0,
      "actionTypeId": "0-9",
      "fields": {
        "user_ids": ["SALES_MANAGER_USER_ID"],
        "subject": "MQL has not booked meeting",
        "body": "Contact has been MQL for 3 days with no meeting scheduled.",
        "delivery_method": "APP"
      }
    }
  ],
  "enrollmentCriteria": {
    "shouldReEnroll": false,
    "type": "PROPERTY_BASED",
    "filterBranches": [
      {
        "filterBranches": [],
        "filters": [
          {
            "property": "lifecyclestage",
            "operation": {
              "operator": "IS_ANY_OF",
              "values": ["marketingqualifiedlead"],
              "operationType": "ENUMERATION"
            },
            "filterType": "PROPERTY"
          }
        ],
        "filterBranchType": "AND",
        "filterBranchOperator": "AND"
      }
    ]
  },
  "timeWindows": [],
  "blockedDates": [],
  "customProperties": {},
  "crmObjectCreationStatus": "COMPLETE",
  "type": "CONTACT_FLOW",
  "objectTypeId": "0-1",
  "suppressionListIds": [],
  "canEnrollFromSalesforce": false
}
```

---

## Exports

```typescript
interface WorkflowEngine {
  generate(prompt: string): Promise<WorkflowSpec>;
  validate(spec: WorkflowSpec): ValidationResult;
  preview(spec: WorkflowSpec): string; // human-readable preview
  deploy(spec: WorkflowSpec): Promise<DeployResult>;
  list(): Promise<WorkflowSummary[]>;
  get(flowId: string): Promise<WorkflowSpec>;
  update(flowId: string, spec: WorkflowSpec): Promise<DeployResult>;
  delete(flowId: string): Promise<void>; // requires confirmation
}
```
