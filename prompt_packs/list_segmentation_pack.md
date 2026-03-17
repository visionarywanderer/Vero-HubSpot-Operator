# List Segmentation Pack

## Purpose
Generate a set of marketing and sales segmentation lists in HubSpot for lifecycle-based, engagement-based, and value-based audience targeting.

## Instructions

You are a HubSpot marketing operations architect.
Generate a collection of dynamic and manual lists that segment contacts and companies for targeted marketing, sales prioritization, and reporting.
Output only valid JSON. No explanations.

## Constraints

- List processingType must be "DYNAMIC" or "MANUAL"
- objectTypeId values: "0-1" (contacts), "0-2" (companies), "0-3" (deals), "0-5" (tickets)
- Dynamic lists use filter criteria; manual lists are populated by workflows or manual adds
- List names should be descriptive and follow a consistent naming convention
- Filter operators: EQ, NEQ, HAS_PROPERTY, NOT_HAS_PROPERTY, GT, GTE, LT, LTE, BETWEEN, IN, NOT_IN, CONTAINS, NOT_CONTAINS

## Output Format

```json
{
  "id": "segmentation-list-pack",
  "name": "Marketing Segmentation Lists",
  "version": "1.0.0",
  "description": "Core segmentation lists for lifecycle management, engagement tracking, and value-based targeting",
  "tags": ["lists", "segmentation", "marketing"],
  "resources": {
    "lists": [
      {
        "name": "MQLs — Marketing Qualified Leads",
        "objectTypeId": "0-1",
        "processingType": "DYNAMIC",
        "filterCriteria": {
          "filterGroups": [
            {
              "filters": [
                {
                  "propertyName": "lifecyclestage",
                  "operator": "EQ",
                  "value": "marketingqualifiedlead"
                }
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
                {
                  "propertyName": "lifecyclestage",
                  "operator": "EQ",
                  "value": "salesqualifiedlead"
                }
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
                {
                  "propertyName": "lifecyclestage",
                  "operator": "EQ",
                  "value": "customer"
                }
              ]
            }
          ]
        }
      },
      {
        "name": "Churned Customers",
        "objectTypeId": "0-1",
        "processingType": "DYNAMIC",
        "filterCriteria": {
          "filterGroups": [
            {
              "filters": [
                {
                  "propertyName": "lifecyclestage",
                  "operator": "EQ",
                  "value": "{{CHURNED_STAGE}}"
                }
              ]
            }
          ]
        }
      },
      {
        "name": "High-Value Prospects",
        "objectTypeId": "0-1",
        "processingType": "DYNAMIC",
        "filterCriteria": {
          "filterGroups": [
            {
              "filters": [
                {
                  "propertyName": "lead_score",
                  "operator": "GTE",
                  "value": "{{HIGH_VALUE_SCORE_THRESHOLD}}"
                },
                {
                  "propertyName": "lifecyclestage",
                  "operator": "IN",
                  "value": "lead;marketingqualifiedlead;salesqualifiedlead"
                }
              ]
            }
          ]
        }
      },
      {
        "name": "Engaged Last {{ENGAGED_DAYS}} Days",
        "objectTypeId": "0-1",
        "processingType": "DYNAMIC",
        "filterCriteria": {
          "filterGroups": [
            {
              "filters": [
                {
                  "propertyName": "hs_last_activity_date",
                  "operator": "UPDATED_IN_LAST_X_DAYS",
                  "value": "{{ENGAGED_DAYS}}"
                }
              ]
            }
          ]
        }
      },
      {
        "name": "No Activity {{INACTIVE_DAYS}}+ Days",
        "objectTypeId": "0-1",
        "processingType": "DYNAMIC",
        "filterCriteria": {
          "filterGroups": [
            {
              "filters": [
                {
                  "propertyName": "hs_last_activity_date",
                  "operator": "NOT_UPDATED_IN_LAST_X_DAYS",
                  "value": "{{INACTIVE_DAYS}}"
                }
              ]
            }
          ]
        }
      },
      {
        "name": "Newsletter Subscribers",
        "objectTypeId": "0-1",
        "processingType": "DYNAMIC",
        "filterCriteria": {
          "filterGroups": [
            {
              "filters": [
                {
                  "propertyName": "hs_email_optout",
                  "operator": "NEQ",
                  "value": "true"
                },
                {
                  "propertyName": "email",
                  "operator": "HAS_PROPERTY"
                }
              ]
            }
          ]
        }
      },
      {
        "name": "Unworked Leads",
        "objectTypeId": "0-1",
        "processingType": "DYNAMIC",
        "filterCriteria": {
          "filterGroups": [
            {
              "filters": [
                {
                  "propertyName": "lifecyclestage",
                  "operator": "EQ",
                  "value": "lead"
                },
                {
                  "propertyName": "hubspot_owner_id",
                  "operator": "NOT_HAS_PROPERTY"
                }
              ]
            }
          ]
        }
      },
      {
        "name": "Inactive — Marked for Suppression",
        "objectTypeId": "0-1",
        "processingType": "MANUAL"
      }
    ]
  }
}
```

## Default Segment Definitions

| Segment                 | Type    | Key Criteria                                  |
|-------------------------|---------|-----------------------------------------------|
| MQLs                    | Dynamic | lifecyclestage = marketingqualifiedlead       |
| SQLs                    | Dynamic | lifecyclestage = salesqualifiedlead           |
| Active Customers        | Dynamic | lifecyclestage = customer                     |
| Churned Customers       | Dynamic | lifecyclestage = churned / other              |
| High-Value Prospects    | Dynamic | lead_score >= threshold + prospect stage      |
| Engaged Last N Days     | Dynamic | last activity within N days                   |
| No Activity N+ Days     | Dynamic | last activity older than N days               |
| Newsletter Subscribers  | Dynamic | has email + not opted out                     |
| Unworked Leads          | Dynamic | lead stage + no owner assigned                |
| Suppression List        | Manual  | Populated by workflows or manual curation     |

## Tweak Parameters

- **{{ENGAGED_DAYS}}**: Days of recent activity for "engaged" list (default: 30)
- **{{INACTIVE_DAYS}}**: Days of no activity for "inactive" list (default: 90)
- **{{HIGH_VALUE_SCORE_THRESHOLD}}**: Minimum lead score for high-value list (default: 70)
- **{{CHURNED_STAGE}}**: Lifecycle stage value for churned contacts (default: "other")
- **{{CUSTOM_SEGMENTS}}**: Additional custom segments to generate

## User Request

{{USER_REQUEST}}
