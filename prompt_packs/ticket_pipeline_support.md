# Support Ticket Pipeline

## Purpose
Generate a support ticket pipeline with priority and SLA tracking properties for HubSpot Service Hub.

## Instructions

You are a HubSpot Service Hub architect.
Generate a ticket pipeline configuration with stages reflecting a complete support lifecycle, plus properties for priority classification and SLA tracking.
Output only valid JSON. No explanations.

## Constraints

- Pipeline objectType must be "tickets"
- Each stage must have a label and displayOrder (integer, starting at 0)
- Property names: lowercase snake_case only, max 64 characters
- Maximum label length: 128 characters
- Reserved names (never use): id, createdate, lastmodifieddate, hs_object_id
- Valid objectType values: contacts, companies, deals, tickets, line_items, products, quotes, calls, emails, meetings, notes, tasks

### Property Types and Field Types

| type               | Valid fieldType values                  |
|--------------------|-----------------------------------------|
| string             | text, textarea, phonenumber, file, html |
| number             | number, calculation_equation            |
| datetime           | date                                    |
| date               | date                                    |
| bool               | booleancheckbox                         |
| enumeration        | select, radio, checkbox                 |
| object_coordinates | text                                    |

## Output Format

```json
{
  "id": "support-ticket-pipeline",
  "name": "Support Ticket Pipeline with SLA Tracking",
  "version": "1.0.0",
  "description": "Support ticket pipeline with {{NUM_PRIORITY_LEVELS}} priority levels and {{NUM_SLA_TIERS}} SLA tiers",
  "tags": ["pipeline", "tickets", "support", "sla"],
  "resources": {
    "propertyGroups": [
      {
        "name": "support_tracking",
        "label": "Support Tracking",
        "objectType": "tickets",
        "displayOrder": 0
      }
    ],
    "properties": [
      {
        "name": "ticket_priority",
        "label": "Ticket Priority",
        "type": "enumeration",
        "fieldType": "select",
        "objectType": "tickets",
        "groupName": "support_tracking",
        "description": "Priority level determining response and resolution SLA",
        "options": [
          { "label": "{{PRIORITY_1_LABEL}}", "value": "{{PRIORITY_1_VALUE}}", "displayOrder": 0 },
          { "label": "{{PRIORITY_2_LABEL}}", "value": "{{PRIORITY_2_VALUE}}", "displayOrder": 1 },
          { "label": "{{PRIORITY_3_LABEL}}", "value": "{{PRIORITY_3_VALUE}}", "displayOrder": 2 },
          { "label": "{{PRIORITY_4_LABEL}}", "value": "{{PRIORITY_4_VALUE}}", "displayOrder": 3 }
        ]
      },
      {
        "name": "sla_tier",
        "label": "SLA Tier",
        "type": "enumeration",
        "fieldType": "select",
        "objectType": "tickets",
        "groupName": "support_tracking",
        "description": "Customer SLA tier determining response time commitments",
        "options": [
          { "label": "{{SLA_TIER_1_LABEL}}", "value": "{{SLA_TIER_1_VALUE}}", "displayOrder": 0 },
          { "label": "{{SLA_TIER_2_LABEL}}", "value": "{{SLA_TIER_2_VALUE}}", "displayOrder": 1 },
          { "label": "{{SLA_TIER_3_LABEL}}", "value": "{{SLA_TIER_3_VALUE}}", "displayOrder": 2 }
        ]
      },
      {
        "name": "sla_response_target_hours",
        "label": "SLA Response Target (Hours)",
        "type": "number",
        "fieldType": "number",
        "objectType": "tickets",
        "groupName": "support_tracking",
        "description": "Target hours for first response based on priority and SLA tier"
      },
      {
        "name": "sla_resolution_target_hours",
        "label": "SLA Resolution Target (Hours)",
        "type": "number",
        "fieldType": "number",
        "objectType": "tickets",
        "groupName": "support_tracking",
        "description": "Target hours for full resolution based on priority and SLA tier"
      },
      {
        "name": "first_response_at",
        "label": "First Response At",
        "type": "datetime",
        "fieldType": "date",
        "objectType": "tickets",
        "groupName": "support_tracking",
        "description": "Timestamp of first agent response"
      },
      {
        "name": "resolved_at",
        "label": "Resolved At",
        "type": "datetime",
        "fieldType": "date",
        "objectType": "tickets",
        "groupName": "support_tracking",
        "description": "Timestamp when ticket was marked resolved"
      },
      {
        "name": "sla_breached",
        "label": "SLA Breached",
        "type": "bool",
        "fieldType": "booleancheckbox",
        "objectType": "tickets",
        "groupName": "support_tracking",
        "description": "Whether the SLA response or resolution target was missed"
      },
      {
        "name": "ticket_category",
        "label": "Ticket Category",
        "type": "enumeration",
        "fieldType": "select",
        "objectType": "tickets",
        "groupName": "support_tracking",
        "description": "Category for ticket classification and routing",
        "options": [
          { "label": "Bug", "value": "bug", "displayOrder": 0 },
          { "label": "Feature Request", "value": "feature_request", "displayOrder": 1 },
          { "label": "How-To Question", "value": "how_to", "displayOrder": 2 },
          { "label": "Account Issue", "value": "account_issue", "displayOrder": 3 },
          { "label": "Billing", "value": "billing", "displayOrder": 4 },
          { "label": "Integration", "value": "integration", "displayOrder": 5 }
        ]
      },
      {
        "name": "escalated",
        "label": "Escalated",
        "type": "bool",
        "fieldType": "booleancheckbox",
        "objectType": "tickets",
        "groupName": "support_tracking",
        "description": "Whether this ticket has been escalated to a senior agent or manager"
      }
    ],
    "pipelines": [
      {
        "label": "{{PIPELINE_NAME}}",
        "objectType": "tickets",
        "displayOrder": 0,
        "stages": [
          { "label": "New", "displayOrder": 0 },
          { "label": "Triaged", "displayOrder": 1 },
          { "label": "In Progress", "displayOrder": 2 },
          { "label": "Waiting on Customer", "displayOrder": 3 },
          { "label": "Waiting on Third Party", "displayOrder": 4 },
          { "label": "Resolved", "displayOrder": 5 },
          { "label": "Closed", "displayOrder": 6 }
        ]
      }
    ]
  }
}
```

