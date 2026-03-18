# Vero HubSpot Operator — Skill Architecture Map

## Complete Flow: Meeting Notes → HubSpot Execution

```
┌─────────────────────────────────────────────────────────────────────┐
│                        USER INTERACTION                             │
│                                                                     │
│   User pastes meeting notes, client requirements, or requests       │
│   a HubSpot configuration change in Claude Code chat                │
│                                                                     │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│              ┌─────────────────────────────────┐                    │
│              │   MASTER ORCHESTRATOR SKILL      │                    │
│              │   hubspot-master-orchestrator.md │                    │
│              │                                  │                    │
│              │   Routes requests to the right   │                    │
│              │   skill(s) based on intent.      │                    │
│              │   Manages multi-step execution.  │                    │
│              └────────────────┬─────────────────┘                    │
│                               │                                     │
│              ┌────────────────┼─────────────────┐                   │
│              │    INTENT DETECTION              │                   │
│              │                                  │                   │
│              │  Meeting notes? ──► Analysis      │                   │
│              │  "Create property" ──► Property   │                   │
│              │  "Build pipeline" ──► Pipeline    │                   │
│              │  "Set up workflow" ──► Workflow   │                   │
│              │  "Create segment" ──► List        │                   │
│              │  "Bulk update" ──► Bulk Script    │                   │
│              │  "Full CRM setup" ──► Template   │                   │
│              │  Complex request ──► Analysis     │                   │
│              │                       + Multiple  │                   │
│              └────────────────┬─────────────────┘                    │
│                               │                                     │
│                    CLAUDE CODE SKILLS LAYER                          │
│                                                                     │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
          ┌────────────────────┼────────────────────┐
          │                    │                    │
          ▼                    ▼                    ▼
┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
│  ANALYSIS SKILL  │ │  RESOURCE SKILLS │ │  BUNDLE SKILL    │
│                  │ │  (6 specialized) │ │                  │
│  Meeting Notes   │ │                  │ │  Template Drafts │
│  Analyst         │ │  ┌────────────┐  │ │                  │
│                  │ │  │ Properties │  │ │  Bundles multiple │
│  Extracts:       │ │  ├────────────┤  │ │  resources into  │
│  • Fields needed │ │  │ Pipelines  │  │ │  a reusable      │
│  • Processes     │ │  ├────────────┤  │ │  template spec   │
│  • Automations   │ │  │ Workflows  │  │ │                  │
│  • Segments      │ │  ├────────────┤  │ └────────┬─────────┘
│  • Data ops      │ │  │ Lists      │  │          │
│                  │ │  ├────────────┤  │          │
│  Produces:       │ │  │ Bulk Ops   │  │          │
│  • Structured    │ │  └────────────┘  │          │
│    plan          │ │                  │          │
│  • Execution     │ │  Each skill:     │          │
│    order         │ │  • Validates spec│          │
│  • Risk flags    │ │  • Pre-flight    │          │
│                  │ │    checklist     │          │
│  Chains to: ────►│ │  • Calls MCP tool│          │
│  Resource Skills │ │  • Troubleshoots │          │
│                  │ │                  │          │
└──────────────────┘ └────────┬─────────┘          │
                              │                    │
                    ┌─────────┴────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│                        MCP TOOL LAYER                                │
│                    (35 tools via mcp-server.ts)                      │
│                                                                     │
│   Draft Tools (Save specs locally):                                 │
│   ┌──────────────────┬──────────────────┬──────────────────┐        │
│   │ save_property_   │ save_pipeline_   │ save_workflow_   │        │
│   │ draft            │ draft            │ draft            │        │
│   ├──────────────────┼──────────────────┼──────────────────┤        │
│   │ save_list_       │ save_script_     │ save_template_   │        │
│   │ draft            │ draft            │ draft            │        │
│   └──────────────────┴──────────────────┴──────────────────┘        │
│                                                                     │
│   Direct API Tools (Immediate execution):                           │
│   ┌──────────────────┬──────────────────┬──────────────────┐        │
│   │ create_property  │ create_pipeline  │ deploy_workflow  │        │
│   │ update_property  │ list_pipelines   │ list_workflows   │        │
│   │ list_properties  │ audit_pipelines  │                  │        │
│   │ audit_properties │                  │                  │        │
│   ├──────────────────┼──────────────────┼──────────────────┤        │
│   │ create_list      │ search_records   │ create_record    │        │
│   │ list_lists       │ get_record       │ update_record    │        │
│   │                  │ batch_upsert     │                  │        │
│   ├──────────────────┼──────────────────┼──────────────────┤        │
│   │ create_          │ batch_create_    │ extract_portal_  │        │
│   │ association      │ associations     │ config           │        │
│   │                  │                  │ clone_portal     │        │
│   ├──────────────────┼──────────────────┼──────────────────┤        │
│   │ validate_config  │ execute_config   │ install_template │        │
│   │ activity_log     │ list_portals     │ portal_capabilit.│        │
│   └──────────────────┴──────────────────┴──────────────────┘        │
│                                                                     │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│                    VERO HUBSPOT OPERATOR APP                         │
│                    (Next.js + SQLite + OAuth)                        │
│                                                                     │
│   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐               │
│   │  Draft Store │  │  Auth Mgr   │  │  Safety &   │               │
│   │  (SQLite)    │  │  (OAuth 2.0)│  │  Governance │               │
│   │              │  │              │  │              │               │
│   │  Stores all  │  │  Manages    │  │  Sandbox-   │               │
│   │  draft specs │  │  portal     │  │  first,     │               │
│   │  by type     │  │  tokens,    │  │  dry-run    │               │
│   │              │  │  refresh,   │  │  enforcement│               │
│   │  artifacts   │  │  scopes     │  │              │               │
│   │  table       │  │              │  │  Audit log  │               │
│   └──────┬──────┘  └──────┬──────┘  └──────┬──────┘               │
│          │                │                │                        │
│   ┌──────┴────────────────┴────────────────┴──────┐                │
│   │                APP UI PAGES                    │                │
│   │                                                │                │
│   │  /properties  → Deploy property drafts         │                │
│   │  /pipelines   → Deploy pipeline drafts         │                │
│   │  /workflows   → Deploy workflow drafts         │                │
│   │  /lists       → Deploy list drafts             │                │
│   │  /bulk        → Register & execute scripts     │                │
│   │  /templates   → Install template bundles       │                │
│   │  /clone       → Clone portal configurations    │                │
│   │  /activity    → View audit log                 │                │
│   │  /deployments → Track deployment history       │                │
│   │  /settings    → Manage portals & connections   │                │
│   └──────────────────────┬─────────────────────────┘                │
│                          │                                          │
│            ┌─────────────┴─────────────┐                           │
│            │   API Route Handlers       │                           │
│            │   (Next.js API routes)     │                           │
│            │                            │                           │
│            │   /api/properties/*        │                           │
│            │   /api/pipelines/*         │                           │
│            │   /api/workflows/*         │                           │
│            │   /api/portals/*           │                           │
│            │   /api/scripts/*           │                           │
│            │   /api/templates/*         │                           │
│            │   /api/clone/*             │                           │
│            └─────────────┬──────────────┘                           │
│                          │                                          │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│                       HUBSPOT APIs                                   │
│                                                                     │
│   ┌─────────────────────────────────────────────────────────┐       │
│   │                    CRM v3 API                            │       │
│   │                                                          │       │
│   │  Properties:  POST/GET/PATCH /crm/v3/properties/{type}   │       │
│   │  Pipelines:   POST/GET/PATCH /crm/v3/pipelines/{type}    │       │
│   │  Objects:     POST/GET/PATCH /crm/v3/objects/{type}       │       │
│   │  Search:      POST /crm/v3/objects/{type}/search          │       │
│   │  Batch:       POST /crm/v3/objects/{type}/batch/*         │       │
│   │  Lists:       POST/GET /crm/v3/lists/                     │       │
│   │  Schemas:     POST /crm/v3/schemas  (custom objects)      │       │
│   └─────────────────────────────────────────────────────────┘       │
│                                                                     │
│   ┌─────────────────────────────────────────────────────────┐       │
│   │                  Associations v4 API                     │       │
│   │                                                          │       │
│   │  POST /crm/v4/associations/{from}/{to}/batch/create      │       │
│   │  POST /crm/v4/associations/{from}/{to}/batch/read        │       │
│   └─────────────────────────────────────────────────────────┘       │
│                                                                     │
│   ┌─────────────────────────────────────────────────────────┐       │
│   │                Automation v4 API (BETA)                   │       │
│   │                                                          │       │
│   │  POST /automation/v4/flows                                │       │
│   │  GET  /automation/v4/flows/{flowId}                       │       │
│   │  PUT  /automation/v4/flows/{flowId}                       │       │
│   └─────────────────────────────────────────────────────────┘       │
│                                                                     │
│   ┌─────────────────────────────────────────────────────────┐       │
│   │                     OAuth v1                              │       │
│   │                                                          │       │
│   │  POST /oauth/v1/token  (token refresh)                    │       │
│   │  GET  /oauth/v1/access-tokens/{token}                     │       │
│   └─────────────────────────────────────────────────────────┘       │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Skill Chaining Flow (Detailed)

```
Meeting Notes (pasted by user)
        │
        ▼
