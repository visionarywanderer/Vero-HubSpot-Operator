# 08 — List & Segment Manager

## Purpose
Create, read, and manage HubSpot lists (smart and static). Build segments from natural language descriptions.

## Priority: P1 | Dependencies: 02-api-client, 04-orchestrator, 05-change-logger

---

## API

**Base**: `/crm/v3/lists/`
**Scopes**: `crm.lists.read`, `crm.lists.write`

| Method | Endpoint | Action |
|--------|----------|--------|
| GET | `/crm/v3/lists/` | List all lists |
| POST | `/crm/v3/lists/` | Create list |
| GET | `/crm/v3/lists/{listId}` | Get list details |
| PUT | `/crm/v3/lists/{listId}` | Update list |
| DELETE | `/crm/v3/lists/{listId}` | Delete list |
| PUT | `/crm/v3/lists/{listId}/memberships/add` | Add records to static list |
| PUT | `/crm/v3/lists/{listId}/memberships/remove` | Remove from static list |

---

## Smart List Creation

Smart lists auto-update based on filter criteria.

**Prompt**: "Create a smart list of MQLs with lead score > 80 and activity in last 7 days"

**Payload**:
```json
{
  "name": "Hot MQLs - Score > 80",
  "objectTypeId": "0-1",
  "processingType": "DYNAMIC",
  "filterBranch": {
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
        "property": "hubspot_score",
        "operation": {
          "operator": "GT",
          "value": "80",
          "operationType": "NUMBER"
        }
      },
      {
        "filterType": "PROPERTY",
        "property": "hs_last_sales_activity_timestamp",
        "operation": {
          "operator": "IS_AFTER",
          "value": "SEVEN_DAYS_AGO",
          "operationType": "TIME_RANGED"
        }
      }
    ],
    "filterBranches": []
  }
}
```

## Static List Creation

Static lists have manually managed membership.

**Payload**:
```json
{
  "name": "Q1 Webinar Attendees",
  "objectTypeId": "0-1",
  "processingType": "MANUAL"
}
```

Then add members:
```json
PUT /crm/v3/lists/{listId}/memberships/add
{
  "recordIdsToAdd": [101, 102, 103]
}
```

## Filter Operators Reference

| Operator | Use With | Meaning |
|----------|----------|---------|
| `IS_ANY_OF` | enumeration | Equals one of the values |
| `IS_NONE_OF` | enumeration | Not any of the values |
| `EQ` | number, string | Equals |
| `NEQ` | number, string | Not equals |
| `GT` | number | Greater than |
| `GTE` | number | Greater or equal |
| `LT` | number | Less than |
| `LTE` | number | Less or equal |
| `CONTAINS` | string | Contains substring |
| `IS_AFTER` | date | After a date/relative |
| `IS_BEFORE` | date | Before a date/relative |
| `HAS_PROPERTY` | any | Property has any value |
| `NOT_HAS_PROPERTY` | any | Property is empty |

## Exports

```typescript
interface ListManager {
  list(): Promise<ListSummary[]>;
  create(spec: ListSpec): Promise<HubSpotList>;
  get(listId: string): Promise<HubSpotList>;
  delete(listId: string): Promise<void>;
  addMembers(listId: string, recordIds: string[]): Promise<void>;
  removeMembers(listId: string, recordIds: string[]): Promise<void>;
  audit(): Promise<ListAudit[]>; // find empty/unused lists
}
```
