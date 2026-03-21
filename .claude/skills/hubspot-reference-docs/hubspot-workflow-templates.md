# HubSpot Workflow Templates — Ready-to-Deploy JSON

Copy-paste patterns for common workflow scenarios. All deploy as disabled drafts.

---

## 1. Simple: Set Property on Lifecycle Change

```json
{
  "name": "Set property when lifecycle = lead",
  "type": "CONTACT_FLOW",
  "objectTypeId": "0-1",
  "isEnabled": false,
  "startActionId": "1",
  "nextAvailableActionId": "2",
  "enrollmentCriteria": {
    "shouldReEnroll": false,
    "type": "LIST_BASED",
    "listFilterBranch": {
      "filterBranchType": "OR",
      "filterBranches": [{
        "filterBranchType": "AND", "filterBranchOperator": "AND",
        "filterBranches": [],
        "filters": [{
          "filterType": "PROPERTY", "property": "lifecyclestage",
          "operation": { "operationType": "ENUMERATION", "operator": "IS_ANY_OF", "values": ["lead"] }
        }]
      }],
      "filters": []
    }
  },
  "actions": [{
    "actionId": "1", "type": "SINGLE_CONNECTION",
    "actionTypeVersion": 0, "actionTypeId": "0-5",
    "fields": {
      "property_name": "PROPERTY_NAME_HERE",
      "value": { "staticValue": "VALUE_HERE", "type": "STATIC_VALUE" }
    }
  }]
}
```

---

## 2. Multi-Condition Trigger

Three AND conditions: lifecycle = lead + has email + has company.

```json
{
  "name": "Multi-condition enrollment",
  "type": "CONTACT_FLOW",
  "objectTypeId": "0-1",
  "isEnabled": false,
  "startActionId": "1",
  "nextAvailableActionId": "2",
  "enrollmentCriteria": {
    "shouldReEnroll": false,
    "type": "LIST_BASED",
    "listFilterBranch": {
      "filterBranchType": "OR",
      "filterBranches": [{
        "filterBranchType": "AND", "filterBranchOperator": "AND",
        "filterBranches": [],
        "filters": [
          { "filterType": "PROPERTY", "property": "lifecyclestage",
            "operation": { "operationType": "ENUMERATION", "operator": "IS_ANY_OF", "values": ["lead"] } },
          { "filterType": "PROPERTY", "property": "email",
            "operation": { "operationType": "STRING", "operator": "CONTAINS", "value": "@" } },
          { "filterType": "PROPERTY", "property": "hubspot_owner_id",
            "operation": { "operationType": "ALL_PROPERTY", "operator": "IS_KNOWN" } }
        ]
      }],
      "filters": []
    }
  },
  "actions": [{
    "actionId": "1", "type": "SINGLE_CONNECTION",
    "actionTypeVersion": 0, "actionTypeId": "0-5",
    "fields": {
      "property_name": "PROPERTY_NAME_HERE",
      "value": { "staticValue": "Qualified", "type": "STATIC_VALUE" }
    }
  }]
}
```

---

## 3. Event-Based Trigger (Property Changed)

Triggers when a contact property value changes.

```json
{
  "name": "On owner change",
  "type": "CONTACT_FLOW",
  "objectTypeId": "0-1",
  "isEnabled": false,
  "startActionId": "1",
  "nextAvailableActionId": "2",
  "enrollmentCriteria": {
    "shouldReEnroll": true,
    "type": "EVENT_BASED",
    "eventFilterBranches": [{
      "filters": [{
        "property": "hubspot_owner_id",
        "operation": { "operationType": "ALL_PROPERTY", "operator": "IS_KNOWN" },
        "filterType": "PROPERTY"
      }],
      "filterBranches": [],
      "eventTypeId": "4-655002",
      "operator": "HAS_COMPLETED",
      "filterBranchType": "UNIFIED_EVENTS",
      "filterBranchOperator": "AND"
    }]
  },
  "actions": [{
    "actionId": "1", "type": "SINGLE_CONNECTION",
    "actionTypeVersion": 0, "actionTypeId": "0-8",
    "fields": {
      "user_ids": [],
      "subject": "Owner changed: {{ enrolled_object.firstname }} {{ enrolled_object.lastname }}",
      "body": "<p>New owner assigned.</p>"
    }
  }]
}
```

