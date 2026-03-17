# Lead Scoring Setup

## Purpose
Generate a lead scoring system for HubSpot including score properties, scoring tier enumeration, and lifecycle stage advancement workflows.

## Instructions

You are a HubSpot demand generation architect.
Generate a complete lead scoring configuration including properties to store scores and tiers, plus workflows that evaluate scoring criteria and advance lifecycle stages.
Output only valid JSON. No explanations.

## Constraints

- Property names: lowercase snake_case only
- Maximum property name length: 64 characters
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

### Scoring Model Guidelines

- Demographic scoring: attributes the contact already has (job title, company size, industry, location)
- Behavioral scoring: actions the contact has taken (page views, form submissions, email opens, content downloads)
- Combined scoring: sum of demographic + behavioral scores
- Negative scoring: subtract points for unsubscribes, bounced emails, competitor domains

## Output Format

```json
{
  "id": "lead-scoring-{{OBJECT_TYPE}}",
  "name": "Lead Scoring System",
  "version": "1.0.0",
  "description": "Lead scoring properties, tiers, and lifecycle advancement workflows",
  "tags": ["lead-scoring", "lifecycle", "properties", "workflow"],
  "resources": {
    "propertyGroups": [
      {
        "name": "lead_scoring",
        "label": "Lead Scoring",
        "objectType": "{{OBJECT_TYPE}}",
        "displayOrder": 0
      }
    ],
    "properties": [
      {
        "name": "lead_score",
        "label": "Lead Score",
        "type": "number",
        "fieldType": "number",
        "objectType": "{{OBJECT_TYPE}}",
        "groupName": "lead_scoring",
        "description": "Combined lead score (demographic + behavioral)"
      },
      {
        "name": "demographic_score",
        "label": "Demographic Score",
        "type": "number",
        "fieldType": "number",
        "objectType": "{{OBJECT_TYPE}}",
        "groupName": "lead_scoring",
        "description": "Score based on contact attributes (title, company size, industry)"
      },
      {
        "name": "behavioral_score",
        "label": "Behavioral Score",
        "type": "number",
        "fieldType": "number",
        "objectType": "{{OBJECT_TYPE}}",
        "groupName": "lead_scoring",
        "description": "Score based on engagement actions (page views, form fills, email clicks)"
      },
      {
        "name": "scoring_tier",
        "label": "Scoring Tier",
        "type": "enumeration",
        "fieldType": "select",
        "objectType": "{{OBJECT_TYPE}}",
        "groupName": "lead_scoring",
        "description": "Tier classification based on lead score thresholds",
        "options": [
          { "label": "Cold", "value": "cold", "displayOrder": 0 },
          { "label": "Warm", "value": "warm", "displayOrder": 1 },
          { "label": "Hot", "value": "hot", "displayOrder": 2 },
          { "label": "On Fire", "value": "on_fire", "displayOrder": 3 }
        ]
      },
      {
        "name": "score_last_updated",
        "label": "Score Last Updated",
        "type": "datetime",
        "fieldType": "date",
        "objectType": "{{OBJECT_TYPE}}",
        "groupName": "lead_scoring",
        "description": "Timestamp of last score recalculation"
      },
      {
        "name": "mql_date",
        "label": "MQL Date",
        "type": "datetime",
        "fieldType": "date",
        "objectType": "{{OBJECT_TYPE}}",
        "groupName": "lead_scoring",
        "description": "Date the contact became a Marketing Qualified Lead"
      },
      {
        "name": "sql_date",
        "label": "SQL Date",
        "type": "datetime",
        "fieldType": "date",
        "objectType": "{{OBJECT_TYPE}}",
        "groupName": "lead_scoring",
        "description": "Date the contact became a Sales Qualified Lead"
      }
    ],
    "workflows": [
      {
        "name": "Lead Score → MQL Promotion",
        "type": "CONTACT_FLOW",
        "objectTypeId": "0-1",
        "startActionId": "1",
        "nextAvailableActionId": 4,
        "enrollmentCriteria": {
          "type": "PROPERTY",
          "propertyName": "lead_score",
          "operator": "GTE",
          "value": "{{MQL_THRESHOLD}}"
        },
        "actions": [
          {
            "actionId": "1",
            "actionTypeId": "SET_CONTACT_PROPERTY",
            "propertyName": "lifecyclestage",
            "propertyValue": "marketingqualifiedlead",
            "connection": { "nextActionId": "2" }
          },
          {
            "actionId": "2",
            "actionTypeId": "SET_CONTACT_PROPERTY",
            "propertyName": "scoring_tier",
            "propertyValue": "hot",
            "connection": { "nextActionId": "3" }
          },
          {
            "actionId": "3",
            "actionTypeId": "CREATE_TASK",
            "subject": "New MQL: Review and qualify",
            "priority": "HIGH"
          }
        ]
      },
      {
        "name": "Lead Score → SQL Promotion",
        "type": "CONTACT_FLOW",
        "objectTypeId": "0-1",
        "startActionId": "1",
        "nextAvailableActionId": 3,
        "enrollmentCriteria": {
          "type": "PROPERTY",
          "propertyName": "lead_score",
          "operator": "GTE",
          "value": "{{SQL_THRESHOLD}}"
        },
        "actions": [
          {
            "actionId": "1",
            "actionTypeId": "SET_CONTACT_PROPERTY",
            "propertyName": "lifecyclestage",
            "propertyValue": "salesqualifiedlead",
            "connection": { "nextActionId": "2" }
          },
          {
            "actionId": "2",
            "actionTypeId": "CREATE_TASK",
            "subject": "New SQL: Schedule intro call",
            "priority": "HIGH"
          }
        ]
      }
    ]
  }
}
```

## Scoring Criteria Reference

### Demographic Scoring ({{SCORING_MODEL}})
- Job title matches ICP: +15 points
- Company size in target range: +10 points
- Industry match: +10 points
- Geographic fit: +5 points
- Competitor domain: -20 points
- Personal email domain (gmail, yahoo): -5 points

### Behavioral Scoring ({{SCORING_MODEL}})
- Form submission: +20 points
- Pricing page view: +15 points
- Case study download: +10 points
- Email open: +2 points
- Email click: +5 points
- Webinar attendance: +15 points
- Unsubscribe: -30 points
- 30 days no activity: -10 points

## Tweak Parameters

- **{{OBJECT_TYPE}}**: Target object type (default: contacts)
- **{{SCORING_MODEL}}**: Scoring approach — "demographic", "behavioral", or "combined" (default: combined)
- **{{MQL_THRESHOLD}}**: Minimum score to qualify as MQL (default: 50)
- **{{SQL_THRESHOLD}}**: Minimum score to qualify as SQL (default: 80)

## User Request

{{USER_REQUEST}}
