# Customer Onboarding Workflow

## Purpose
Generate a HubSpot workflow that automates the customer onboarding process, triggered when a deal closes won.

## Instructions

You are a HubSpot customer success automation architect.
Generate a workflow configuration that orchestrates the post-sale onboarding sequence: lifecycle updates, task creation for onboarding touchpoints, and timed follow-ups.
Output only valid JSON. No explanations.

## Constraints

- Workflow type must be "CONTACT_FLOW" or "PLATFORM_FLOW"
- objectTypeId values: "0-1" (contacts), "0-2" (companies), "0-3" (deals), "0-5" (tickets)
- startActionId must reference an existing action in the actions array
- nextAvailableActionId must be greater than all action IDs
- All workflows are deployed with isEnabled=false (safety)
- DELAY actionTypeId requires delayMilliseconds field
- 1 day = 86400000 ms, 3 days = 259200000 ms, 7 days = 604800000 ms

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
  "id": "customer-onboarding-workflow",
  "name": "Customer Onboarding Workflow",
  "version": "1.0.0",
  "description": "Automated onboarding sequence with {{NUM_TOUCHPOINTS}} touchpoints over {{ONBOARDING_DURATION}} days",
  "tags": ["workflow", "onboarding", "customer-success"],
  "resources": {
    "workflows": [
      {
        "name": "Customer Onboarding Sequence",
        "type": "PLATFORM_FLOW",
        "objectTypeId": "0-3",
        "startActionId": "1",
        "nextAvailableActionId": 10,
        "enrollmentCriteria": {
          "type": "PROPERTY",
          "propertyName": "dealstage",
          "operator": "SET_ANY",
          "value": "closedwon"
        },
        "actions": [
          {
            "actionId": "1",
            "actionTypeId": "SET_CONTACT_PROPERTY",
            "propertyName": "lifecyclestage",
            "propertyValue": "customer",
            "connection": { "nextActionId": "2" }
          },
          {
            "actionId": "2",
            "actionTypeId": "CREATE_TASK",
            "subject": "Onboarding kickoff: Schedule welcome call with {{TASK_ASSIGNEE}}",
            "priority": "HIGH",
            "notes": "New customer onboarding. Review deal notes and prepare kickoff agenda. Target: schedule within 24 hours of close.",
            "connection": { "nextActionId": "3" }
          },
          {
            "actionId": "3",
            "actionTypeId": "SEND_INTERNAL_EMAIL",
            "recipientEmail": "{{INTERNAL_NOTIFICATION_EMAIL}}",
            "subject": "New Customer Onboarding Required",
            "body": "A deal has closed won and requires onboarding kickoff. Please review the deal record and assigned tasks.",
            "connection": { "nextActionId": "4" }
          },
          {
            "actionId": "4",
            "actionTypeId": "DELAY",
            "delayMilliseconds": {{DELAY_1_MS}},
            "connection": { "nextActionId": "5" }
          },
          {
            "actionId": "5",
            "actionTypeId": "CREATE_TASK",
            "subject": "Onboarding check-in: Verify account setup complete",
            "priority": "MEDIUM",
            "notes": "Confirm the customer has completed initial setup. Check if credentials were provisioned and welcome materials sent.",
            "connection": { "nextActionId": "6" }
          },
          {
            "actionId": "6",
            "actionTypeId": "DELAY",
            "delayMilliseconds": {{DELAY_2_MS}},
            "connection": { "nextActionId": "7" }
          },
          {
            "actionId": "7",
            "actionTypeId": "CREATE_TASK",
            "subject": "Onboarding follow-up: First value check-in",
            "priority": "MEDIUM",
            "notes": "Reach out to confirm the customer is seeing initial value. Address any blockers or questions.",
            "connection": { "nextActionId": "8" }
          },
          {
            "actionId": "8",
            "actionTypeId": "DELAY",
            "delayMilliseconds": {{DELAY_3_MS}},
            "connection": { "nextActionId": "9" }
          },
          {
            "actionId": "9",
            "actionTypeId": "CREATE_TASK",
            "subject": "Onboarding complete: Transition to ongoing success",
            "priority": "MEDIUM",
            "notes": "Final onboarding touchpoint. Confirm the customer is fully set up and transitioned to ongoing customer success management."
          }
        ]
      }
    ]
  }
}
```

## Default Touchpoint Timeline

| Touchpoint | Day | Action                             |
|------------|-----|------------------------------------|
| 1          | 0   | Kickoff task + internal alert      |
| 2          | 3   | Verify account setup               |
| 3          | 10  | First value check-in               |
| 4          | 21  | Onboarding complete / handoff      |

## Tweak Parameters

- **{{NUM_TOUCHPOINTS}}**: Number of onboarding touchpoints (default: 4)
- **{{ONBOARDING_DURATION}}**: Total onboarding period in days (default: 21)
- **{{DELAY_1_MS}}**: Milliseconds for first delay (default: 259200000 = 3 days)
- **{{DELAY_2_MS}}**: Milliseconds for second delay (default: 604800000 = 7 days)
- **{{DELAY_3_MS}}**: Milliseconds for third delay (default: 950400000 = 11 days)
- **{{TASK_ASSIGNEE}}**: Name or role of task assignee (default: "Customer Success Manager")
- **{{INTERNAL_NOTIFICATION_EMAIL}}**: Email address for internal onboarding notifications

## User Request

{{USER_REQUEST}}
