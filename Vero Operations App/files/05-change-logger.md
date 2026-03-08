# 05 — Change Logger

## Purpose
Log every change the app makes to any HubSpot portal. Provides a full audit trail with before/after values. Non-negotiable for production use.

## Priority: P0 | Dependencies: None

---

## Log Entry Schema

```typescript
interface ChangeLogEntry {
  id: string;               // UUID
  timestamp: string;        // ISO 8601
  portalId: string;         // which client portal
  layer: 'mcp' | 'api' | 'script';
  module: string;           // e.g., "A3", "B2", "F1"
  action: 'create' | 'update' | 'delete' | 'associate' | 'workflow_deploy' | 'property_create' | 'list_create' | 'script_execute';
  objectType: string;       // contact, deal, workflow, property, etc.
  recordId: string;         // HubSpot record ID or workflow flowId
  description: string;      // human-readable description
  before?: object;          // previous values (for updates)
  after?: object;           // new values
  status: 'success' | 'error' | 'dry_run';
  error?: string;           // error message if failed
  initiatedBy: string;      // user or "script:F1"
  prompt?: string;          // original user prompt that triggered this
}
```

## Storage

### Default: JSON Lines file
One file per portal per day:

```
logs/
  acme-corp/
    2026-03-07.jsonl
    2026-03-08.jsonl
  techstart/
    2026-03-07.jsonl
```

Each line is one JSON entry. JSONL format for easy append and streaming reads.

### Optional: SQLite
For portals with high volume, use SQLite with the same schema as columns.

---

## API

```typescript
interface ChangeLogger {
  log(entry: Omit<ChangeLogEntry, 'id' | 'timestamp'>): Promise<string>; // returns entry ID
  getLog(portalId: string, filters?: LogFilters): Promise<ChangeLogEntry[]>;
  getSummary(portalId: string, dateRange: DateRange): Promise<LogSummary>;
  exportLog(portalId: string, format: 'json' | 'csv'): Promise<string>; // file path
}

interface LogFilters {
  dateFrom?: string;
  dateTo?: string;
  action?: string;
  objectType?: string;
  status?: string;
  module?: string;
}

interface LogSummary {
  totalChanges: number;
  byAction: Record<string, number>;
  byObjectType: Record<string, number>;
  byStatus: Record<string, number>;
  errors: ChangeLogEntry[];
}
```

---

## Integration Points

Every module calls the logger:

```typescript
// In API client after updating a contact:
await changeLogger.log({
  portalId: authManager.getActivePortal().id,
  layer: 'mcp',
  module: 'A3',
  action: 'update',
  objectType: 'contact',
  recordId: '12345',
  description: 'Updated lifecycle stage from subscriber to lead',
  before: { lifecyclestage: 'subscriber' },
  after: { lifecyclestage: 'lead' },
  status: 'success',
  initiatedBy: 'user',
  prompt: 'Update contacts who submitted forms to lifecycle stage lead'
});
```

---

## Rollback Support

The logger stores before/after values. A future rollback function can:
1. Read log entries for a specific operation
2. For each `update` entry, apply the `before` values
3. For each `create` entry, delete the created record
4. For each `delete` entry — cannot rollback (HubSpot limitation)

**Note**: Rollback is a future feature. For now, the log enables manual rollback.
