# Contact Lifecycle Properties

## Purpose
Generate a comprehensive set of HubSpot contact properties for tracking the full customer lifecycle from lead acquisition through churn risk assessment.

## Instructions

You are a HubSpot lifecycle marketing architect.
Generate a property group and contact properties that track each lifecycle stage transition with timestamps, plus health and engagement metrics.
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

## Output Format

```json
{
  "id": "contact-lifecycle-properties",
  "name": "Contact Lifecycle Properties",
  "version": "1.0.0",
  "description": "Properties tracking the full contact lifecycle from lead to customer, including health scoring and churn risk",
  "tags": ["properties", "lifecycle", "contacts"],
  "resources": {
    "propertyGroups": [
      {
        "name": "lifecycle_tracking",
        "label": "Lifecycle Tracking",
        "objectType": "contacts",
        "displayOrder": 0
      },
      {
        "name": "customer_health",
        "label": "Customer Health",
        "objectType": "contacts",
        "displayOrder": 1
      }
    ],
    "properties": [
      {
        "name": "lead_source",
        "label": "Lead Source",
        "type": "enumeration",
        "fieldType": "select",
        "objectType": "contacts",
        "groupName": "lifecycle_tracking",
        "description": "Primary channel through which this contact was acquired",
        "options": [
          { "label": "Organic Search", "value": "organic_search", "displayOrder": 0 },
          { "label": "Paid Search", "value": "paid_search", "displayOrder": 1 },
          { "label": "Social Media", "value": "social_media", "displayOrder": 2 },
          { "label": "Referral", "value": "referral", "displayOrder": 3 },
          { "label": "Direct", "value": "direct", "displayOrder": 4 },
          { "label": "Email", "value": "email", "displayOrder": 5 },
          { "label": "Event", "value": "event", "displayOrder": 6 },
          { "label": "Partner", "value": "partner", "displayOrder": 7 },
          { "label": "Other", "value": "other", "displayOrder": 8 }
        ]
      },
      {
        "name": "lead_source_detail",
        "label": "Lead Source Detail",
        "type": "string",
        "fieldType": "text",
        "objectType": "contacts",
        "groupName": "lifecycle_tracking",
        "description": "Specific detail about lead source (e.g., campaign name, referrer, event name)"
      },
      {
        "name": "first_conversion_date",
        "label": "First Conversion Date",
        "type": "datetime",
        "fieldType": "date",
        "objectType": "contacts",
        "groupName": "lifecycle_tracking",
        "description": "Date of first form submission or conversion event"
      },
      {
        "name": "first_conversion_type",
        "label": "First Conversion Type",
        "type": "string",
        "fieldType": "text",
        "objectType": "contacts",
        "groupName": "lifecycle_tracking",
        "description": "Type or name of the first conversion (e.g., form name, CTA)"
      },
      {
        "name": "mql_date",
        "label": "MQL Date",
        "type": "datetime",
        "fieldType": "date",
        "objectType": "contacts",
        "groupName": "lifecycle_tracking",
        "description": "Date the contact became a Marketing Qualified Lead"
      },
      {
        "name": "sql_date",
        "label": "SQL Date",
        "type": "datetime",
        "fieldType": "date",
        "objectType": "contacts",
        "groupName": "lifecycle_tracking",
        "description": "Date the contact became a Sales Qualified Lead"
      },
      {
        "name": "opportunity_date",
        "label": "Opportunity Date",
        "type": "datetime",
        "fieldType": "date",
        "objectType": "contacts",
        "groupName": "lifecycle_tracking",
        "description": "Date the contact was associated with a deal opportunity"
      },
      {
        "name": "customer_date",
        "label": "Customer Date",
        "type": "datetime",
        "fieldType": "date",
        "objectType": "contacts",
        "groupName": "lifecycle_tracking",
        "description": "Date the contact became a paying customer"
      },
      {
        "name": "days_lead_to_mql",
        "label": "Days: Lead to MQL",
        "type": "number",
        "fieldType": "number",
        "objectType": "contacts",
        "groupName": "lifecycle_tracking",
        "description": "Number of days from lead creation to MQL status"
      },
      {
        "name": "days_mql_to_sql",
        "label": "Days: MQL to SQL",
        "type": "number",
        "fieldType": "number",
        "objectType": "contacts",
        "groupName": "lifecycle_tracking",
        "description": "Number of days from MQL to SQL status"
      },
      {
        "name": "days_sql_to_customer",
        "label": "Days: SQL to Customer",
        "type": "number",
        "fieldType": "number",
        "objectType": "contacts",
        "groupName": "lifecycle_tracking",
        "description": "Number of days from SQL to Customer status"
      },
      {
        "name": "nps_score",
        "label": "NPS Score",
        "type": "number",
        "fieldType": "number",
        "objectType": "contacts",
        "groupName": "customer_health",
        "description": "Net Promoter Score (-100 to 100) from most recent survey"
      },
      {
        "name": "nps_category",
        "label": "NPS Category",
        "type": "enumeration",
        "fieldType": "select",
        "objectType": "contacts",
        "groupName": "customer_health",
        "description": "NPS classification based on score",
        "options": [
          { "label": "Promoter (9-10)", "value": "promoter", "displayOrder": 0 },
          { "label": "Passive (7-8)", "value": "passive", "displayOrder": 1 },
          { "label": "Detractor (0-6)", "value": "detractor", "displayOrder": 2 }
        ]
      },
      {
        "name": "customer_health_score",
        "label": "Customer Health Score",
        "type": "number",
        "fieldType": "number",
        "objectType": "contacts",
        "groupName": "customer_health",
        "description": "Composite health score (0-100) based on usage, engagement, and support metrics"
      },
      {
        "name": "customer_health_status",
        "label": "Customer Health Status",
        "type": "enumeration",
        "fieldType": "select",
        "objectType": "contacts",
        "groupName": "customer_health",
        "description": "Health status classification",
        "options": [
          { "label": "Healthy", "value": "healthy", "displayOrder": 0 },
          { "label": "Needs Attention", "value": "needs_attention", "displayOrder": 1 },
          { "label": "At Risk", "value": "at_risk", "displayOrder": 2 },
          { "label": "Churning", "value": "churning", "displayOrder": 3 }
        ]
      },
      {
        "name": "churn_risk_score",
        "label": "Churn Risk Score",
        "type": "number",
        "fieldType": "number",
        "objectType": "contacts",
        "groupName": "customer_health",
        "description": "Predicted churn risk percentage (0-100)"
      },
      {
        "name": "last_nps_survey_date",
        "label": "Last NPS Survey Date",
        "type": "datetime",
        "fieldType": "date",
        "objectType": "contacts",
        "groupName": "customer_health",
        "description": "Date of most recent NPS survey response"
      }
    ]
  }
}
```

## Tweak Parameters

- **{{LIFECYCLE_STAGES}}**: Which stage transitions to track (default: all — lead, MQL, SQL, opportunity, customer)
- **{{CUSTOM_STAGES}}**: Additional custom lifecycle stages to add date tracking for (e.g., "product_qualified_lead", "evangelist")
- **{{INCLUDE_HEALTH_SCORING}}**: Whether to include NPS and health score properties (default: true)
- **{{LEAD_SOURCES}}**: Custom list of lead source options to replace defaults

## User Request

{{USER_REQUEST}}
