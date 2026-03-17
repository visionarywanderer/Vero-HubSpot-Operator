# Company Enrichment Properties

## Purpose
Generate HubSpot company properties for data enrichment, firmographic segmentation, and account tiering.

## Instructions

You are a HubSpot data enrichment and ABM specialist.
Generate a property group and company properties used for firmographic enrichment, account tiering, and renewal tracking.
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
  "id": "company-enrichment-properties",
  "name": "Company Enrichment Properties",
  "version": "1.0.0",
  "description": "Firmographic enrichment, account tiering, and renewal tracking properties for companies",
  "tags": ["properties", "companies", "enrichment", "abm"],
  "resources": {
    "propertyGroups": [
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
      }
    ],
    "properties": [
      {
        "name": "industry_vertical",
        "label": "Industry Vertical",
        "type": "enumeration",
        "fieldType": "select",
        "objectType": "companies",
        "groupName": "firmographic_enrichment",
        "description": "Specific industry vertical for segmentation and content targeting",
        "options": [
          { "label": "{{INDUSTRY_1}}", "value": "{{INDUSTRY_1_VALUE}}", "displayOrder": 0 },
          { "label": "{{INDUSTRY_2}}", "value": "{{INDUSTRY_2_VALUE}}", "displayOrder": 1 },
          { "label": "{{INDUSTRY_3}}", "value": "{{INDUSTRY_3_VALUE}}", "displayOrder": 2 },
          { "label": "{{INDUSTRY_4}}", "value": "{{INDUSTRY_4_VALUE}}", "displayOrder": 3 },
          { "label": "{{INDUSTRY_5}}", "value": "{{INDUSTRY_5_VALUE}}", "displayOrder": 4 },
          { "label": "Other", "value": "other", "displayOrder": 5 }
        ]
      },
      {
        "name": "company_tier",
        "label": "Company Tier",
        "type": "enumeration",
        "fieldType": "select",
        "objectType": "companies",
        "groupName": "account_classification",
        "description": "Account tier based on company size, revenue, and strategic value",
        "options": [
          { "label": "{{TIER_1_LABEL}}", "value": "{{TIER_1_VALUE}}", "displayOrder": 0 },
          { "label": "{{TIER_2_LABEL}}", "value": "{{TIER_2_VALUE}}", "displayOrder": 1 },
          { "label": "{{TIER_3_LABEL}}", "value": "{{TIER_3_VALUE}}", "displayOrder": 2 }
        ]
      },
      {
        "name": "arr_band",
        "label": "ARR Band",
        "type": "enumeration",
        "fieldType": "select",
        "objectType": "companies",
        "groupName": "financial_tracking",
        "description": "Annual Recurring Revenue band for revenue segmentation",
        "options": [
          { "label": "$0 - $10K", "value": "0_10k", "displayOrder": 0 },
          { "label": "$10K - $50K", "value": "10k_50k", "displayOrder": 1 },
          { "label": "$50K - $100K", "value": "50k_100k", "displayOrder": 2 },
          { "label": "$100K - $500K", "value": "100k_500k", "displayOrder": 3 },
          { "label": "$500K+", "value": "500k_plus", "displayOrder": 4 }
        ]
      },
      {
        "name": "arr_amount",
        "label": "ARR Amount",
        "type": "number",
        "fieldType": "number",
        "objectType": "companies",
        "groupName": "financial_tracking",
        "description": "Exact Annual Recurring Revenue amount"
      },
      {
        "name": "tech_stack",
        "label": "Tech Stack",
        "type": "enumeration",
        "fieldType": "checkbox",
        "objectType": "companies",
        "groupName": "firmographic_enrichment",
        "description": "Known technologies and tools used by this company (multi-select)",
        "options": [
          { "label": "Salesforce", "value": "salesforce", "displayOrder": 0 },
          { "label": "HubSpot", "value": "hubspot", "displayOrder": 1 },
          { "label": "Marketo", "value": "marketo", "displayOrder": 2 },
          { "label": "Intercom", "value": "intercom", "displayOrder": 3 },
          { "label": "Slack", "value": "slack", "displayOrder": 4 },
          { "label": "Zendesk", "value": "zendesk", "displayOrder": 5 },
          { "label": "Jira", "value": "jira", "displayOrder": 6 },
          { "label": "AWS", "value": "aws", "displayOrder": 7 },
          { "label": "Google Cloud", "value": "gcp", "displayOrder": 8 },
          { "label": "Azure", "value": "azure", "displayOrder": 9 }
        ]
      },
      {
        "name": "employee_count_range",
        "label": "Employee Count Range",
        "type": "enumeration",
        "fieldType": "select",
        "objectType": "companies",
        "groupName": "firmographic_enrichment",
        "description": "Employee count band for company size segmentation",
        "options": [
          { "label": "1-10", "value": "1_10", "displayOrder": 0 },
          { "label": "11-50", "value": "11_50", "displayOrder": 1 },
          { "label": "51-200", "value": "51_200", "displayOrder": 2 },
          { "label": "201-500", "value": "201_500", "displayOrder": 3 },
          { "label": "501-1000", "value": "501_1000", "displayOrder": 4 },
          { "label": "1001-5000", "value": "1001_5000", "displayOrder": 5 },
          { "label": "5001+", "value": "5001_plus", "displayOrder": 6 }
        ]
      },
      {
        "name": "fiscal_year_end",
        "label": "Fiscal Year End",
        "type": "enumeration",
        "fieldType": "select",
        "objectType": "companies",
        "groupName": "financial_tracking",
        "description": "Month when the company's fiscal year ends — useful for budget cycle timing",
        "options": [
          { "label": "January", "value": "january", "displayOrder": 0 },
          { "label": "February", "value": "february", "displayOrder": 1 },
          { "label": "March", "value": "march", "displayOrder": 2 },
          { "label": "April", "value": "april", "displayOrder": 3 },
          { "label": "May", "value": "may", "displayOrder": 4 },
          { "label": "June", "value": "june", "displayOrder": 5 },
          { "label": "July", "value": "july", "displayOrder": 6 },
          { "label": "August", "value": "august", "displayOrder": 7 },
          { "label": "September", "value": "september", "displayOrder": 8 },
          { "label": "October", "value": "october", "displayOrder": 9 },
          { "label": "November", "value": "november", "displayOrder": 10 },
          { "label": "December", "value": "december", "displayOrder": 11 }
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
        "name": "contract_start_date",
        "label": "Contract Start Date",
        "type": "date",
        "fieldType": "date",
        "objectType": "companies",
        "groupName": "financial_tracking",
        "description": "Current contract start date"
      },
      {
        "name": "contract_term_months",
        "label": "Contract Term (Months)",
        "type": "number",
        "fieldType": "number",
        "objectType": "companies",
        "groupName": "financial_tracking",
        "description": "Length of current contract in months"
      },
      {
        "name": "data_enrichment_source",
        "label": "Data Enrichment Source",
        "type": "enumeration",
        "fieldType": "select",
        "objectType": "companies",
        "groupName": "firmographic_enrichment",
        "description": "Source of enrichment data for audit purposes",
        "options": [
          { "label": "Manual", "value": "manual", "displayOrder": 0 },
          { "label": "Clearbit", "value": "clearbit", "displayOrder": 1 },
          { "label": "ZoomInfo", "value": "zoominfo", "displayOrder": 2 },
          { "label": "LinkedIn", "value": "linkedin", "displayOrder": 3 },
          { "label": "HubSpot Insights", "value": "hubspot_insights", "displayOrder": 4 }
        ]
      },
      {
        "name": "last_enriched_date",
        "label": "Last Enriched Date",
        "type": "datetime",
        "fieldType": "date",
        "objectType": "companies",
        "groupName": "firmographic_enrichment",
        "description": "Date when company data was last enriched or verified"
      }
    ]
  }
}
```

## Default Tier Definitions

| Tier       | Employee Count | ARR Potential | Criteria                                     |
|------------|----------------|---------------|----------------------------------------------|
| Enterprise | 1000+          | $100K+        | Large org, complex needs, long sales cycle   |
| Mid-Market | 51-999         | $10K-$100K    | Growth-stage, expanding teams                |
| SMB        | 1-50           | < $10K        | Small team, self-serve or low-touch          |

## Tweak Parameters

- **{{TIER_N_LABEL}}**: Custom tier names (default: Enterprise, Mid-Market, SMB)
- **{{TIER_N_VALUE}}**: Custom tier values in snake_case
- **{{INDUSTRY_N}}**: Custom industry vertical names for your market
- **{{INDUSTRY_N_VALUE}}**: Custom industry values in snake_case

## User Request

{{USER_REQUEST}}