┌─ MEETING ANALYSIS SKILL ─────────────────────────────────────┐
│                                                               │
│  1. Extract business context, fields, processes, automations  │
│  2. Gap analysis + tier check + dependency resolution         │
│  3. Generate structured plan                                  │
│  4. Present to user for approval                              │
│                                                               │
└───────────────────────────┬───────────────────────────────────┘
                            │ User approves
                            ▼
┌─ MASTER ORCHESTRATOR ─────────────────────────────────────────┐
│                                                               │
│  Executes plan in dependency order:                           │
│                                                               │
│  Step 1 ──► PROPERTY SKILL                                    │
│             │  Validate type/fieldType matrix                 │
│             │  Pre-flight 17-rule checklist                   │
│             │  Call save_property_draft (batch)               │
│             ▼  → Deploy from /properties page                │
│                                                               │
│  Step 2 ──► PIPELINE SKILL                                    │
│             │  Validate Closed Won/Lost stages                │
│             │  Ensure probability on all deal stages          │
│             │  Pre-flight 14-rule checklist                   │
│             │  Call save_pipeline_draft                       │
│             ▼  → Deploy from /pipelines page                 │
│                                                               │
│  Step 3 ──► LIST SKILL                                        │
│             │  Validate filterBranch structure                │
│             │  Match operationType to property types          │
│             │  Pre-flight 14-rule checklist                   │
│             │  Call save_list_draft                           │
│             ▼  → Deploy from /lists page                     │
│                                                               │
│  Step 4 ──► WORKFLOW SKILL                                    │
│             │  Validate action type IDs (numeric 0-X)        │
│             │  Ensure CONTACT_FLOW vs PLATFORM_FLOW          │
│             │  Pre-flight 12-rule checklist                   │
│             │  Call save_workflow_draft                       │
│             ▼  → Deploy from /workflows page                 │
│                                                               │
│  Step 5 ──► BULK SCRIPT SKILL                                 │
│             │  Generate Node.js script with dry-run           │
│             │  Include retry, JSONL logging, pagination       │
│             │  Pre-flight 10-rule checklist                   │
│             │  Call save_script_draft                         │
│             ▼  → Register & execute from /bulk page          │
│                                                               │
│  Step 6 ──► TEMPLATE SKILL (optional)                         │
│  (bundle)   │  Bundle all resources into template spec       │
│             │  Resolve dependency order                       │
│             │  Pre-flight 13-rule checklist                   │
│             │  Call save_template_draft                       │
│             ▼  → Install from /templates page                │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

