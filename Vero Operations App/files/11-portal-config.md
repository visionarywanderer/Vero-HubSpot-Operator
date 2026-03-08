# 11 — Portal Configuration Store

## Purpose
Store per-client portal settings, custom property mappings, naming conventions, and preferences so the app behaves correctly for each client without reconfiguration.

## Priority: P2 | Dependencies: 01-auth-manager

---

## Portal Config Schema

```json
{
  "portalId": "client-acme",
  "hubId": "12345678",
  "name": "Acme Corp",
  "environment": "production",
  
  "mappings": {
    "lifecycleStages": {
      "new": "subscriber",
      "qualified": "marketingqualifiedlead",
      "sales_ready": "salesqualifiedlead",
      "customer": "customer",
      "churned": "other"
    },
    "dealStages": {
      "pipeline": "default",
      "stages": {
        "discovery": "appointmentscheduled",
        "proposal": "presentationscheduled",
        "negotiation": "decisionmakerboughtin",
        "closed_won": "closedwon",
        "closed_lost": "closedlost"
      }
    }
  },
  
  "customProperties": {
    "leadScore": "hubspot_score",
    "leadSegment": "lead_segment",
    "industry": "industry",
    "revenue": "annualrevenue"
  },
  
  "owners": {
    "salesManager": "12345",
    "defaultOwner": "67890",
    "supportQueue": "11111"
  },
  
  "conventions": {
    "taskPrefix": "[Vero Audit]",
    "notePrefix": "[Vero] ",
    "workflowPrefix": "[Auto] "
  },
  
  "forms": {
    "demoRequest": "abc-123-def",
    "contactUs": "xyz-456-ghi",
    "newsletter": "jkl-789-mno"
  },
  
  "emailTemplates": {
    "welcomeEmail": "113782603056",
    "followUpEmail": "113782603099"
  },
  
  "lists": {
    "allMQLs": "178",
    "hotLeads": "203"
  },
  
  "safety": {
    "maxBulkRecords": 5000,
    "requireDryRun": true,
    "requireConfirmation": true,
    "allowDeletes": false
  }
}
```

---

## How It's Used

The orchestrator loads portal config at session start and injects it into every LLM call and every module:

- **Workflow Engine** uses `forms`, `emailTemplates`, `owners` to fill in real IDs when generating specs
- **Script Engine** uses `mappings` to know which property values mean what
- **MCP Connector** uses `customProperties` to query the right field names
- **Change Logger** uses `conventions.notePrefix` to tag audit notes
- **All modules** respect `safety` settings

---

## Config Management

```typescript
interface PortalConfigStore {
  load(portalId: string): Promise<PortalConfig>;
  save(portalId: string, config: PortalConfig): Promise<void>;
  update(portalId: string, path: string, value: any): Promise<void>;
  list(): Promise<PortalConfigSummary[]>;
  
  // Auto-discovery: scan a portal and build initial config
  discover(portalId: string): Promise<PartialPortalConfig>;
}
```

### Auto-Discovery

On first connection to a new client portal, run discovery to populate config:

1. `GET /crm/v3/properties/contacts` → populate `customProperties`
2. `GET /crm/v3/pipelines/deals` → populate `dealStages`
3. `GET /crm/v3/owners` → populate `owners`
4. `GET /crm/v3/lists/` → populate `lists`
5. Human fills in the rest (forms, email templates, conventions)

---

## Storage

Store as JSON files:

```
config/
  portals/
    client-acme.json
    client-techstart.json
    client-widgetco.json
```

Or SQLite for multi-user environments.
