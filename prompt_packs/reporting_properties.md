# Reporting Properties

## Purpose
Generate HubSpot properties designed for sales and marketing reporting: deal velocity, time-to-close, touchpoint counting, and attribution tracking.

## Instructions

You are a HubSpot reporting and analytics architect.
Generate property groups and properties that enable advanced reporting on sales velocity, marketing attribution, and funnel performance.
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
  "id": "reporting-properties",
  "name": "Reporting & Analytics Properties",
  "version": "1.0.0",
  "description": "Properties for deal velocity, attribution, and funnel performance reporting",
  "tags": ["properties", "reporting", "analytics"],
  "resources": {
    "propertyGroups": [
      {
        "name": "deal_velocity",
        "label": "Deal Velocity",
        "objectType": "deals",
        "displayOrder": 0
      },
      {
        "name": "attribution_tracking",
        "label": "Attribution Tracking",
        "objectType": "contacts",
        "displayOrder": 0
      }
    ],
    "properties": [
      {
        "name": "deal_velocity_days",
        "label": "Deal Velocity (Days)",
        "type": "number",
        "fieldType": "number",
        "objectType": "deals",
        "groupName": "deal_velocity",
        "description": "Total calendar days from deal creation to close (won or lost)"
      },
      {
        "name": "time_to_close_days",
        "label": "Time to Close (Days)",
        "type": "number",
        "fieldType": "number",
        "objectType": "deals",
        "groupName": "deal_velocity",
        "description": "Calendar days from deal creation to Closed Won only"
      },
      {
        "name": "days_in_current_stage",
        "label": "Days in Current Stage",
        "type": "number",
        "fieldType": "number",
        "objectType": "deals",
        "groupName": "deal_velocity",
        "description": "Number of days the deal has been in its current pipeline stage"
      },
      {
        "name": "stage_entered_date",
        "label": "Current Stage Entered Date",
        "type": "datetime",
        "fieldType": "date",
        "objectType": "deals",
        "groupName": "deal_velocity",
        "description": "Timestamp when the deal entered its current stage"
      },
      {
        "name": "stalled_deal",
        "label": "Stalled Deal",
        "type": "bool",
        "fieldType": "booleancheckbox",
        "objectType": "deals",
        "groupName": "deal_velocity",
        "description": "Flagged true when deal has been in the same stage for more than {{STALLED_THRESHOLD_DAYS}} days"
      },
      {
        "name": "touchpoints_before_close",
        "label": "Touchpoints Before Close",
        "type": "number",
        "fieldType": "number",
        "objectType": "deals",
        "groupName": "deal_velocity",
        "description": "Total number of logged activities (calls, emails, meetings) on the deal before close"
      },
      {
        "name": "meetings_before_close",
        "label": "Meetings Before Close",
        "type": "number",
        "fieldType": "number",
        "objectType": "deals",
        "groupName": "deal_velocity",
        "description": "Number of meetings logged before deal close"
      },
      {
        "name": "emails_before_close",
        "label": "Emails Before Close",
        "type": "number",
        "fieldType": "number",
        "objectType": "deals",
        "groupName": "deal_velocity",
        "description": "Number of emails sent/received before deal close"
      },
      {
        "name": "first_touch_source",
        "label": "First Touch Source",
        "type": "enumeration",
        "fieldType": "select",
        "objectType": "contacts",
        "groupName": "attribution_tracking",
        "description": "Channel of the very first interaction with this contact",
        "options": [
          { "label": "Organic Search", "value": "organic_search", "displayOrder": 0 },
          { "label": "Paid Search", "value": "paid_search", "displayOrder": 1 },
          { "label": "Social Media", "value": "social_media", "displayOrder": 2 },
          { "label": "Referral", "value": "referral", "displayOrder": 3 },
          { "label": "Direct", "value": "direct", "displayOrder": 4 },
          { "label": "Email", "value": "email", "displayOrder": 5 },
          { "label": "Event", "value": "event", "displayOrder": 6 },
          { "label": "Partner", "value": "partner", "displayOrder": 7 },
          { "label": "Content Syndication", "value": "content_syndication", "displayOrder": 8 },
          { "label": "Other", "value": "other", "displayOrder": 9 }
        ]
      },
      {
        "name": "first_touch_detail",
        "label": "First Touch Detail",
        "type": "string",
        "fieldType": "text",
        "objectType": "contacts",
        "groupName": "attribution_tracking",
        "description": "Specific campaign, page, or referrer of the first touch"
      },
      {
        "name": "first_touch_date",
        "label": "First Touch Date",
        "type": "datetime",
        "fieldType": "date",
        "objectType": "contacts",
        "groupName": "attribution_tracking",
        "description": "Date of the first recorded interaction"
      },
      {
        "name": "last_marketing_touch",
        "label": "Last Marketing Touch",
        "type": "string",
        "fieldType": "text",
        "objectType": "contacts",
        "groupName": "attribution_tracking",
        "description": "Most recent marketing interaction (campaign name, content asset, or channel)"
      },
      {
        "name": "last_marketing_touch_date",
        "label": "Last Marketing Touch Date",
        "type": "datetime",
        "fieldType": "date",
        "objectType": "contacts",
        "groupName": "attribution_tracking",
        "description": "Date of the most recent marketing interaction"
      },
      {
        "name": "first_sales_touch",
        "label": "First Sales Touch",
        "type": "string",
        "fieldType": "text",
        "objectType": "contacts",
        "groupName": "attribution_tracking",
        "description": "First recorded sales interaction (call, email, or meeting)"
      },
      {
        "name": "first_sales_touch_date",
        "label": "First Sales Touch Date",
        "type": "datetime",
        "fieldType": "date",
        "objectType": "contacts",
        "groupName": "attribution_tracking",
        "description": "Date of the first sales interaction"
      },
      {
        "name": "attribution_source",
        "label": "Attribution Source",
        "type": "enumeration",
        "fieldType": "select",
        "objectType": "contacts",
        "groupName": "attribution_tracking",
        "description": "Primary attributed source for this contact's conversion to customer",
        "options": [
          { "label": "Marketing", "value": "marketing", "displayOrder": 0 },
          { "label": "Sales Outbound", "value": "sales_outbound", "displayOrder": 1 },
          { "label": "Inbound", "value": "inbound", "displayOrder": 2 },
          { "label": "Partner", "value": "partner", "displayOrder": 3 },
          { "label": "Product-Led", "value": "product_led", "displayOrder": 4 },
          { "label": "Event", "value": "event", "displayOrder": 5 }
        ]
      },
      {
        "name": "total_marketing_touchpoints",
        "label": "Total Marketing Touchpoints",
        "type": "number",
        "fieldType": "number",
        "objectType": "contacts",
        "groupName": "attribution_tracking",
        "description": "Count of all marketing interactions before becoming a customer"
      },
      {
        "name": "total_sales_touchpoints",
        "label": "Total Sales Touchpoints",
        "type": "number",
        "fieldType": "number",
        "objectType": "contacts",
        "groupName": "attribution_tracking",
        "description": "Count of all sales interactions before becoming a customer"
      }
    ]
  }
}
```

## Tweak Parameters

- **{{REPORTING_METRICS}}**: Which metric categories to include — "velocity", "attribution", or "both" (default: both)
- **{{STALLED_THRESHOLD_DAYS}}**: Number of days in same stage before a deal is flagged stalled (default: 14)
- **{{ATTRIBUTION_SOURCES}}**: Custom list of attribution source options
- **{{CALCULATION_FORMULAS}}**: Whether to use calculation_equation fieldType for computed metrics (default: false — use number for manual/workflow-set values)

## User Request

{{USER_REQUEST}}
