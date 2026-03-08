# 03 — MCP Connector (CRM Operations Layer)

## Purpose
Connect to the official HubSpot MCP server for natural-language CRM operations. This is the primary interface for all read/write CRM operations, task creation, notes, and association management.

## Priority: P0 | Dependencies: 01-auth-manager

---

## Overview

The MCP Layer is the most capable layer for day-to-day CRM work. The official HubSpot MCP server supports:

| Operation | Supported | Notes |
|-----------|-----------|-------|
| Read any CRM object | ✅ | Contacts, companies, deals, tickets, products, invoices, quotes, etc. |
| Create CRM records | ✅ | With deduplication awareness |
| Update CRM records | ✅ | Any property on any object |
| Create tasks | ✅ | Assigned to owners, with due dates |
| Create notes | ✅ | Attached to any record |
| Read associations | ✅ | Between any objects |
| Create associations | ✅ | Link records together |
| Delete records | ✅ | With write+delete scopes |
| Read properties | ✅ | List properties and their types |
| Open HubSpot UI screens | ✅ | Deep link to specific records |
| Create/modify workflows | ❌ | Not exposed — use API Layer |
| Create lists/segments | ❌ | Not exposed — use API Layer |
| Create properties | ❌ | Not exposed — use API Layer |
| Manage pipelines | ❌ | Not exposed — use API Layer |

---

## Connection Methods

### Method 1: Official Remote MCP Server (Recommended)

**Endpoint**: `https://mcp.hubspot.com`
**Auth**: OAuth 2.0 via user-level app OR Private App token
**Protocol**: Streamable HTTP (SSE-capable)

The app connects as an MCP client. The LLM (Claude) sends tool calls to the MCP server, which translates them into HubSpot API calls.

```typescript
// Conceptual integration — actual implementation depends on MCP client library
import { McpClient } from '@anthropic/mcp-client'; // or equivalent

const mcp = new McpClient({
  serverUrl: 'https://mcp.hubspot.com',
  auth: {
    type: 'bearer',
    token: authManager.getToken()
  }
});

// List available tools
const tools = await mcp.listTools();

// Execute a tool
const result = await mcp.callTool('hubspot_search_contacts', {
  query: 'contacts where email is empty',
  properties: ['email', 'firstname', 'lastname', 'company']
});
```

### Method 2: PeakMojo Community Server (Optional — adds vector search)

**Source**: `github.com/peakmojo/mcp-hubspot`
**Auth**: Private App token via env var
**Extra**: FAISS vector storage for semantic search across retrieved data

```bash
docker run -i --rm \
  -e HUBSPOT_ACCESS_TOKEN={token} \
  -v /path/to/storage:/storage \
  buryhuang/mcp-hubspot:latest
```

**Additional tools provided by PeakMojo**:
- `hubspot_create_contact` — with dedup
- `hubspot_create_company` — with dedup
- `hubspot_get_company_activity`
- `hubspot_get_active_companies`
- `hubspot_get_active_contacts`
- `hubspot_get_recent_conversations`
- `hubspot_search_data` — semantic search (FAISS)

---

## Integration with Orchestrator

The MCP connector is called by the orchestrator when:

1. The operation involves CRM objects (read, create, update, delete)
2. The operation involves tasks or notes
3. The operation involves associations
4. The operation is a natural-language query about CRM data

The orchestrator passes the user's prompt + context to the LLM, which generates MCP tool calls. The MCP connector executes them and returns results.

```
User prompt → Orchestrator → LLM generates MCP tool calls → MCP Connector → HubSpot MCP Server → HubSpot CRM
```

---

## Key Patterns

### Pattern 1: Audit Query
```
User: "Find contacts missing emails"
LLM → MCP tool: search contacts where email is empty
MCP → HubSpot: CRM search API
Return: list of contacts
```

### Pattern 2: Create + Associate
```
User: "Create contact Jane Doe at Acme Corp and associate her"
LLM → MCP tool 1: create contact (Jane Doe, jane@acme.com)
LLM → MCP tool 2: search company (Acme Corp)
LLM → MCP tool 3: create association (contact → company)
Return: confirmation with IDs
```

### Pattern 3: Bulk Task Creation
```
User: "Create follow-up tasks for all deals stuck > 14 days"
LLM → MCP tool 1: search deals in open stages
LLM → (filters to deals > 14 days in stage)
LLM → MCP tool 2..N: create task for each deal owner
Return: list of created tasks
```

---

## Limitations & Fallbacks

When MCP cannot handle a request, the orchestrator must route to the API Layer or Script Layer:

| MCP Can't Do This | Route To |
|-------------------|----------|
| Create properties | API Layer → `07-property-manager.md` |
| Create workflows | API Layer → `06-workflow-engine.md` |
| Create lists/segments | API Layer → `08-list-manager.md` |
| Manage pipelines | API Layer → `09-pipeline-manager.md` |
| Bulk update 1000+ records | Script Layer → `10-script-engine.md` |
| Import CSV data | Script Layer → `10-script-engine.md` |

---

## Exports

```typescript
interface McpConnector {
  connect(token: string): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
  listTools(): Promise<McpTool[]>;
  callTool(toolName: string, params: object): Promise<McpResult>;
  executePrompt(prompt: string, context?: object): Promise<McpResult>;
}
```