---

## 4. Delay + Action Chain

5-minute delay → set property → send notification.

```json
{
  "name": "Delayed notification",
  "type": "CONTACT_FLOW",
  "objectTypeId": "0-1",
  "isEnabled": false,
  "startActionId": "1",
  "nextAvailableActionId": "4",
  "enrollmentCriteria": { "shouldReEnroll": false, "type": "MANUAL" },
  "actions": [
    {
      "actionId": "1", "type": "SINGLE_CONNECTION",
      "actionTypeVersion": 0, "actionTypeId": "0-1",
      "connection": { "edgeType": "STANDARD", "nextActionId": "2" },
      "fields": { "delta": "5", "time_unit": "MINUTES" }
    },
    {
      "actionId": "2", "type": "SINGLE_CONNECTION",
      "actionTypeVersion": 0, "actionTypeId": "0-5",
      "connection": { "edgeType": "STANDARD", "nextActionId": "3" },
      "fields": {
        "property_name": "PROPERTY_NAME_HERE",
        "value": { "staticValue": "Processed", "type": "STATIC_VALUE" }
      }
    },
    {
      "actionId": "3", "type": "SINGLE_CONNECTION",
      "actionTypeVersion": 0, "actionTypeId": "0-8",
      "fields": {
        "user_ids": [],
        "subject": "Processed: {{ enrolled_object.firstname }}",
        "body": "<p>Contact has been processed.</p>"
      }
    }
  ]
}
```

---

## 5. If/Then Branch (LIST_BRANCH)

Branch on whether contact has email domain.

```json
{
  "name": "If/then on email domain",
  "type": "CONTACT_FLOW",
  "objectTypeId": "0-1",
  "isEnabled": false,
  "startActionId": "1",
  "nextAvailableActionId": "4",
  "enrollmentCriteria": { "shouldReEnroll": false, "type": "MANUAL" },
  "actions": [
    {
      "actionId": "1", "type": "LIST_BRANCH",
      "listBranches": [{
        "branchName": "Has email",
        "filterBranch": {
          "filterBranchType": "OR", "filterBranchOperator": "OR",
          "filterBranches": [{
            "filterBranchType": "AND", "filterBranchOperator": "AND",
            "filterBranches": [],
            "filters": [{
              "filterType": "PROPERTY", "property": "email",
              "operation": { "operationType": "ALL_PROPERTY", "operator": "IS_KNOWN" }
            }]
          }],
          "filters": []
        },
        "connection": { "edgeType": "STANDARD", "nextActionId": "2" }
      }],
      "defaultBranchName": "No email",
      "defaultBranch": { "edgeType": "STANDARD", "nextActionId": "3" }
    },
    {
      "actionId": "2", "type": "SINGLE_CONNECTION",
      "actionTypeVersion": 0, "actionTypeId": "0-5",
      "fields": {
        "property_name": "favourite_colour",
        "value": { "staticValue": "Green", "type": "STATIC_VALUE" }
      }
    },
    {
      "actionId": "3", "type": "SINGLE_CONNECTION",
      "actionTypeVersion": 0, "actionTypeId": "0-5",
      "fields": {
        "property_name": "favourite_colour",
        "value": { "staticValue": "Red", "type": "STATIC_VALUE" }
      }
    }
  ]
}
```

---

## 6. Static Branch on Action Output

Branch on success/failure of a prior action.

```json
{
  "actionId": "3", "type": "STATIC_BRANCH",
  "inputValue": { "type": "FIELD_DATA", "actionId": "2", "dataKey": "hs_execution_state" },
  "staticBranches": [
    { "branchValue": "SUCCESS", "connection": { "edgeType": "STANDARD", "nextActionId": "4" } }
  ],
  "defaultBranchName": "Failed",
  "defaultBranch": { "edgeType": "STANDARD", "nextActionId": "5" }
}
```

