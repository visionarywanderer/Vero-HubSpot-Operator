# Vero HubSpot Operator — Developer Specification

## Overview

A unified app that lets Vero Digital perform every HubSpot portal operation from one interface. It routes each request to the right execution layer — MCP for CRM operations, HubSpot APIs for workflows/properties/lists, and generated scripts for bulk operations.

## Architecture

```
┌─────────────────────────────────────────────┐
│  USER INTERFACE (Chat / CLI / Dashboard)    │
└──────────────────────┬──────────────────────┘
                       │
            ┌──────────┴────────────┐
            │  ORCHESTRATOR (LLM)   │
            │  - Understands intent │
            │  - Routes to layer    │
            │  - Generates specs    │
            └───┬───────┬───────┬───┘
                │       │       │
         ┌──────┴──┐ ┌──┴─────┐ ┌┴──────────┐
         │MCP Layer│ │API Layer│ │Script Layer│
         └─────────┘ └────────┘ └────────────┘
         CRM R/W     Workflows   Bulk Ops
         Tasks       Properties  Data Transforms
         Notes       Lists       Imports/Exports
         Assocs      Pipelines   Enrichment
```

## Spec Files — Build Order

| # | File | Component | Priority | Dependencies |
|---|------|-----------|----------|--------------|
| 01 | `01-auth-deployment-costs.md` | Auth (OAuth) + Deployment + Cost Optimization | P0 | None |
| 02 | `02-api-client.md` | HubSpot API Client (rate limiting, retries) | P0 | 01 |
| 03 | `03-mcp-connector.md` | MCP Layer — CRM Operations | P0 | 01 |
| 04 | `04-orchestrator.md` | LLM Router — Intent Detection & Routing | P0 | 01, 02, 03 |
| 05 | `05-change-logger.md` | Change Logger — Audit Trail | P0 | None |
| 06 | `06-workflow-engine.md` | Workflow Generator & Deployer (Automation v4) | P1 | 02, 04, 05 |
| 07 | `07-property-manager.md` | Property CRUD (Properties v3) | P1 | 02, 04, 05 |
| 08 | `08-list-manager.md` | Lists & Segments (Lists v3) | P1 | 02, 04, 05 |
| 09 | `09-pipeline-manager.md` | Pipeline Configuration (Pipelines v3) | P1 | 02, 04, 05 |
| 10 | `10-script-engine.md` | Script Generator & Runner (Bulk Ops) | P1 | 02, 04, 05 |
| 11 | `11-portal-config.md` | Per-Client Portal Configuration | P2 | 01 |
| 12 | `12-prompt-library.md` | Pre-Built Prompt Library | P2 | 04 |
| 13 | `13-safety-rules.md` | Safety & Governance (enforced in all modules) | P0 | None |
| 15 | `15-frontend-dashboard.md` | Frontend Dashboard (Next.js, full UI) | P2 | All (01–13) |
| 16 | `16-production-readiness.md` | Production Readiness: Fix & Finish List | P0 | All (01–15) |

## Implementation Phases

### Phase 1 — Foundation (Week 1–2)
Build specs: 01, 02, 03, 05, 13

### Phase 2 — Orchestrator (Week 3–4)
Build specs: 04

### Phase 3 — Workflow Engine (Week 5–7)
Build specs: 06

### Phase 4 — Portal Config (Week 7–8)
Build specs: 07, 08, 09

### Phase 5 — Script Engine (Week 9–11)
Build specs: 10

### Phase 6 — Frontend Dashboard (Week 12–16)
Build spec: 15 (full web UI: login, sidebar, chat, portals, audits, workflows, properties, lists, pipelines, bulk ops, activity log, settings)

## Tech Stack

- **Runtime**: Node.js 20+ (TypeScript recommended)
- **LLM**: Claude API (claude-sonnet-4-20250514) via Anthropic SDK
- **MCP**: Official HubSpot MCP server (mcp.hubspot.com) + optional PeakMojo for vector search
- **HTTP Client**: axios or native fetch with retry logic
- **Script Sandbox**: Docker containers or Node.js child_process with timeout
- **Storage**: SQLite or JSON files for change logs and portal configs
- **UI**: CLI first (commander.js), web dashboard later (React/Next.js)

## HubSpot Requirements

- **Subscription**: Professional or Enterprise (any Hub) per client portal
- **Auth**: One Private App per client portal with scopes defined in `01-auth-manager.md`
- **Sandbox**: Required for initial testing of all write operations