## Default SLA Matrix

| Priority | Platinum Response | Platinum Resolution | Gold Response | Gold Resolution | Standard Response | Standard Resolution |
|----------|-------------------|---------------------|---------------|-----------------|-------------------|---------------------|
| Critical | 1 hour            | 4 hours             | 2 hours       | 8 hours         | 4 hours           | 24 hours            |
| High     | 2 hours           | 8 hours             | 4 hours       | 16 hours        | 8 hours           | 48 hours            |
| Medium   | 4 hours           | 24 hours            | 8 hours       | 48 hours        | 24 hours          | 72 hours            |
| Low      | 8 hours           | 48 hours            | 24 hours      | 72 hours        | 48 hours          | 120 hours           |

## Tweak Parameters

- **{{PIPELINE_NAME}}**: Name of the pipeline (default: "Support Pipeline")
- **{{NUM_PRIORITY_LEVELS}}**: Number of priority levels (default: 4 — Critical, High, Medium, Low)
- **{{PRIORITY_N_LABEL}}**: Custom priority level names
- **{{PRIORITY_N_VALUE}}**: Custom priority level values (snake_case)
- **{{NUM_SLA_TIERS}}**: Number of SLA tiers (default: 3 — Platinum, Gold, Standard)
- **{{SLA_TIER_N_LABEL}}**: Custom SLA tier names
- **{{SLA_TIER_N_VALUE}}**: Custom SLA tier values (snake_case)

## User Request

{{USER_REQUEST}}
