# Re-Engagement Workflow

## Purpose
Generate a HubSpot workflow that re-engages inactive contacts through a timed email and branching sequence.

## Instructions

You are a HubSpot marketing automation architect.
Generate a workflow that identifies inactive contacts, sends re-engagement communications, and branches based on whether the contact re-engages or remains inactive.
Output only valid JSON. No explanations.

## Constraints

- Workflow type must be "CONTACT_FLOW" or "PLATFORM_FLOW"
- objectTypeId values: "0-1" (contacts), "0-2" (companies), "0-3" (deals), "0-5" (tickets)
- startActionId must reference an existing action in the actions array
- nextAvailableActionId must be greater than all action IDs
- All workflows are deployed with isEnabled=false (safety)
- DELAY actionTypeId requires delayMilliseconds field
- IF_BRANCH requires condition and yesActionId/noActionId

## Valid Action Types

- SET_CONTACT_PROPERTY
- CREATE_TASK
- SEND_EMAIL
- DELAY
- IF_BRANCH
- SEND_INTERNAL_EMAIL
- ADD_TO_LIST
- REMOVE_FROM_LIST

## Output Format

```json
{
  "id": "re-engagement-workflow",
  "name": "Re-Engagement Workflow",
  "version": "1.0.0",
  "description": "Re-engage contacts inactive for {{INACTIVITY_DAYS}}+ days with a {{NUM_EMAILS}}-touch email sequence and lifecycle branching",
  "tags": ["workflow", "re-engagement", "lifecycle", "email"],
  "resources": {
    "workflows": [
      {
        "name": "Contact Re-Engagement Sequence",
        "type": "CONTACT_FLOW",
        "objectTypeId": "0-1",
        "startActionId": "1",
        "nextAvailableActionId": 10,
        "enrollmentCriteria": {
          "type": "PROPERTY",
          "propertyName": "hs_last_activity_date",
          "operator": "NOT_UPDATED_IN_LAST_X_DAYS",
          "value": "{{INACTIVITY_DAYS}}"
        },
        "actions": [
          {
            "actionId": "1",
            "actionTypeId": "SET_CONTACT_PROPERTY",
            "propertyName": "re_engagement_status",
            "propertyValue": "in_sequence",
            "connection": { "nextActionId": "2" }
          },
          {
            "actionId": "2",
            "actionTypeId": "SEND_EMAIL",
            "emailId": "{{RE_ENGAGEMENT_EMAIL_1_ID}}",
            "emailName": "{{RE_ENGAGEMENT_EMAIL_1_SUBJECT}}",
            "connection": { "nextActionId": "3" }
          },
          {
            "actionId": "3",
            "actionTypeId": "DELAY",
            "delayMilliseconds": {{DELAY_1_MS}},
            "connection": { "nextActionId": "4" }
          },
          {
            "actionId": "4",
            "actionTypeId": "IF_BRANCH",
            "condition": {
              "type": "PROPERTY",
              "propertyName": "hs_email_open",
              "operator": "HAS_PROPERTY"
            },
            "yesActionId": "5",
            "noActionId": "7"
          },
          {
            "actionId": "5",
            "actionTypeId": "SET_CONTACT_PROPERTY",
            "propertyName": "re_engagement_status",
            "propertyValue": "re_engaged",
            "connection": { "nextActionId": "6" }
          },
          {
            "actionId": "6",
            "actionTypeId": "CREATE_TASK",
            "subject": "Re-engaged contact: Follow up personally",
            "priority": "MEDIUM",
            "notes": "This contact re-engaged after inactivity. Reach out while they are warm."
          },
          {
            "actionId": "7",
            "actionTypeId": "SEND_EMAIL",
            "emailId": "{{RE_ENGAGEMENT_EMAIL_2_ID}}",
            "emailName": "{{RE_ENGAGEMENT_EMAIL_2_SUBJECT}}",
            "connection": { "nextActionId": "8" }
          },
          {
            "actionId": "8",
            "actionTypeId": "DELAY",
            "delayMilliseconds": {{DELAY_2_MS}},
            "connection": { "nextActionId": "9" }
          },
          {
            "actionId": "9",
            "actionTypeId": "IF_BRANCH",
            "condition": {
              "type": "PROPERTY",
              "propertyName": "hs_email_open",
              "operator": "HAS_PROPERTY"
            },
            "yesActionId": "5",
            "noActionId": "10"
          },
          {
            "actionId": "10",
            "actionTypeId": "SET_CONTACT_PROPERTY",
            "propertyName": "re_engagement_status",
            "propertyValue": "inactive",
            "connection": { "nextActionId": "11" }
          },
          {
            "actionId": "11",
            "actionTypeId": "ADD_TO_LIST",
            "listId": "{{INACTIVE_LIST_ID}}",
            "listName": "{{INACTIVE_LIST_NAME}}"
          }
        ]
      }
    ],
    "properties": [
      {
        "name": "re_engagement_status",
        "label": "Re-Engagement Status",
        "type": "enumeration",
        "fieldType": "select",
        "objectType": "contacts",
        "groupName": "contactinformation",
        "description": "Tracks whether the contact is in a re-engagement sequence and the outcome",
        "options": [
          { "label": "Not Started", "value": "not_started", "displayOrder": 0 },
          { "label": "In Sequence", "value": "in_sequence", "displayOrder": 1 },
          { "label": "Re-Engaged", "value": "re_engaged", "displayOrder": 2 },
          { "label": "Inactive", "value": "inactive", "displayOrder": 3 }
        ]
      }
    ]
  }
}
```

## Default Sequence Timeline

| Step | Day  | Action                                            |
|------|------|---------------------------------------------------|
| 1    | 0    | Set status → send first re-engagement email       |
| 2    | 7    | Check engagement: if opened → re-engaged path     |
| 3    | 7    | If not opened → send second email                 |
| 4    | 14   | Check again: if opened → re-engaged, if not → inactive list |

## Tweak Parameters

- **{{INACTIVITY_DAYS}}**: Days of inactivity before enrollment (default: 90)
- **{{DELAY_1_MS}}**: Wait after first email in milliseconds (default: 604800000 = 7 days)
- **{{DELAY_2_MS}}**: Wait after second email in milliseconds (default: 604800000 = 7 days)
- **{{NUM_EMAILS}}**: Number of re-engagement emails in sequence (default: 2)
- **{{RE_ENGAGEMENT_EMAIL_1_ID}}**: HubSpot email ID for first re-engagement email
- **{{RE_ENGAGEMENT_EMAIL_1_SUBJECT}}**: Subject line for first email (e.g., "We miss you — here's what's new")
- **{{RE_ENGAGEMENT_EMAIL_2_ID}}**: HubSpot email ID for second re-engagement email
- **{{RE_ENGAGEMENT_EMAIL_2_SUBJECT}}**: Subject line for second email (e.g., "Last chance to stay connected")
- **{{INACTIVE_LIST_ID}}**: HubSpot list ID for the inactive contacts list
- **{{INACTIVE_LIST_NAME}}**: Name for the inactive contacts list (default: "Inactive — No Re-Engagement")

## User Request

{{USER_REQUEST}}
