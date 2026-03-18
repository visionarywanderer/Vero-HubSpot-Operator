import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import db from "@/lib/db";
import { sanitizeSensitiveText } from "@/lib/safety-governance";

export type ChangeAction =
  | "create"
  | "update"
  | "delete"
  | "associate"
  | "workflow_deploy"
  | "property_create"
  | "list_create"
  | "script_execute"
  | "audit";

export type ChangeStatus = "success" | "error" | "dry_run";

export interface ChangeLogEntry {
  id: string;
  timestamp: string;
  portalId: string;
  layer: "mcp" | "api" | "script";
  module: string;
  action: ChangeAction;
  objectType: string;
  recordId: string;
  description: string;
  before?: object;
  after?: object;
  status: ChangeStatus;
  error?: string;
  initiatedBy: string;
  prompt?: string;
}

export interface LogFilters {
  dateFrom?: string;
  dateTo?: string;
  action?: string;
  objectType?: string;
  status?: string;
  module?: string;
}

export interface LogSummary {
  totalChanges: number;
  byAction: Record<string, number>;
  byObjectType: Record<string, number>;
  byStatus: Record<string, number>;
  errors: ChangeLogEntry[];
}

interface DateRange {
  dateFrom?: string;
  dateTo?: string;
}

export interface ChangeLogger {
  log(entry: Omit<ChangeLogEntry, "id" | "timestamp">): Promise<string>;
  getLog(portalId: string, filters?: LogFilters): Promise<ChangeLogEntry[]>;
  getSummary(portalId: string, dateRange: DateRange): Promise<LogSummary>;
  exportLog(portalId: string, format: "json" | "csv"): Promise<string>;
}

const EXPORT_ROOT = path.join(process.cwd(), "exports");

type Row = {
  id: string;
  timestamp: string;
  portal_id: string;
  layer: string;
  module: string;
  action: string;
  object_type: string;
  record_id: string;
  description: string;
  before_value: string | null;
  after_value: string | null;
  status: string;
  error: string | null;
  initiated_by: string;
  prompt: string | null;
};

function mapRow(row: Row): ChangeLogEntry {
  return {
    id: row.id,
    timestamp: row.timestamp,
    portalId: row.portal_id,
    layer: row.layer as ChangeLogEntry["layer"],
    module: row.module,
    action: row.action as ChangeAction,
    objectType: row.object_type,
    recordId: row.record_id,
    description: row.description,
    before: row.before_value ? (JSON.parse(row.before_value) as object) : undefined,
    after: row.after_value ? (JSON.parse(row.after_value) as object) : undefined,
    status: row.status as ChangeStatus,
    error: row.error || undefined,
    initiatedBy: row.initiated_by,
    prompt: row.prompt || undefined
  };
}

class SqliteChangeLogger implements ChangeLogger {
  async log(entry: Omit<ChangeLogEntry, "id" | "timestamp">): Promise<string> {
    const id = randomUUID();
    const timestamp = new Date().toISOString();

    db.prepare(
      `INSERT INTO change_log(
        id, timestamp, portal_id, layer, module, action, object_type, record_id,
        description, before_value, after_value, status, error, initiated_by, prompt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      timestamp,
      entry.portalId,
      entry.layer,
      entry.module,
      entry.action,
      entry.objectType,
      entry.recordId,
      entry.description,
      entry.before ? JSON.stringify(entry.before) : null,
      entry.after ? JSON.stringify(entry.after) : null,
      entry.status,
      entry.error ? sanitizeSensitiveText(entry.error) : null,
      entry.initiatedBy,
      entry.prompt ? sanitizeSensitiveText(entry.prompt) : null
    );

    return id;
  }

  async getLog(portalId: string, filters?: LogFilters): Promise<ChangeLogEntry[]> {
    const conditions: string[] = ["portal_id = ?"];
    const values: unknown[] = [portalId];

    if (filters?.dateFrom) {
      conditions.push("timestamp >= ?");
      values.push(filters.dateFrom);
    }
    if (filters?.dateTo) {
      conditions.push("timestamp <= ?");
      values.push(filters.dateTo);
    }
    if (filters?.action) {
      conditions.push("action = ?");
      values.push(filters.action);
    }
    if (filters?.objectType) {
      conditions.push("object_type = ?");
      values.push(filters.objectType);
    }
    if (filters?.status) {
      conditions.push("status = ?");
      values.push(filters.status);
    }
    if (filters?.module) {
      conditions.push("module = ?");
      values.push(filters.module);
    }

    const rows = db
      .prepare(`SELECT * FROM change_log WHERE ${conditions.join(" AND ")} ORDER BY timestamp DESC`)
      .all(...values) as Row[];

    return rows.map(mapRow);
  }

  async getSummary(portalId: string, dateRange: DateRange): Promise<LogSummary> {
    const entries = await this.getLog(portalId, {
      dateFrom: dateRange.dateFrom,
      dateTo: dateRange.dateTo
    });

    const byAction: Record<string, number> = {};
    const byObjectType: Record<string, number> = {};
    const byStatus: Record<string, number> = {};
    const errors: ChangeLogEntry[] = [];

    for (const entry of entries) {
      byAction[entry.action] = (byAction[entry.action] || 0) + 1;
      byObjectType[entry.objectType] = (byObjectType[entry.objectType] || 0) + 1;
      byStatus[entry.status] = (byStatus[entry.status] || 0) + 1;
      if (entry.status === "error") errors.push(entry);
    }

    return {
      totalChanges: entries.length,
      byAction,
      byObjectType,
      byStatus,
      errors
    };
  }

  async exportLog(portalId: string, format: "json" | "csv"): Promise<string> {
    // Sanitize portalId to prevent path traversal (allow only alphanumeric, dash, underscore)
    const safePortalId = portalId.replace(/[^a-zA-Z0-9_-]/g, "");
    if (!safePortalId) throw new Error("Invalid portalId");

    const entries = await this.getLog(portalId);
    await mkdir(EXPORT_ROOT, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

    if (format === "json") {
      const filePath = path.join(EXPORT_ROOT, `${safePortalId}-${timestamp}.json`);
      // Verify path stays within EXPORT_ROOT
      if (!filePath.startsWith(EXPORT_ROOT)) throw new Error("Path traversal blocked");
      await writeFile(filePath, JSON.stringify(entries, null, 2), "utf8");
      return filePath;
    }

    const headers = [
      "id",
      "timestamp",
      "portalId",
      "layer",
      "module",
      "action",
      "objectType",
      "recordId",
      "description",
      "status",
      "error",
      "initiatedBy",
      "prompt"
    ];

    const rows = entries.map((entry) =>
      headers
        .map((header) => {
          const value = (entry as unknown as Record<string, unknown>)[header];
          const normalized = value == null ? "" : String(value).split("\"").join("\"\"");
          return `"${normalized}"`;
        })
        .join(",")
    );

    const csv = `${headers.join(",")}\n${rows.join("\n")}`;
    const filePath = path.join(EXPORT_ROOT, `${safePortalId}-${timestamp}.csv`);
    // Verify path stays within EXPORT_ROOT
    if (!filePath.startsWith(EXPORT_ROOT)) throw new Error("Path traversal blocked");
    await writeFile(filePath, csv, "utf8");
    return filePath;
  }
}

export const changeLogger: ChangeLogger = new SqliteChangeLogger();
