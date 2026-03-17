# Full CRM Setup

## Purpose
Generate a complete HubSpot CRM configuration template combining contact lifecycle properties, company enrichment, sales pipeline, support pipeline, core workflows, and segmentation lists. This is the "everything pack" for new portal setup.

## Instructions

You are a HubSpot CRM implementation architect.
Generate a complete, production-ready CRM configuration that can be deployed to a new HubSpot portal. This template combines all core building blocks: property groups, properties across contacts and companies, a sales deal pipeline, a support ticket pipeline, onboarding and lifecycle workflows, and segmentation lists.
Adapt the configuration based on the specified industry, company size, and sales model.
Output only valid JSON. No explanations.

## Constraints

- Property names: lowercase snake_case only
- Maximum property name length: 64 characters
- Maximum label length: 128 characters
- Reserved names (never use): id, createdate, lastmodifieddate, hs_object_id
- Valid objectType values: contacts, companies, deals, tickets, line_items, products, quotes, calls, emails, meetings, notes, tasks
- Pipeline objectType: "deals" or "tickets"
- Pipeline stages need displayOrder (integer starting at 0)
- Enumeration properties MUST include options array
- Custom object names: ^[a-z][a-z0-9_]*$
- List processingType: "DYNAMIC" or "MANUAL"
- All workflows deployed with isEnabled=false

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

### Common objectTypeIds

- Contacts: "0-1"
- Companies: "0-2"
- Deals: "0-3"
- Tickets: "0-5"

## Output Format

