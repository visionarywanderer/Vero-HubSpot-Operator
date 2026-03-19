# HubSpot Workflows API (Skill Companion)

The Workflows API (v4, beta) lets you create, read, update, and delete automated workflows programmatically. There is also a legacy v3 API. **Prefer v4 for all new work**—it supports richer action types, labeled associations, and AI actions. Requires Professional tier or higher.

## Required Scopes

- `automation` (base scope for all workflow operations)
- Additional sensitive-data scopes if workflows touch restricted properties

## v4 Endpoints

| Method | Path | Summary |
|--------|------|---------|
| POST | `/automation/v4/flows` | Create a workflow |
| GET | `/automation/v4/flows` | List workflows (paginated, max 100) |
| GET | `/automation/v4/flows/{flowId}` | Get a specific workflow |
| POST | `/automation/v4/flows/batch/read` | Batch read workflows |
| PUT | `/automation/v4/flows/{flowId}` | Update a workflow |
| DELETE | `/automation/v4/flows/{flowId}` | Delete a workflow (permanent!) |

## v3 Legacy Endpoint

| Method | Path | Summary |
|--------|------|---------|
| POST | `/automation/v3/workflows` | Create workflow (legacy) |

### v3 vs v4 Differences

| Aspect | v3 | v4 |
|--------|----|----|
| Status | Legacy | Beta (current) |
| Flow types | `DRIP_DELAY`, `STATIC_ANCHOR` | `CONTACT_FLOW`, `PLATFORM_FLOW` |
| Action model | Flat actions array | Linked actions with `connection` objects |
| Enrollment | `segmentCriteria` | `enrollmentCriteria` (event-based, list-based, manual) |
| AI actions | Not available | Supported (custom prompts, research, smart properties) |
| Association actions | Not available | Full association management |

## Workflow Types (v4)

- **`CONTACT_FLOW`** — Contact-based workflows
- **`PLATFORM_FLOW`** — Deal, company, ticket, custom object, and goal-based workflows

## Request Example — Create Workflow

```json
{
  "name": "Welcome new leads",
  "type": "CONTACT_FLOW",
  "objectTypeId": "0-1",
  "flowType": "WORKFLOW",
  "isEnabled": false,
  "actions": [
    {
      "actionId": "1",
      "actionTypeId": "0-1",
      "actionTypeVersion": 0,
      "type": "SINGLE_CONNECTION",
      "connection": { "edgeType": "STANDARD", "nextActionId": "2" },
      "fields": { "delta": 5, "time_unit": "MINUTES" }
    },
    {
      "actionId": "2",
      "actionTypeId": "0-4",
      "actionTypeVersion": 0,
      "type": "SINGLE_CONNECTION",
      "fields": { "content_id": 12345678 }
    }
  ],
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
        "eventTypeId": "4-655002",
        "operator": "HAS_COMPLETED",
        "filterBranchType": "UNIFIED_EVENTS",
        "filterBranchOperator": "AND"
      }
    ]
  }
}
```

## Common Action Type IDs

| Action | ID | Notes |
|--------|----|-------|
| Delay (set time) | `0-1` | Fields: `delta`, `time_unit` |
| Create task | `0-3` | |
| Send email | `0-4` | Field: `content_id` |
| Edit record properties | `0-5` | |
| Send internal email | `0-8` | |
| Send in-app notification | `0-9` | Fields: `user_ids`, `subject`, `body` |
| Rotate to owner | `0-11` | |
| Create record | `0-14` | Fields: `object_type_id`, `properties` |
| Go to workflow | `0-15` | |
| Delete contact | `0-18224765` | |
| Add to static list | `0-63809083` | |
| Remove from static list | `0-63863438` | |
| Create association | `0-63189541` | |
| Enroll in sequence | `0-46510720` | |
| Send Slack notification | `1-179507819` | Third-party |

## Common Event Trigger IDs

| Event | ID |
|-------|----|
| Form submission | `4-1639801` |
| Page visited | `4-96000` |
| Email opened | `4-666440` |
| Email clicked | `4-666288` |
| Property value changed | `4-655002` |
| CRM object created | `4-1463224` |
| Meeting booked | `4-1720599` |
| Workflow goal achieved | `4-1753168` |

## Enrollment Criteria Types

1. **`EVENT_BASED`** — Trigger on events (form submit, property change, etc.)
2. **`LIST_BASED`** — Enroll records matching filter criteria
3. **`MANUAL`** — Manual enrollment only

## Update Workflow (PUT) — Critical Rules

1. **Include `revisionId`** matching the current revision (from GET response).
2. **Include ALL actions** you want to keep—omitted actions are deleted.
3. **Remove** `createdAt`, `updatedAt`, and `dataSources` fields before sending.
4. Must include `type` field.

## Best Practices

- Start workflows as `isEnabled: false`, verify configuration, then enable via PUT.
- Always GET the current workflow before updating—you need the `revisionId`.
- Use `PLATFORM_FLOW` for non-contact objects (deals, tickets, custom objects).
- Use branching actions (`STATIC_BRANCH`, `LIST_BRANCH`) for conditional logic.
- Set `shouldReEnroll: true` only when you explicitly want contacts to re-enter.

## Anti-patterns

- Updating a workflow without the current `revisionId`—causes validation errors.
- Including `createdAt`/`updatedAt`/`dataSources` in PUT requests—causes validation errors.
- Using v3 endpoints for new integrations—v3 is legacy and lacks modern action types.
- Deleting workflows expecting they can be restored via API—they cannot. Contact support.
- Sending partial action lists in PUT—missing actions are permanently removed.

## Key Notes

- **v4 is beta**—subject to breaking changes. Accept HubSpot Developer Beta Terms.
- **Professional tier or higher** required across all hubs.
- **Deletion is permanent** via API. No undo without HubSpot support.
- **`revisionId` is mandatory** for updates—acts as an optimistic concurrency lock.
- **Workflow ID** can be found in the editor URL or via `GET /automation/v4/flows`.
- **Pagination:** `GET /automation/v4/flows` supports `limit` (max 100) and `after` cursor. No filtering—retrieve all and filter client-side.
