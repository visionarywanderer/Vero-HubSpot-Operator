# SaaS Deal Pipeline

## Purpose
Generate a deal pipeline optimized for SaaS sales cycles, with demo-driven stages and probability metadata at each stage.

## Instructions

You are a HubSpot sales operations architect specializing in SaaS go-to-market.
Generate a deal pipeline configuration with stages that reflect the typical SaaS buyer journey from initial discovery through demo, proposal, and close.
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
  "id": "saas-deal-pipeline",
  "name": "SaaS Sales Pipeline",
  "version": "1.0.0",
  "description": "Demo-driven SaaS sales pipeline with {{NUM_STAGES}} stages and probability weighting",
  "tags": ["pipeline", "deals", "saas"],
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
            "metadata": { "probability": "{{STAGE_1_PROBABILITY}}" }
          },
          {
            "label": "{{STAGE_2_NAME}}",
            "displayOrder": 1,
            "metadata": { "probability": "{{STAGE_2_PROBABILITY}}" }
          },
          {
            "label": "{{STAGE_3_NAME}}",
            "displayOrder": 2,
            "metadata": { "probability": "{{STAGE_3_PROBABILITY}}" }
          },
          {
            "label": "{{STAGE_4_NAME}}",
            "displayOrder": 3,
            "metadata": { "probability": "{{STAGE_4_PROBABILITY}}" }
          },
          {
            "label": "{{STAGE_5_NAME}}",
            "displayOrder": 4,
            "metadata": { "probability": "{{STAGE_5_PROBABILITY}}" }
          },
          {
            "label": "{{STAGE_6_NAME}}",
            "displayOrder": 5,
            "metadata": { "probability": "{{STAGE_6_PROBABILITY}}" }
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

| Stage              | Probability | Description                                  |
|--------------------|-------------|----------------------------------------------|
| Discovery          | 0.10        | Initial qualification and needs discovery    |
| Demo Scheduled     | 0.20        | Demo meeting booked with decision maker      |
| Demo Complete      | 0.40        | Demo delivered, evaluating fit                |
| Proposal           | 0.60        | Pricing and proposal sent to prospect        |
| Negotiation        | 0.75        | Active negotiation on terms and pricing      |
| Contract Sent      | 0.90        | Final contract sent for signature            |
| Closed Won         | 1.00        | Deal signed and won                          |
| Closed Lost        | 0.00        | Deal lost or prospect disqualified           |

## Tweak Parameters

- **{{PIPELINE_NAME}}**: Name of the pipeline (default: "SaaS Sales Pipeline")
- **{{NUM_STAGES}}**: Total number of stages including Closed Won/Lost (default: 8)
- **{{STAGE_N_NAME}}**: Custom name for each stage
- **{{STAGE_N_PROBABILITY}}**: Win probability at each stage (decimal 0.0–1.0)

## User Request

{{USER_REQUEST}}