```json
{
  "id": "full-crm-setup-{{INDUSTRY}}",
  "name": "Full CRM Setup — {{INDUSTRY}} ({{SALES_MODEL}})",
  "version": "1.0.0",
  "description": "Complete CRM configuration for a {{COMPANY_SIZE}} {{INDUSTRY}} company using a {{SALES_MODEL}} sales model",
  "tags": ["full-setup", "crm", "{{INDUSTRY}}", "{{SALES_MODEL}}"],
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
      },
      {
        "name": "firmographic_enrichment",
        "label": "Firmographic Enrichment",
        "objectType": "companies",
        "displayOrder": 0
      },
      {
        "name": "account_classification",
        "label": "Account Classification",
        "objectType": "companies",
        "displayOrder": 1
      },
      {
        "name": "financial_tracking",
        "label": "Financial Tracking",
        "objectType": "companies",
        "displayOrder": 2
      },
      {
        "name": "deal_velocity",
        "label": "Deal Velocity",
        "objectType": "deals",
        "displayOrder": 0
      },
      {
        "name": "support_tracking",
        "label": "Support Tracking",
        "objectType": "tickets",
        "displayOrder": 0
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
        "description": "Specific campaign, referrer, or event name"
      },
      {
        "name": "first_conversion_date",
        "label": "First Conversion Date",
        "type": "datetime",
        "fieldType": "date",
        "objectType": "contacts",
        "groupName": "lifecycle_tracking",
        "description": "Date of first form submission or conversion"
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
        "name": "customer_date",
        "label": "Customer Date",
        "type": "datetime",
        "fieldType": "date",
        "objectType": "contacts",
        "groupName": "lifecycle_tracking",
        "description": "Date the contact became a paying customer"
      },
      {
        "name": "lead_score",
        "label": "Lead Score",
        "type": "number",
        "fieldType": "number",
        "objectType": "contacts",
        "groupName": "lifecycle_tracking",
        "description": "Combined lead score for qualification"
      },
      {
        "name": "nps_score",
        "label": "NPS Score",
        "type": "number",
        "fieldType": "number",
        "objectType": "contacts",
        "groupName": "customer_health",
        "description": "Net Promoter Score from most recent survey"
      },
      {
        "name": "customer_health_score",
        "label": "Customer Health Score",
        "type": "number",
        "fieldType": "number",
        "objectType": "contacts",
        "groupName": "customer_health",
        "description": "Composite health score (0-100)"
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
        "name": "industry_vertical",
        "label": "Industry Vertical",
        "type": "enumeration",
        "fieldType": "select",
        "objectType": "companies",
        "groupName": "firmographic_enrichment",
        "description": "Specific industry vertical for segmentation",
        "options": [
          { "label": "{{INDUSTRY_1}}", "value": "{{INDUSTRY_1_VALUE}}", "displayOrder": 0 },
          { "label": "{{INDUSTRY_2}}", "value": "{{INDUSTRY_2_VALUE}}", "displayOrder": 1 },
          { "label": "{{INDUSTRY_3}}", "value": "{{INDUSTRY_3_VALUE}}", "displayOrder": 2 },
          { "label": "{{INDUSTRY_4}}", "value": "{{INDUSTRY_4_VALUE}}", "displayOrder": 3 },
          { "label": "Other", "value": "other", "displayOrder": 4 }
        ]
      },
      {
        "name": "company_tier",
        "label": "Company Tier",
        "type": "enumeration",
        "fieldType": "select",
        "objectType": "companies",
        "groupName": "account_classification",
        "description": "Account tier based on size and strategic value",
        "options": [
          { "label": "Enterprise", "value": "enterprise", "displayOrder": 0 },
          { "label": "Mid-Market", "value": "mid_market", "displayOrder": 1 },
          { "label": "SMB", "value": "smb", "displayOrder": 2 }
        ]
      },
      {
        "name": "employee_count_range",
        "label": "Employee Count Range",
        "type": "enumeration",
        "fieldType": "select",
        "objectType": "companies",
        "groupName": "firmographic_enrichment",
        "description": "Employee count band for segmentation",
        "options": [
          { "label": "1-10", "value": "1_10", "displayOrder": 0 },
          { "label": "11-50", "value": "11_50", "displayOrder": 1 },
          { "label": "51-200", "value": "51_200", "displayOrder": 2 },
          { "label": "201-500", "value": "201_500", "displayOrder": 3 },
          { "label": "501-1000", "value": "501_1000", "displayOrder": 4 },
          { "label": "1001+", "value": "1001_plus", "displayOrder": 5 }
        ]
      },
      {
        "name": "arr_band",
        "label": "ARR Band",
        "type": "enumeration",
        "fieldType": "select",
        "objectType": "companies",
        "groupName": "financial_tracking",
        "description": "Annual Recurring Revenue band",
        "options": [
          { "label": "$0 - $10K", "value": "0_10k", "displayOrder": 0 },
          { "label": "$10K - $50K", "value": "10k_50k", "displayOrder": 1 },
          { "label": "$50K - $100K", "value": "50k_100k", "displayOrder": 2 },
          { "label": "$100K+", "value": "100k_plus", "displayOrder": 3 }
        ]
      },
      {
        "name": "renewal_date",
        "label": "Renewal Date",
        "type": "date",
        "fieldType": "date",
        "objectType": "companies",
        "groupName": "financial_tracking",
        "description": "Next contract or subscription renewal date"
      },
      {
        "name": "deal_velocity_days",
        "label": "Deal Velocity (Days)",
        "type": "number",
        "fieldType": "number",
        "objectType": "deals",
        "groupName": "deal_velocity",
        "description": "Calendar days from deal creation to close"
      },
      {
        "name": "time_to_close_days",
        "label": "Time to Close (Days)",
        "type": "number",
        "fieldType": "number",
        "objectType": "deals",
        "groupName": "deal_velocity",
        "description": "Calendar days from deal creation to Closed Won"
      },
      {
        "name": "ticket_priority",
        "label": "Ticket Priority",
        "type": "enumeration",
        "fieldType": "select",
        "objectType": "tickets",
        "groupName": "support_tracking",
        "description": "Priority level for SLA determination",
        "options": [
          { "label": "Critical", "value": "critical", "displayOrder": 0 },
          { "label": "High", "value": "high", "displayOrder": 1 },
          { "label": "Medium", "value": "medium", "displayOrder": 2 },
          { "label": "Low", "value": "low", "displayOrder": 3 }
        ]
      },
      {
        "name": "sla_breached",
        "label": "SLA Breached",
        "type": "bool",
        "fieldType": "booleancheckbox",
        "objectType": "tickets",
        "groupName": "support_tracking",
        "description": "Whether the SLA target was missed"
      }
    ],

    "pipelines": [
      {
        "label": "{{SALES_PIPELINE_NAME}}",
        "objectType": "deals",
        "displayOrder": 0,
        "stages": [
          { "label": "{{SALES_STAGE_1}}", "displayOrder": 0, "metadata": { "probability": "0.10" } },
          { "label": "{{SALES_STAGE_2}}", "displayOrder": 1, "metadata": { "probability": "0.20" } },
          { "label": "{{SALES_STAGE_3}}", "displayOrder": 2, "metadata": { "probability": "0.40" } },
          { "label": "{{SALES_STAGE_4}}", "displayOrder": 3, "metadata": { "probability": "0.60" } },
          { "label": "{{SALES_STAGE_5}}", "displayOrder": 4, "metadata": { "probability": "0.80" } },
          { "label": "Closed Won", "displayOrder": 5, "metadata": { "probability": "1.0" } },
          { "label": "Closed Lost", "displayOrder": 6, "metadata": { "probability": "0.0" } }
        ]
      },
      {
        "label": "Support Pipeline",
        "objectType": "tickets",
        "displayOrder": 0,
        "stages": [
          { "label": "New", "displayOrder": 0 },
          { "label": "Triaged", "displayOrder": 1 },
          { "label": "In Progress", "displayOrder": 2 },
          { "label": "Waiting on Customer", "displayOrder": 3 },
          { "label": "Resolved", "displayOrder": 4 },
          { "label": "Closed", "displayOrder": 5 }
        ]
      }
    ],

    "workflows": [
      {
        "name": "New Customer Onboarding",
        "type": "PLATFORM_FLOW",
        "objectTypeId": "0-3",
        "startActionId": "1",
        "nextAvailableActionId": 5,
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
            "subject": "Onboarding kickoff: Schedule welcome call",
            "priority": "HIGH",
            "connection": { "nextActionId": "3" }
          },
          {
            "actionId": "3",
            "actionTypeId": "DELAY",
            "delayMilliseconds": 259200000,
            "connection": { "nextActionId": "4" }
          },
          {
            "actionId": "4",
            "actionTypeId": "CREATE_TASK",
            "subject": "Onboarding follow-up: Verify setup complete",
            "priority": "MEDIUM"
          }
        ]
      },
      {
        "name": "MQL Lifecycle Advancement",
        "type": "CONTACT_FLOW",
        "objectTypeId": "0-1",
        "startActionId": "1",
        "nextAvailableActionId": 3,
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
            "actionTypeId": "CREATE_TASK",
            "subject": "New MQL: Review and qualify",
            "priority": "HIGH"
          }
        ]
      }
    ],

    "lists": [
      {
        "name": "MQLs — Marketing Qualified Leads",
        "objectTypeId": "0-1",
        "processingType": "DYNAMIC",
        "filterCriteria": {
          "filterGroups": [
            {
              "filters": [
                { "propertyName": "lifecyclestage", "operator": "EQ", "value": "marketingqualifiedlead" }
              ]
            }
          ]
        }
      },
      {
        "name": "SQLs — Sales Qualified Leads",
        "objectTypeId": "0-1",
        "processingType": "DYNAMIC",
        "filterCriteria": {
          "filterGroups": [
            {
              "filters": [
                { "propertyName": "lifecyclestage", "operator": "EQ", "value": "salesqualifiedlead" }
              ]
            }
          ]
        }
      },
      {
        "name": "Active Customers",
        "objectTypeId": "0-1",
        "processingType": "DYNAMIC",
        "filterCriteria": {
          "filterGroups": [
            {
              "filters": [
                { "propertyName": "lifecyclestage", "operator": "EQ", "value": "customer" }
              ]
            }
          ]
        }
      },
      {
        "name": "Engaged Last 30 Days",
        "objectTypeId": "0-1",
        "processingType": "DYNAMIC",
        "filterCriteria": {
          "filterGroups": [
            {
              "filters": [
                { "propertyName": "hs_last_activity_date", "operator": "UPDATED_IN_LAST_X_DAYS", "value": "30" }
              ]
            }
          ]
        }
      },
      {
        "name": "No Activity 90+ Days",
        "objectTypeId": "0-1",
        "processingType": "DYNAMIC",
        "filterCriteria": {
          "filterGroups": [
            {
              "filters": [
                { "propertyName": "hs_last_activity_date", "operator": "NOT_UPDATED_IN_LAST_X_DAYS", "value": "90" }
              ]
            }
          ]
        }
      },
      {
        "name": "Enterprise Accounts",
        "objectTypeId": "0-2",
        "processingType": "DYNAMIC",
        "filterCriteria": {
          "filterGroups": [
            {
              "filters": [
                { "propertyName": "company_tier", "operator": "EQ", "value": "enterprise" }
              ]
            }
          ]
        }
      }
    ]
  }
}
```

