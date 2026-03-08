# Vero HubSpot Operator

Foundation aligned with `00-README.md` build order.
Implemented so far: `01-auth-manager.md` through `13-safety-rules.md`.

## Modules Complete
- `01` Auth Manager
- `02` HubSpot API Client
- `03` MCP Connector
- `04` Orchestrator
- `05` Change Logger
- `06` Workflow Engine
- `07` Property Manager
- `08` List & Segment Manager
- `09` Pipeline Manager
- `10` Script Engine
- `11` Portal Configuration Store
- `12` Prompt Library
- `13` Safety & Governance Rules

## 12 — Prompt Library
- Prompt catalog with categories/tags/parameters in `lib/prompt-library.ts`
- Supports list/get/search/add/resolve/execute
- File-backed custom prompt persistence in `prompts/prompts.json`
- Portal config placeholder resolution (`{forms.demoRequest}`, etc.)
- API endpoints:
  - `GET/POST /api/prompts`
  - `GET /api/prompts/{id}`
  - `POST /api/prompts/resolve`
  - `POST /api/prompts/execute`

## 13 — Safety & Governance Rules
- Centralized governance helpers in `lib/safety-governance.ts`
- Sandbox-first policy enforced for write paths (first production session blocks writes)
- Delete operations require explicit target ID and exact confirmation text
- Prompt redaction for LLM requests and change logs (tokens/emails/phones)
- Scope checks unified through module/layer maps
- Script engine hardening:
  - Dry-run required before execute
  - Script + run logs versioned in `artifacts/{portalId}/scripts/`
- Workflow engine hardening:
  - `isEnabled: false` enforced
  - Write governance and scope checks before deploy/update/delete
  - Generated specs versioned in `artifacts/{portalId}/workflows/`

## APIs
- Portal/Auth:
  - `GET/POST /api/portals`
  - `GET/POST /api/portals/active`
  - `DELETE /api/portals/{portalId}`
  - `POST /api/portals/{portalId}/validate`
- Portal Config:
  - `GET /api/portal-config`
  - `POST /api/portal-config`
  - `GET /api/portal-config/{portalId}`
  - `PATCH /api/portal-config/{portalId}`
  - `POST /api/portal-config/discover`
- MCP:
  - `GET /api/mcp/tools`
  - `POST /api/mcp/call`
  - `POST /api/mcp/execute`
- Orchestrator:
  - `POST /api/orchestrator/process`
  - `POST /api/orchestrator/confirm`
  - `POST /api/orchestrator/cancel`
- Prompts:
  - `GET/POST /api/prompts`
  - `GET /api/prompts/{id}`
  - `POST /api/prompts/resolve`
  - `POST /api/prompts/execute`
- Logs:
  - `GET /api/logs`
  - `GET /api/logs/summary`
  - `POST /api/logs/export`
- Workflows:
  - `GET /api/workflows`
  - `POST /api/workflows/generate`
  - `POST /api/workflows/validate`
  - `POST /api/workflows/preview`
  - `POST /api/workflows/deploy`
  - `GET /api/workflows/{flowId}`
  - `PUT /api/workflows/{flowId}`
  - `DELETE /api/workflows/{flowId}`
- Properties:
  - `GET /api/properties?objectType=contacts`
  - `POST /api/properties`
  - `PATCH /api/properties/{objectType}/{name}`
  - `DELETE /api/properties/{objectType}/{name}`
  - `GET /api/properties/audit?objectType=contacts`
- Lists:
  - `GET /api/lists`
  - `POST /api/lists`
  - `GET /api/lists/{listId}`
  - `PUT /api/lists/{listId}`
  - `DELETE /api/lists/{listId}`
  - `PUT /api/lists/{listId}/memberships/add`
  - `PUT /api/lists/{listId}/memberships/remove`
  - `GET /api/lists/audit`
- Pipelines:
  - `GET /api/pipelines?objectType=deals|tickets`
  - `POST /api/pipelines`
  - `GET /api/pipelines/{objectType}/{pipelineId}`
  - `PATCH /api/pipelines/{objectType}/{pipelineId}`
  - `DELETE /api/pipelines/{objectType}/{pipelineId}`
  - `GET /api/pipelines/{objectType}/{pipelineId}/stages`
  - `POST /api/pipelines/{objectType}/{pipelineId}/stages`
  - `PATCH /api/pipelines/{objectType}/{pipelineId}/stages/{stageId}`
  - `GET /api/pipelines/audit?objectType=deals|tickets`
- Scripts:
  - `POST /api/scripts/generate`
  - `POST /api/scripts/preview`
  - `POST /api/scripts/execute`
  - `GET /api/scripts/{scriptId}/log`

## Deployment
- Render free deployment with acceptable cold starts
- See [deployment-render.md](/Users/pietro/Documents/Vero HubSpot Operator/docs/deployment-render.md)