---

## 7. Create Deal from Contact with Associations

```json
{
  "actionId": "1", "type": "SINGLE_CONNECTION",
  "actionTypeVersion": 0, "actionTypeId": "0-14",
  "fields": {
    "object_type_id": "0-3",
    "properties": [
      { "targetProperty": "dealname", "value": { "staticValue": "Deal for {{ enrolled_object.firstname }}", "type": "STATIC_VALUE" } },
      { "targetProperty": "dealstage", "value": { "staticValue": "appointmentscheduled", "type": "STATIC_VALUE" } },
      { "targetProperty": "hubspot_owner_id", "value": { "propertyName": "hubspot_owner_id", "type": "OBJECT_PROPERTY" } },
      { "targetProperty": "amount", "value": { "propertyName": "deal_amount", "type": "OBJECT_PROPERTY" } }
    ],
    "associations": [{
      "target": { "associationCategory": "HUBSPOT_DEFINED", "associationTypeId": 3 },
      "value": { "type": "ENROLLED_OBJECT" }
    }],
    "use_explicit_associations": "true"
  }
}
```

---

## 8. Owner Match: Associate Contact to Company

Uses dataSources to fetch associated company, create association action as placeholder.

```json
{
  "name": "Auto-associate on owner match",
  "type": "CONTACT_FLOW",
  "objectTypeId": "0-1",
  "isEnabled": false,
  "startActionId": "1",
  "nextAvailableActionId": "3",
  "dataSources": [{
    "name": "fetched_company",
    "objectTypeId": "0-2",
    "associationTypeId": 279,
    "associationCategory": "HUBSPOT_DEFINED",
    "sortBy": { "property": "hs_lastmodifieddate", "order": "DESC" },
    "type": "ASSOCIATION"
  }],
  "enrollmentCriteria": {
    "shouldReEnroll": false,
    "type": "LIST_BASED",
    "listFilterBranch": {
      "filterBranchType": "OR",
      "filterBranches": [{
        "filterBranchType": "AND", "filterBranchOperator": "AND",
        "filterBranches": [],
        "filters": [
          { "filterType": "PROPERTY", "property": "hubspot_owner_id",
            "operation": { "operationType": "ALL_PROPERTY", "operator": "IS_KNOWN" } }
        ]
      }],
      "filters": []
    }
  },
  "actions": [
    {
      "actionId": "1", "type": "SINGLE_CONNECTION",
      "actionTypeVersion": 0, "actionTypeId": "0-63189541",
      "connection": { "edgeType": "STANDARD", "nextActionId": "2" },
      "fields": {}
    },
    {
      "actionId": "2", "type": "SINGLE_CONNECTION",
      "actionTypeVersion": 0, "actionTypeId": "0-8",
      "fields": {
        "user_ids": [],
        "subject": "Associated: {{ enrolled_object.firstname }} with {{ fetched_objects.fetched_company.name }}",
        "body": "<p>Contact associated with company.</p>"
      }
    }
  ]
}
```

---

## 9. Full Placeholder Workflow (all actions configurable in UI)

```json
{
  "name": "Placeholder - configure in HubSpot",
  "type": "CONTACT_FLOW",
  "objectTypeId": "0-1",
  "isEnabled": false,
  "startActionId": "1",
  "nextAvailableActionId": "5",
  "enrollmentCriteria": { "shouldReEnroll": false, "type": "MANUAL" },
  "actions": [
    { "actionId": "1", "type": "SINGLE_CONNECTION", "actionTypeVersion": 0, "actionTypeId": "0-1",
      "connection": { "edgeType": "STANDARD", "nextActionId": "2" },
      "fields": { "delta": "5", "time_unit": "MINUTES" } },
    { "actionId": "2", "type": "SINGLE_CONNECTION", "actionTypeVersion": 0, "actionTypeId": "0-4",
      "connection": { "edgeType": "STANDARD", "nextActionId": "3" },
      "fields": {} },
    { "actionId": "3", "type": "SINGLE_CONNECTION", "actionTypeVersion": 0, "actionTypeId": "0-63189541",
      "connection": { "edgeType": "STANDARD", "nextActionId": "4" },
      "fields": {} },
    { "actionId": "4", "type": "SINGLE_CONNECTION", "actionTypeVersion": 0, "actionTypeId": "0-8",
      "fields": { "user_ids": [], "subject": "Workflow complete", "body": "<p>Done</p>" } }
  ]
}
```
Actions 2 (send email) and 3 (create association) are placeholders — configure in HubSpot UI.