## Sales Model Presets

### Product-Led Growth (PLG)
- Pipeline stages: Free Trial → Activated → Converted → Expansion → Closed Won → Closed Lost
- Focus on product usage signals over sales touches
- Lower MQL threshold, higher emphasis on behavioral scoring

### Sales-Led
- Pipeline stages: Discovery → Qualification → Demo → Proposal → Negotiation → Closed Won → Closed Lost
- Focus on sales activity metrics and outbound touchpoints
- Higher MQL threshold, emphasis on demographic scoring

### Hybrid (Product-Led + Sales)
- Pipeline stages: Product Signup → Product Qualified → Sales Engaged → Proposal → Closed Won → Closed Lost
- Combines product usage triggers with sales qualification

## Tweak Parameters

- **{{INDUSTRY}}**: Target industry (e.g., "saas", "professional_services", "ecommerce", "healthcare")
- **{{COMPANY_SIZE}}**: Company size context — "startup", "smb", "mid_market", "enterprise"
- **{{SALES_MODEL}}**: Sales approach — "product_led", "sales_led", "hybrid" (default: sales_led)
- **{{SALES_PIPELINE_NAME}}**: Name for the sales pipeline (default: "Sales Pipeline")
- **{{SALES_STAGE_N}}**: Custom stage names for the sales pipeline
- **{{MQL_THRESHOLD}}**: Lead score threshold for MQL (default: 50)
- **{{INDUSTRY_N}}**: Custom industry vertical names
- **{{INDUSTRY_N_VALUE}}**: Custom industry vertical values

## User Request

{{USER_REQUEST}}
