# 04 — Orchestrator (LLM Router)

## Purpose
The brain of the app. Receives user prompts, determines intent, decides which execution layer handles it, executes the operation, and returns results. Uses Claude as the reasoning engine.

## Priority: P0 | Dependencies: 01, 02, 03

---

## Architecture

```
User Prompt
    │
    ▼
┌─────────────────────────┐
│  INTENT CLASSIFIER      │
│  (LLM determines what   │
│   the user wants)       │
└────────┬────────────────┘
         │
    ┌────┴────┐
    ▼         ▼
┌───────┐ ┌───────────┐
│ SIMPLE│ │ COMPLEX   │
│ (one  │ │ (multi-   │
│  step)│ │  step)    │
└───┬───┘ └─────┬─────┘
    │           │
    ▼           ▼
┌─────────────────────────┐
│  ROUTER                 │
│  Selects execution layer│
│  MCP / API / Script     │
└────────┬────────────────┘
         │
    ┌────┼────┐
    ▼    ▼    ▼
   MCP  API  Script
```

---

## LLM Configuration

### Model
Use `claude-sonnet-4-20250514` via Anthropic API for routing decisions and spec generation. Use `claude-opus-4-20250514` for complex workflow generation if needed.

### System Prompt (for the orchestrator LLM call)

```
You are the Vero HubSpot Operator. You help manage HubSpot portals.

You have three execution layers available:

1. MCP LAYER — For CRM operations (read, create, update, delete records, tasks, notes, associations)
   Route here when: user asks about contacts, companies, deals, tickets, or wants to create/update records, tasks, notes, or associations.

2. API LAYER — For portal configuration (workflows, properties, lists, pipelines)
   Route here when: user wants to create/modify workflows, create/manage properties, create lists/segments, or configure pipelines.

3. SCRIPT LAYER — For bulk operations (50+ records) and data transformations
   Route here when: user wants to update many records at once, import/export data, or perform complex data transformations.

CURRENT PORTAL SCOPES: {scopes from AuthManager}

For each user request, respond with a JSON plan:
{
  "intent": "description of what user wants",
  "layer": "mcp" | "api" | "script",
  "module": "module code (A1-A7, B1-B5, C1-C5, D1-D3, E1-E2, F1-F6)",
  "steps": [
    { "action": "description", "tool": "specific tool or endpoint" }
  ],
  "requiresConfirmation": true/false,
  "risk": "none" | "low" | "medium" | "high"
}

SAFETY RULES:
- Any write operation on production requires confirmation
- Any bulk operation (50+ records) routes to Script Layer with dry-run
- Any workflow deployment sets isEnabled: false
- Any delete operation is high-risk and requires explicit confirmation
- Check scopes before routing — if scope missing, tell user what they need
```

---

## Routing Logic (Detailed)

### Route to MCP Layer

| Trigger Keywords | Module |
|-----------------|--------|
| find, search, get, show, list + contacts/companies/deals/tickets | A1 (Read) |
| create, add, new + contact/company/deal/ticket | A2 (Create) |
| update, change, set, fix + any CRM property | A3 (Update) |
| create task, add task, follow-up, reminder | A4 (Tasks) |
| add note, note on, log note | A5 (Notes) |
| associate, link, connect + two objects | A6 (Associations) |
| delete, remove + CRM record | A7 (Delete) |

### Route to API Layer

| Trigger Keywords | Module |
|-----------------|--------|
| create workflow, build workflow, automation | B1-B2 (Workflow) |
| get workflow, list workflow, show workflow | B3 (Read Workflow) |
| update workflow, modify workflow, change workflow | B4 (Update Workflow) |
| create property, add property, new field | C2 (Create Property) |
| list properties, show properties, audit properties | C1/C5 (Property Audit) |
| create list, create segment, smart list | D1-D2 (Lists) |
| pipeline, stages, create pipeline | E1-E2 (Pipelines) |

### Route to Script Layer

| Trigger Keywords | Module |
|-----------------|--------|
| bulk, all contacts, standardize all, clean up all | F1-F4 |
| import, CSV, upload file | F5 (Import) |
| export, download, extract to file | F6 (Export) |
| "5000 contacts", "all 3000 deals", any large number | F1-F4 |

### Ambiguity Resolution

If the intent is ambiguous, ask the user ONE clarifying question:

```
User: "Fix the contacts"
→ Ambiguous. Ask: "What specifically needs fixing? For example:
   - Standardize names (capitalize, trim whitespace)
   - Fix missing emails
   - Fix missing company associations
   - Update lifecycle stages"
```

---

## Multi-Step Operations

Complex operations require multiple steps across layers. The orchestrator chains them:

### Example: "Audit the portal and create tasks for issues found"

```json
{
  "intent": "Full portal audit with follow-up tasks",
  "steps": [
    { "layer": "mcp", "module": "A1", "action": "Search contacts missing email" },
    { "layer": "mcp", "module": "A1", "action": "Search deals in open stage > 30 days" },
    { "layer": "mcp", "module": "A1", "action": "Search contacts without company association" },
    { "layer": "mcp", "module": "A1", "action": "Analyze results and identify top issues" },
    { "layer": "mcp", "module": "A4", "action": "Create tasks for record owners to fix issues" }
  ]
}
```

### Example: "Create a lead routing workflow"

```json
{
  "intent": "Create and deploy lead routing workflow",
  "steps": [
    { "layer": "api", "module": "B1", "action": "Generate v4 workflow JSON spec from prompt" },
    { "layer": "human", "action": "Display spec for human review" },
    { "layer": "api", "module": "B2", "action": "POST /automation/v4/flows with approved spec" },
    { "layer": "api", "module": "B3", "action": "GET created workflow to verify" }
  ]
}
```

---

## Confirmation Flow

```
1. Orchestrator determines operation and risk level
2. If risk > none:
   a. Display what will happen (affected records, changes)
   b. Wait for user confirmation ("yes" / "confirm" / "proceed")
   c. Only then execute
3. If risk = high (delete, bulk write on production):
   a. Display explicit warning
   b. Require typing the exact record/workflow ID to confirm
```

---

## Exports

```typescript
interface Orchestrator {
  processPrompt(prompt: string): Promise<OrchestratorResult>;
  confirmAndExecute(planId: string): Promise<ExecutionResult>;
  cancelPlan(planId: string): void;
}

interface OrchestratorResult {
  planId: string;
  intent: string;
  layer: 'mcp' | 'api' | 'script';
  steps: Step[];
  requiresConfirmation: boolean;
  risk: 'none' | 'low' | 'medium' | 'high';
  preview?: string; // human-readable preview of what will happen
}
```