---

## 10. Priority-Based Follow-Up Intensity (LIST_BRANCH with 3 paths)

Branches on deal priority to create tasks with different urgency and delays.

```json
{
  "name": "Follow-Up Intensity",
  "type": "PLATFORM_FLOW",
  "objectTypeId": "0-3",
  "isEnabled": false,
  "startActionId": "1",
  "nextAvailableActionId": "7",
  "enrollmentCriteria": { "shouldReEnroll": false, "type": "MANUAL" },
  "actions": [
    {
      "actionId": "1", "type": "LIST_BRANCH",
      "listBranches": [
        {
          "branchName": "High Priority",
          "filterBranch": {
            "filterBranchType": "OR", "filterBranchOperator": "OR",
            "filterBranches": [{ "filterBranchType": "AND", "filterBranchOperator": "AND",
              "filterBranches": [], "filters": [{ "filterType": "PROPERTY", "property": "hs_priority",
                "operation": { "operationType": "ENUMERATION", "operator": "IS_ANY_OF", "values": ["high"] } }]
            }], "filters": []
          },
          "connection": { "edgeType": "STANDARD", "nextActionId": "2" }
        },
        {
          "branchName": "Medium Priority",
          "filterBranch": {
            "filterBranchType": "OR", "filterBranchOperator": "OR",
            "filterBranches": [{ "filterBranchType": "AND", "filterBranchOperator": "AND",
              "filterBranches": [], "filters": [{ "filterType": "PROPERTY", "property": "hs_priority",
                "operation": { "operationType": "ENUMERATION", "operator": "IS_ANY_OF", "values": ["medium"] } }]
            }], "filters": []
          },
          "connection": { "edgeType": "STANDARD", "nextActionId": "4" }
        }
      ],
      "defaultBranchName": "Low / No Priority",
      "defaultBranch": { "edgeType": "STANDARD", "nextActionId": "6" }
    },
    { "actionId": "2", "type": "SINGLE_CONNECTION", "actionTypeVersion": 0, "actionTypeId": "0-1",
      "connection": { "edgeType": "STANDARD", "nextActionId": "3" },
      "fields": { "delta": "2", "time_unit": "DAYS" } },
    { "actionId": "3", "type": "SINGLE_CONNECTION", "actionTypeVersion": 0, "actionTypeId": "0-3",
      "fields": { "task_type": "TODO", "subject": "HIGH PRIORITY: {{ enrolled_object.dealname }}", "priority": "HIGH" } },
    { "actionId": "4", "type": "SINGLE_CONNECTION", "actionTypeVersion": 0, "actionTypeId": "0-1",
      "connection": { "edgeType": "STANDARD", "nextActionId": "5" },
      "fields": { "delta": "3", "time_unit": "DAYS" } },
    { "actionId": "5", "type": "SINGLE_CONNECTION", "actionTypeVersion": 0, "actionTypeId": "0-3",
      "fields": { "task_type": "TODO", "subject": "Follow up: {{ enrolled_object.dealname }}", "priority": "MEDIUM" } },
    { "actionId": "6", "type": "SINGLE_CONNECTION", "actionTypeVersion": 0, "actionTypeId": "0-3",
      "fields": { "task_type": "TODO", "subject": "Check: {{ enrolled_object.dealname }}", "priority": "LOW" } }
  ]
}
```

---

## 11. Chained LIST_BRANCH (Nested If/Then)

First branch checks if follow-up date exists. Default path leads to second branch checking closed lost reason.

