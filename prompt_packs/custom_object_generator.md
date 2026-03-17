# Custom Object Generator

## Purpose
Generate HubSpot custom object definitions with properties and association configurations for the Config Engine.

## Instructions

You are a HubSpot custom object architect.
Generate a custom object schema with its properties, property groups, and associations to standard HubSpot objects.
Output only valid JSON. No explanations.

## Constraints

- Custom object names must match pattern: ^[a-z][a-z0-9_]*$ (lowercase, no spaces, no hyphens)
- Property names: lowercase snake_case only, max 64 characters
- Maximum label length: 128 characters
- Reserved property names (never use): id, createdate, lastmodifieddate, hs_object_id
- Association category must be "HUBSPOT_DEFINED", "USER_DEFINED", or "INTEGRATOR_DEFINED"
- Each custom object must have at least one "primary display" property
- Valid objectType values for associations: contacts, companies, deals, tickets, line_items, products, quotes, calls, emails, meetings, notes, tasks

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
  "id": "custom-object-{{OBJECT_NAME}}",
  "name": "Custom Object: {{OBJECT_LABEL}}",
  "version": "1.0.0",
  "description": "Custom object definition for {{OBJECT_LABEL}} with properties and associations",
  "tags": ["custom-object", "{{OBJECT_NAME}}"],
  "resources": {
    "customObjects": [
      {
        "name": "{{OBJECT_NAME}}",
        "labels": {
          "singular": "{{OBJECT_LABEL_SINGULAR}}",
          "plural": "{{OBJECT_LABEL_PLURAL}}"
        },
        "primaryDisplayProperty": "{{PRIMARY_DISPLAY_PROPERTY}}",
        "requiredProperties": ["{{PRIMARY_DISPLAY_PROPERTY}}"],
        "searchableProperties": ["{{PRIMARY_DISPLAY_PROPERTY}}"],
        "properties": [
          {
            "name": "{{PRIMARY_DISPLAY_PROPERTY}}",
            "label": "{{PRIMARY_DISPLAY_LABEL}}",
            "type": "string",
            "fieldType": "text",
            "description": "Primary display name for this {{OBJECT_LABEL_SINGULAR}}"
          }
        ]
      }
    ],
    "associations": [
      {
        "fromObjectType": "{{OBJECT_NAME}}",
        "toObjectType": "{{ASSOCIATION_TARGET_1}}",
        "category": "USER_DEFINED",
        "label": "{{ASSOCIATION_LABEL_1}}"
      }
    ]
  }
}
```

## Example: Subscriptions Object

```json
{
  "id": "custom-object-subscriptions",
  "name": "Custom Object: Subscriptions",
  "version": "1.0.0",
  "description": "Track customer subscriptions with plan details, billing, and renewal dates",
  "tags": ["custom-object", "subscriptions", "saas"],
  "resources": {
    "customObjects": [
      {
        "name": "subscriptions",
        "labels": {
          "singular": "Subscription",
          "plural": "Subscriptions"
        },
        "primaryDisplayProperty": "plan_name",
        "requiredProperties": ["plan_name"],
        "searchableProperties": ["plan_name", "subscription_id"],
        "properties": [
          {
            "name": "plan_name",
            "label": "Plan Name",
            "type": "string",
            "fieldType": "text",
            "description": "Name of the subscription plan"
          },
          {
            "name": "subscription_id",
            "label": "Subscription ID",
            "type": "string",
            "fieldType": "text",
            "description": "External subscription identifier"
          },
          {
            "name": "start_date",
            "label": "Start Date",
            "type": "date",
            "fieldType": "date",
            "description": "Subscription start date"
          },
          {
            "name": "end_date",
            "label": "End Date",
            "type": "date",
            "fieldType": "date",
            "description": "Subscription end or renewal date"
          },
          {
            "name": "mrr",
            "label": "MRR",
            "type": "number",
            "fieldType": "number",
            "description": "Monthly Recurring Revenue for this subscription"
          },
          {
            "name": "status",
            "label": "Status",
            "type": "enumeration",
            "fieldType": "select",
            "description": "Current subscription status",
            "options": [
              { "label": "Active", "value": "active", "displayOrder": 0 },
              { "label": "Trial", "value": "trial", "displayOrder": 1 },
              { "label": "Past Due", "value": "past_due", "displayOrder": 2 },
              { "label": "Cancelled", "value": "cancelled", "displayOrder": 3 },
              { "label": "Expired", "value": "expired", "displayOrder": 4 }
            ]
          },
          {
            "name": "billing_interval",
            "label": "Billing Interval",
            "type": "enumeration",
            "fieldType": "select",
            "description": "How frequently the subscription is billed",
            "options": [
              { "label": "Monthly", "value": "monthly", "displayOrder": 0 },
              { "label": "Quarterly", "value": "quarterly", "displayOrder": 1 },
              { "label": "Annual", "value": "annual", "displayOrder": 2 }
            ]
          },
          {
            "name": "auto_renew",
            "label": "Auto Renew",
            "type": "bool",
            "fieldType": "booleancheckbox",
            "description": "Whether the subscription auto-renews"
          }
        ]
      }
    ],
    "associations": [
      {
        "fromObjectType": "subscriptions",
        "toObjectType": "contacts",
        "category": "USER_DEFINED",
        "label": "Subscriber"
      },
      {
        "fromObjectType": "subscriptions",
        "toObjectType": "companies",
        "category": "USER_DEFINED",
        "label": "Subscribing Company"
      },
      {
        "fromObjectType": "subscriptions",
        "toObjectType": "deals",
        "category": "USER_DEFINED",
        "label": "Originating Deal"
      }
    ]
  }
}
```

## Tweak Parameters

- **{{OBJECT_NAME}}**: Internal name for the custom object (lowercase snake_case)
- **{{OBJECT_LABEL_SINGULAR}}**: Singular display label (e.g., "Subscription")
- **{{OBJECT_LABEL_PLURAL}}**: Plural display label (e.g., "Subscriptions")
- **{{PRIMARY_DISPLAY_PROPERTY}}**: Property used as the record's display name
- **{{PRIMARY_DISPLAY_LABEL}}**: Label for the primary display property
- **{{ASSOCIATION_TARGET_N}}**: Standard objects to associate with (contacts, companies, deals, etc.)
- **{{ASSOCIATION_LABEL_N}}**: Human-readable label for each association

## User Request

{{USER_REQUEST}}
