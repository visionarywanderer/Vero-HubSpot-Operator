# Professional Services Deal Pipeline

## Purpose
Generate a deal pipeline designed for professional services and consulting firms, with stages reflecting the scoping and statement-of-work process.

## Instructions

You are a HubSpot sales operations architect specializing in professional services firms.
Generate a deal pipeline configuration with stages that reflect the typical services sales cycle: from initial inquiry through needs assessment, scoping, SOW delivery, and engagement kickoff.
Output only valid JSON. No explanations.

## Constraints

- Pipeline objectType must be "deals"
- Each stage must have a label and displayOrder (integer, starting at 0)
- Each stage should include metadata with probability as a string decimal (e.g., "0.2")
- Stages are installed in displayOrder sequence
- Include both Closed Won and Closed Lost as terminal stages
- Probability for Closed Won must be "1.0" and Closed Lost must be "0.0"
- Pipeline label is required and should be descriptive

## Output Format

```json
{
  "id": "services-deal-pipeline",
  "name": "Professional Services Pipeline",
  "version": "1.0.0",
  "description": "SOW-driven professional services pipeline for {{INDUSTRY}} engagements",
  "tags": ["pipeline", "deals", "services", "{{INDUSTRY}}"],
  "resources": {
    "pipelines": [
      {
        "label": "{{PIPELINE_NAME}}",
        "objectType": "deals",
        "displayOrder": 0,
        "stages": [
          {
            "label": "{{STAGE_1_NAME}}",
            "displayOrder": 0,
            "metadata": { "probability": "0.05" }
          },
          {
            "label": "{{STAGE_2_NAME}}",
            "displayOrder": 1,
            "metadata": { "probability": "0.15" }
          },
          {
            "label": "{{STAGE_3_NAME}}",
            "displayOrder": 2,
            "metadata": { "probability": "0.30" }
          },
          {
            "label": "{{STAGE_4_NAME}}",
            "displayOrder": 3,
            "metadata": { "probability": "0.55" }
          },
          {
            "label": "{{STAGE_5_NAME}}",
            "displayOrder": 4,
            "metadata": { "probability": "0.75" }
          },
          {
            "label": "{{STAGE_6_NAME}}",
            "displayOrder": 5,
            "metadata": { "probability": "0.90" }
          },
          {
            "label": "Closed Won",
            "displayOrder": 6,
            "metadata": { "probability": "1.0" }
          },
          {
            "label": "Closed Lost",
            "displayOrder": 7,
            "metadata": { "probability": "0.0" }
          }
        ]
      }
    ]
  }
}
```

## Default Stage Configuration

| Stage               | Probability | Description                                          |
|---------------------|-------------|------------------------------------------------------|
| Inquiry             | 0.05        | Inbound inquiry or referral received                 |
| Needs Assessment    | 0.15        | Discovery call to understand business requirements   |
| Scoping             | 0.30        | Defining project scope, deliverables, and timeline   |
| SOW Sent            | 0.55        | Statement of Work delivered for client review        |
| Negotiation         | 0.75        | Negotiating terms, pricing, or scope adjustments     |
| Engagement Started  | 0.90        | SOW signed, project kickoff initiated                |
| Closed Won          | 1.00        | Engagement completed or fully contracted             |
| Closed Lost         | 0.00        | Opportunity lost or client chose another provider    |

## Industry-Specific Variations

### Management Consulting
Replace "Scoping" with "Diagnostic Assessment", "SOW Sent" with "Proposal Presented"

### IT Services
Replace "Scoping" with "Technical Assessment", "SOW Sent" with "Architecture Review & Proposal"

### Marketing Agency
Replace "Scoping" with "Strategy Workshop", "SOW Sent" with "Campaign Plan Delivered"

### Legal Services
Replace "Inquiry" with "Intake", "Scoping" with "Matter Assessment", "SOW Sent" with "Engagement Letter Sent"

## Tweak Parameters

- **{{PIPELINE_NAME}}**: Name of the pipeline (default: "Professional Services Pipeline")
- **{{INDUSTRY}}**: Target industry for stage name customization (default: "consulting")
- **{{STAGE_N_NAME}}**: Custom name for each stage — see industry variations above

## User Request

{{USER_REQUEST}}