```json
{
  "name": "Closed Lost Follow-Up Router",
  "type": "PLATFORM_FLOW",
  "objectTypeId": "0-3",
  "isEnabled": false,
  "startActionId": "1",
  "nextAvailableActionId": "9",
  "enrollmentCriteria": { "shouldReEnroll": false, "type": "MANUAL" },
  "actions": [
    {
      "actionId": "1", "type": "LIST_BRANCH",
      "listBranches": [{
        "branchName": "Has follow-up date",
        "filterBranch": {
          "filterBranchType": "OR", "filterBranchOperator": "OR",
          "filterBranches": [{ "filterBranchType": "AND", "filterBranchOperator": "AND",
            "filterBranches": [], "filters": [{ "filterType": "PROPERTY", "property": "follow_up_date",
              "operation": { "operationType": "ALL_PROPERTY", "operator": "IS_KNOWN" } }]
          }], "filters": []
        },
        "connection": { "edgeType": "STANDARD", "nextActionId": "2" }
      }],
      "defaultBranchName": "No follow-up date",
      "defaultBranch": { "edgeType": "STANDARD", "nextActionId": "4" }
    },
    { "actionId": "2", "type": "SINGLE_CONNECTION", "actionTypeVersion": 0, "actionTypeId": "0-1",
      "connection": { "edgeType": "STANDARD", "nextActionId": "3" },
      "fields": { "delta": "1", "time_unit": "DAYS" } },
    { "actionId": "3", "type": "SINGLE_CONNECTION", "actionTypeVersion": 0, "actionTypeId": "0-3",
      "fields": { "task_type": "TODO", "subject": "Follow up: {{ enrolled_object.dealname }}", "priority": "HIGH" } },
    {
      "actionId": "4", "type": "LIST_BRANCH",
      "listBranches": [{
        "branchName": "Not Ready",
        "filterBranch": {
          "filterBranchType": "OR", "filterBranchOperator": "OR",
          "filterBranches": [{ "filterBranchType": "AND", "filterBranchOperator": "AND",
            "filterBranches": [], "filters": [{ "filterType": "PROPERTY", "property": "closed_lost_reason",
              "operation": { "operationType": "MULTISTRING", "operator": "CONTAINS", "value": "Not Ready" } }]
          }], "filters": []
        },
        "connection": { "edgeType": "STANDARD", "nextActionId": "5" }
      }],
      "defaultBranchName": "Went Cold / Budget / Other",
      "defaultBranch": { "edgeType": "STANDARD", "nextActionId": "7" }
    },
    { "actionId": "5", "type": "SINGLE_CONNECTION", "actionTypeVersion": 0, "actionTypeId": "0-1",
      "connection": { "edgeType": "STANDARD", "nextActionId": "6" },
      "fields": { "delta": "45", "time_unit": "DAYS" } },
    { "actionId": "6", "type": "SINGLE_CONNECTION", "actionTypeVersion": 0, "actionTypeId": "0-3",
      "fields": { "task_type": "CALL", "subject": "Call re-engagement (45d): {{ enrolled_object.dealname }}", "priority": "HIGH" } },
    { "actionId": "7", "type": "SINGLE_CONNECTION", "actionTypeVersion": 0, "actionTypeId": "0-1",
      "connection": { "edgeType": "STANDARD", "nextActionId": "8" },
      "fields": { "delta": "90", "time_unit": "DAYS" } },
    { "actionId": "8", "type": "SINGLE_CONNECTION", "actionTypeVersion": 0, "actionTypeId": "0-3",
      "fields": { "task_type": "TODO", "subject": "Email re-engagement (3mo): {{ enrolled_object.dealname }}", "priority": "MEDIUM" } }
  ]
}
```

Key: The first LIST_BRANCH `defaultBranch` points to `actionId: "4"` which is the second LIST_BRANCH.
Note: `closed_lost_reason` is `string/textarea` type — uses `MULTISTRING CONTAINS` with singular `value`, not `ENUMERATION IS_ANY_OF` with `values` array.