---

## Data Flow: Draft → Deploy → HubSpot

```
Claude Code Skill
    │
    │ Generates spec (JSON)
    │ Calls save_*_draft MCP tool
    │
    ▼
MCP Server (mcp-server.ts)
    │
    │ Validates spec
    │ Calls draft-store.saveDraft()
    │
    ▼
SQLite Database (data/vero.db)
    │
    │ Stores in 'artifacts' table
    │ { id, portalId, type, name, spec, createdAt }
    │
    ▼
App UI (Next.js pages)
    │
    │ User clicks "Deploy" on the relevant page
    │ App reads draft from SQLite
    │ App calls the appropriate manager
    │
    ▼
Manager Layer (lib/*.ts)
    │
    │ property-manager.ts  → POST /crm/v3/properties/{type}
    │ pipeline-manager.ts  → POST /crm/v3/pipelines/{type}
    │ workflow-engine.ts   → POST /automation/v4/flows
    │ list-manager.ts      → POST /crm/v3/lists/
    │ script-engine.ts     → Executes Node.js script
    │ template-store.ts    → Dependency-resolved multi-resource install
    │
    ▼
HubSpot API
    │
    │ Creates/updates resources
    │ Returns IDs, status, errors
    │
    ▼
Activity Log (SQLite)
    │
    │ Records what was deployed, when, by whom
    │ Enables audit trail and rollback tracking
```

---

## Constraint Validation Layer

```
                    hubspot_constraints/
                    ├── property_types.json      ← Type/FieldType matrix
                    ├── pipeline_schema.json     ← Stage rules, probability
                    ├── workflow_actions.json    ← Action IDs, deprecated names
                    ├── list_filters.json        ← FilterBranch structure, operators
                    ├── custom_objects_schema.json ← Enterprise, immutability
                    ├── associations_schema.json ← Batch limits, categories
                    ├── api_reference.json       ← Rate limits, error codes
                    └── REFERENCE.yaml           ← Master reference (all modules)

Every skill validates against these constraints BEFORE calling MCP tools.
This is the "pre-flight checklist" that prevents 400/409 errors.
```
