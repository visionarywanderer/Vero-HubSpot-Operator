# ABM Account Setup

## Purpose
Generate a complete Account-Based Marketing configuration for HubSpot: target account properties, ICP scoring, buying committee tracking, and tiered dynamic lists.

## Instructions

You are a HubSpot ABM strategist and configuration architect.
Generate company and contact properties for ABM execution, plus dynamic lists segmented by account tier. The output should enable a team to run a multi-tier ABM program with ICP scoring, engagement tracking, and buying committee mapping.
Output only valid JSON. No explanations.

## Constraints

- Property names: lowercase snake_case only
- Maximum property name length: 64 characters
- Maximum label length: 128 characters
- Reserved names (never use): id, createdate, lastmodifieddate, hs_object_id
- Valid objectType values: contacts, companies, deals, tickets, line_items, products, quotes, calls, emails, meetings, notes, tasks
- List processingType must be "DYNAMIC" or "MANUAL"

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
  "id": "abm-account-setup",
  "name": "ABM Account Setup",
  "version": "1.0.0",
  "description": "Account-Based Marketing configuration with {{NUM_TIERS}} tiers, ICP scoring, buying committee roles, and segmentation lists",
  "tags": ["abm", "properties", "lists", "companies", "contacts"],
  "resources": {
    "propertyGroups": [
      {
        "name": "abm_account",
        "label": "ABM — Account Intelligence",
        "objectType": "companies",
        "displayOrder": 0
      },
      {
        "name": "abm_contact",
        "label": "ABM — Buying Committee",
        "objectType": "contacts",
        "displayOrder": 0
      }
    ],
    "properties": [
      {
        "name": "target_account",
        "label": "Target Account",
        "type": "bool",
        "fieldType": "booleancheckbox",
        "objectType": "companies",
        "groupName": "abm_account",
        "description": "Whether this company is a designated ABM target account"
      },
      {
        "name": "target_account_tier",
        "label": "Target Account Tier",
        "type": "enumeration",
        "fieldType": "select",
        "objectType": "companies",
        "groupName": "abm_account",
        "description": "ABM tier determining the level of personalized engagement",
        "options": [
          { "label": "{{TIER_1_LABEL}}", "value": "{{TIER_1_VALUE}}", "displayOrder": 0 },
          { "label": "{{TIER_2_LABEL}}", "value": "{{TIER_2_VALUE}}", "displayOrder": 1 },
          { "label": "{{TIER_3_LABEL}}", "value": "{{TIER_3_VALUE}}", "displayOrder": 2 }
        ]
      },
      {
        "name": "icp_score",
        "label": "ICP Score",
        "type": "number",
        "fieldType": "number",
        "objectType": "companies",
        "groupName": "abm_account",
        "description": "Ideal Customer Profile fit score (0-100) based on firmographic and technographic signals"
      },
      {
        "name": "icp_fit",
        "label": "ICP Fit",
        "type": "enumeration",
        "fieldType": "select",
        "objectType": "companies",
        "groupName": "abm_account",
        "description": "ICP fit classification derived from ICP score",
        "options": [
          { "label": "Strong Fit", "value": "strong_fit", "displayOrder": 0 },
          { "label": "Moderate Fit", "value": "moderate_fit", "displayOrder": 1 },
          { "label": "Weak Fit", "value": "weak_fit", "displayOrder": 2 },
          { "label": "Not a Fit", "value": "not_a_fit", "displayOrder": 3 }
        ]
      },
      {
        "name": "account_engagement_score",
        "label": "Account Engagement Score",
        "type": "number",
        "fieldType": "number",
        "objectType": "companies",
        "groupName": "abm_account",
        "description": "Aggregated engagement score across all contacts at this account (0-100)"
      },
      {
        "name": "account_engagement_level",
        "label": "Account Engagement Level",
        "type": "enumeration",
        "fieldType": "select",
        "objectType": "companies",
        "groupName": "abm_account",
        "description": "Engagement level classification for ABM prioritization",
        "options": [
          { "label": "Highly Engaged", "value": "highly_engaged", "displayOrder": 0 },
          { "label": "Engaged", "value": "engaged", "displayOrder": 1 },
          { "label": "Partially Engaged", "value": "partially_engaged", "displayOrder": 2 },
          { "label": "Not Engaged", "value": "not_engaged", "displayOrder": 3 }
        ]
      },
      {
        "name": "abm_account_status",
        "label": "ABM Account Status",
        "type": "enumeration",
        "fieldType": "select",
        "objectType": "companies",
        "groupName": "abm_account",
        "description": "Current status of this account in the ABM program",
        "options": [
          { "label": "Identified", "value": "identified", "displayOrder": 0 },
          { "label": "Researching", "value": "researching", "displayOrder": 1 },
          { "label": "Engaging", "value": "engaging", "displayOrder": 2 },
          { "label": "Opportunity", "value": "opportunity", "displayOrder": 3 },
          { "label": "Customer", "value": "customer", "displayOrder": 4 },
          { "label": "Nurturing", "value": "nurturing", "displayOrder": 5 }
        ]
      },
      {
        "name": "known_contacts_count",
        "label": "Known Contacts Count",
        "type": "number",
        "fieldType": "number",
        "objectType": "companies",
        "groupName": "abm_account",
        "description": "Number of known contacts at this target account"
      },
      {
        "name": "buying_committee_coverage",
        "label": "Buying Committee Coverage",
        "type": "enumeration",
        "fieldType": "select",
        "objectType": "companies",
        "groupName": "abm_account",
        "description": "How much of the buying committee has been identified",
        "options": [
          { "label": "Full (4+ roles)", "value": "full", "displayOrder": 0 },
          { "label": "Partial (2-3 roles)", "value": "partial", "displayOrder": 1 },
          { "label": "Minimal (1 role)", "value": "minimal", "displayOrder": 2 },
          { "label": "None", "value": "none", "displayOrder": 3 }
        ]
      },
      {
        "name": "buying_committee_role",
        "label": "Buying Committee Role",
        "type": "enumeration",
        "fieldType": "select",
        "objectType": "contacts",
        "groupName": "abm_contact",
        "description": "This contact's role in the buying committee for their company",
        "options": [
          { "label": "Champion", "value": "champion", "displayOrder": 0 },
          { "label": "Decision Maker", "value": "decision_maker", "displayOrder": 1 },
          { "label": "Budget Holder", "value": "budget_holder", "displayOrder": 2 },
          { "label": "Influencer", "value": "influencer", "displayOrder": 3 },
          { "label": "End User", "value": "end_user", "displayOrder": 4 },
          { "label": "Blocker", "value": "blocker", "displayOrder": 5 },
          { "label": "Unknown", "value": "unknown", "displayOrder": 6 }
        ]
      },
      {
        "name": "contact_engagement_score",
        "label": "Contact Engagement Score",
        "type": "number",
        "fieldType": "number",
        "objectType": "contacts",
        "groupName": "abm_contact",
        "description": "Individual contact engagement score contributing to account-level engagement"
      },
      {
        "name": "abm_persona",
        "label": "ABM Persona",
        "type": "enumeration",
        "fieldType": "select",
        "objectType": "contacts",
        "groupName": "abm_contact",
        "description": "Persona segment for ABM content targeting",
        "options": [
          { "label": "Executive", "value": "executive", "displayOrder": 0 },
          { "label": "Technical", "value": "technical", "displayOrder": 1 },
          { "label": "Operations", "value": "operations", "displayOrder": 2 },
          { "label": "Finance", "value": "finance", "displayOrder": 3 },
          { "label": "Other", "value": "other", "displayOrder": 4 }
        ]
      }
    ],
    "lists": [
      {
        "name": "ABM — Tier 1 Target Accounts",
        "objectTypeId": "0-2",
        "processingType": "DYNAMIC",
        "filterCriteria": {
          "filterGroups": [
            {
              "filters": [
                { "propertyName": "target_account", "operator": "EQ", "value": "true" },
                { "propertyName": "target_account_tier", "operator": "EQ", "value": "{{TIER_1_VALUE}}" }
              ]
            }
          ]
        }
      },
      {
        "name": "ABM — Tier 2 Target Accounts",
        "objectTypeId": "0-2",
        "processingType": "DYNAMIC",
        "filterCriteria": {
          "filterGroups": [
            {
              "filters": [
                { "propertyName": "target_account", "operator": "EQ", "value": "true" },
                { "propertyName": "target_account_tier", "operator": "EQ", "value": "{{TIER_2_VALUE}}" }
              ]
            }
          ]
        }
      },
      {
        "name": "ABM — Tier 3 Target Accounts",
        "objectTypeId": "0-2",
        "processingType": "DYNAMIC",
        "filterCriteria": {
          "filterGroups": [
            {
              "filters": [
                { "propertyName": "target_account", "operator": "EQ", "value": "true" },
                { "propertyName": "target_account_tier", "operator": "EQ", "value": "{{TIER_3_VALUE}}" }
              ]
            }
          ]
        }
      },
      {
        "name": "ABM — Highly Engaged Accounts",
        "objectTypeId": "0-2",
        "processingType": "DYNAMIC",
        "filterCriteria": {
          "filterGroups": [
            {
              "filters": [
                { "propertyName": "target_account", "operator": "EQ", "value": "true" },
                { "propertyName": "account_engagement_level", "operator": "EQ", "value": "highly_engaged" }
              ]
            }
          ]
        }
      },
      {
        "name": "ABM — Decision Makers at Target Accounts",
        "objectTypeId": "0-1",
        "processingType": "DYNAMIC",
        "filterCriteria": {
          "filterGroups": [
            {
              "filters": [
                { "propertyName": "buying_committee_role", "operator": "IN", "value": "decision_maker;budget_holder;champion" }
              ]
            }
          ]
        }
      }
    ]
  }
}
```

## Default Tier Definitions

| Tier   | Value  | Strategy                    | Engagement Level             |
|--------|--------|-----------------------------|------------------------------|
| Tier 1 | tier_1 | 1:1 personalized outreach   | Dedicated AE + BDR + Marketer |
| Tier 2 | tier_2 | 1:few industry campaigns    | Shared AE + targeted content |
| Tier 3 | tier_3 | 1:many programmatic ABM     | Automated sequences          |

## ICP Scoring Model Reference

| Signal                    | Points | Category      |
|---------------------------|--------|---------------|
| Industry match            | +20    | Firmographic  |
| Employee count in range   | +15    | Firmographic  |
| Revenue in target range   | +15    | Firmographic  |
| Tech stack overlap        | +10    | Technographic |
| Geographic fit            | +10    | Firmographic  |
| Growth signals (hiring)   | +10    | Intent        |
| Competitor customer       | -15    | Disqualifier  |

## Tweak Parameters

- **{{NUM_TIERS}}**: Number of ABM tiers (default: 3)
- **{{TIER_N_LABEL}}**: Display label for each tier (default: "Tier 1", "Tier 2", "Tier 3")
- **{{TIER_N_VALUE}}**: Internal value for each tier (default: "tier_1", "tier_2", "tier_3")
- **{{SCORING_MODEL}}**: ICP scoring approach — "firmographic", "technographic", "intent", or "combined" (default: combined)

## User Request

{{USER_REQUEST}}
