# 09 — Pipeline Manager

## Purpose
Create, read, and configure HubSpot pipelines and their stages for deals and tickets.

## Priority: P1 | Dependencies: 02-api-client, 04-orchestrator, 05-change-logger

---

## API

**Base**: `/crm/v3/pipelines/{objectType}`
**Scopes**: `crm.objects.deals.read`, `crm.objects.deals.write` (for deal pipelines)

| Method | Endpoint | Action |
|--------|----------|--------|
| GET | `/crm/v3/pipelines/{objectType}` | List all pipelines |
| POST | `/crm/v3/pipelines/{objectType}` | Create pipeline |
| GET | `/crm/v3/pipelines/{objectType}/{pipelineId}` | Get pipeline |
| PATCH | `/crm/v3/pipelines/{objectType}/{pipelineId}` | Update pipeline |
| DELETE | `/crm/v3/pipelines/{objectType}/{pipelineId}` | Delete pipeline |
| GET | `/crm/v3/pipelines/{objectType}/{pipelineId}/stages` | List stages |
| POST | `/crm/v3/pipelines/{objectType}/{pipelineId}/stages` | Create stage |
| PATCH | `/crm/v3/pipelines/{objectType}/{pipelineId}/stages/{stageId}` | Update stage |

**objectType values**: `deals` or `tickets`

---

## Create Pipeline Payload

**Prompt**: "Create a Partner Channel pipeline with 6 stages"

```json
{
  "label": "Partner Channel",
  "displayOrder": 1,
  "stages": [
    { "label": "Lead Received", "displayOrder": 0, "metadata": { "probability": "0.2" } },
    { "label": "Qualified", "displayOrder": 1, "metadata": { "probability": "0.4" } },
    { "label": "Proposal Sent", "displayOrder": 2, "metadata": { "probability": "0.6" } },
    { "label": "Negotiation", "displayOrder": 3, "metadata": { "probability": "0.8" } },
    { "label": "Closed Won", "displayOrder": 4, "metadata": { "probability": "1.0", "isClosed": "true", "closedWon": "true" } },
    { "label": "Closed Lost", "displayOrder": 5, "metadata": { "probability": "0.0", "isClosed": "true", "closedWon": "false" } }
  ]
}
```

## Pipeline Audit Function

```typescript
async function auditPipelines(objectType: string): Promise<PipelineAudit> {
  const pipelines = await apiClient.pipelines.list(objectType);
  
  return pipelines.map(pipeline => {
    const issues = [];
    if (pipeline.stages.length > 8) issues.push('Too many stages (>8) — simplify');
    if (pipeline.stages.length < 3) issues.push('Too few stages (<3) — might need more granularity');
    
    const hasWon = pipeline.stages.some(s => s.metadata?.closedWon === 'true');
    const hasLost = pipeline.stages.some(s => s.metadata?.closedWon === 'false' && s.metadata?.isClosed === 'true');
    if (!hasWon) issues.push('Missing Closed Won stage');
    if (!hasLost) issues.push('Missing Closed Lost stage');
    
    return { pipeline: pipeline.label, stageCount: pipeline.stages.length, issues };
  });
}
```

## Exports

```typescript
interface PipelineManager {
  list(objectType: 'deals' | 'tickets'): Promise<Pipeline[]>;
  create(objectType: 'deals' | 'tickets', spec: PipelineSpec): Promise<Pipeline>;
  get(objectType: string, pipelineId: string): Promise<Pipeline>;
  update(objectType: string, pipelineId: string, updates: Partial<PipelineSpec>): Promise<Pipeline>;
  addStage(objectType: string, pipelineId: string, stage: StageSpec): Promise<Stage>;
  audit(objectType: 'deals' | 'tickets'): Promise<PipelineAudit[]>;
}
```
