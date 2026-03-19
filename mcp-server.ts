#!/usr/bin/env npx tsx
/**
 * HubSpot Operator MCP Server (HTTP Proxy Mode)
 *
 * Proxies MCP tool calls to the Railway-deployed HubSpot Operator app
 * via its REST API. No direct library imports — all business logic runs
 * on the Railway server.
 *
 * Required env vars (loaded from .env.local):
 *   APP_BASE_URL  — e.g. https://vero-hubspot-operator-production.up.railway.app
 *   MCP_API_KEY   — Bearer token accepted by the app's middleware
 *
 * Transport modes:
 *   STDIO  (default)  — for Claude Code / local MCP clients
 *     npx tsx mcp-server.ts
 *
 *   HTTP+SSE           — for ChatGPT / remote MCP clients
 *     npx tsx mcp-server.ts --http [--port 8080]
 *
 * Claude Code config (.mcp.json):
 *   {
 *     "mcpServers": {
 *       "hubspot-operator": {
 *         "command": "npx",
 *         "args": ["tsx", "/path/to/mcp-server.ts"]
 *       }
 *     }
 *   }
 */

// Load .env.local if present (tsx doesn't auto-load like Next.js does)
import { readFileSync, existsSync } from "node:fs";
import { resolve, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// Derive the directory this script lives in (works regardless of cwd)
const __scriptDir = (() => {
  try { return dirname(fileURLToPath(import.meta.url)); } catch { /* fallback below */ }
  try { if (import.meta.dirname) return import.meta.dirname; } catch { /* fallback below */ }
  return process.cwd();
})();

// Read version from package.json (single source of truth)
const APP_VERSION = (() => {
  for (const dir of [__scriptDir, process.cwd()]) {
    try {
      const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
      if (pkg.version) return pkg.version as string;
    } catch { /* try next */ }
  }
  return "0.0.0";
})();

const envCandidates = [
  join(__scriptDir, ".env.local"),
  join(process.cwd(), ".env.local"),
];
for (const envPath of envCandidates) {
  if (existsSync(envPath)) {
    for (const line of readFileSync(envPath, "utf8").split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx < 1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim();
      if (!process.env[key]) process.env[key] = val;
    }
    break; // Only load the first found .env.local
  }
}

// Verify critical env vars are present
const APP_BASE_URL = (process.env.APP_BASE_URL || "").replace(/\/+$/, "");
const MCP_API_KEY = process.env.MCP_API_KEY || "";

if (!APP_BASE_URL) {
  process.stderr.write("[mcp-server] FATAL: APP_BASE_URL not set. Add it to .env.local (e.g. https://vero-hubspot-operator-production.up.railway.app)\n");
  process.exit(1);
}
if (!MCP_API_KEY) {
  process.stderr.write("[mcp-server] FATAL: MCP_API_KEY not set. Add it to .env.local\n");
  process.exit(1);
}

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { createServer, IncomingMessage, ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import { z } from "zod";

// ---------------------------------------------------------------------------
// HTTP API helper — all tool handlers call this instead of lib imports
// ---------------------------------------------------------------------------

interface ApiOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  path: string;
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
}

async function api<T = unknown>(opts: ApiOptions): Promise<T> {
  const url = new URL(opts.path, APP_BASE_URL);
  if (opts.query) {
    for (const [k, v] of Object.entries(opts.query)) {
      if (v !== undefined && v !== null && v !== "") {
        url.searchParams.set(k, String(v));
      }
    }
  }

  const method = opts.method || "GET";
  const headers: Record<string, string> = {
    Authorization: `Bearer ${MCP_API_KEY}`,
    Accept: "application/json",
  };
  let reqBody: string | undefined;
  if (opts.body !== undefined) {
    headers["Content-Type"] = "application/json";
    reqBody = JSON.stringify(opts.body);
  }

  const res = await fetch(url.toString(), { method, headers, body: reqBody });
  const text = await res.text();

  if (!res.ok) {
    let detail: string;
    try {
      const parsed = JSON.parse(text);
      detail = parsed.error || parsed.message || text;
    } catch {
      detail = text;
    }
    throw new Error(`API ${method} ${opts.path} returned ${res.status}: ${detail}`);
  }

  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

// ---------------------------------------------------------------------------
// PII redaction — strip sensitive data before returning to MCP clients
// ---------------------------------------------------------------------------

function redactPII(text: string): string {
  return text
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, "{email}")
    .replace(/(?:\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}/g, "{phone}")
    .replace(/"(?:firstname|lastname|first_name|last_name)"\s*:\s*"[^"]*"/gi, (match) => {
      const key = match.split(":")[0];
      return `${key}: "{name}"`;
    });
}

/** Convenience: return MCP text content from any JSON-serializable value */
function textResult(data: unknown) {
  return { content: [{ type: "text" as const, text: redactPII(JSON.stringify(data, null, 2)) }] };
}

// ---------------------------------------------------------------------------
// Server setup
// ---------------------------------------------------------------------------

const server = new McpServer({
  name: "hubspot-operator",
  version: APP_VERSION,
});

// ---------------------------------------------------------------------------
// Tool registration — shared between stdio (global) and HTTP (per-session)
// ---------------------------------------------------------------------------

function registerTools(server: McpServer): void {

// ---------------------------------------------------------------------------
// Portal Management Tools
// ---------------------------------------------------------------------------

server.tool(
  "list_portals",
  "List all connected HubSpot portals. IMPORTANT: When multiple portals are connected, always call this first and pass the correct portalId to every other tool to avoid cross-portal contamination.",
  {},
  async () => {
    const data = await api({ path: "/api/portals" });
    return textResult(data);
  }
);

server.tool(
  "portal_capabilities",
  "Get the capabilities (granted scopes) for a specific portal",
  { portalId: z.string().optional().describe("Portal/Hub ID. Omit to use the first connected portal.") },
  async ({ portalId }) => {
    const query: Record<string, string | undefined> = {};
    if (portalId) query.portalId = portalId;
    // If portalId is provided, use it in the path; otherwise let the API pick the default
    const path = portalId ? `/api/portals/${encodeURIComponent(portalId)}/capabilities` : "/api/portals/capabilities";
    const data = await api({ path, query: portalId ? undefined : query });
    return textResult(data);
  }
);

// ---------------------------------------------------------------------------
// Property Tools
// ---------------------------------------------------------------------------

server.tool(
  "list_properties",
  "List all properties for a HubSpot object type (contacts, companies, deals, tickets, etc.)",
  {
    objectType: z.string().describe("HubSpot object type: contacts, companies, deals, tickets, line_items, products, etc."),
    portalId: z.string().optional(),
  },
  async ({ objectType, portalId }) => {
    const data = await api({
      path: "/api/properties",
      query: { objectType, portalId },
    });
    return textResult(data);
  }
);

server.tool(
  "create_property",
  "Create a new custom property on a HubSpot object type",
  {
    objectType: z.string().describe("contacts, companies, deals, tickets, etc."),
    name: z.string().describe("Internal property name (lowercase, underscores)"),
    label: z.string().describe("Display label"),
    type: z.string().describe("Property type: string, number, date, datetime, bool, enumeration"),
    fieldType: z.string().describe("Field type: text, textarea, number, select, radio, checkbox, date, booleancheckbox, phonenumber, file, html, calculation_equation"),
    groupName: z.string().optional().describe("Property group name"),
    description: z.string().optional(),
    options: z.array(z.object({
      label: z.string(),
      value: z.string(),
      displayOrder: z.number().optional(),
    })).optional().describe("Options for enumeration type properties"),
    portalId: z.string().optional(),
  },
  async ({ objectType, name, label, type, fieldType, groupName, description, options, portalId }) => {
    const spec: Record<string, unknown> = { name, label, type, fieldType };
    if (groupName) spec.groupName = groupName;
    if (description) spec.description = description;
    if (options) spec.options = options;
    const data = await api({
      method: "POST",
      path: "/api/properties",
      body: { objectType, spec, portalId },
    });
    return textResult(data);
  }
);

server.tool(
  "update_property",
  "Update an existing property on a HubSpot object type",
  {
    objectType: z.string(),
    name: z.string().describe("Internal property name to update"),
    updates: z.object({
      label: z.string().optional(),
      description: z.string().optional(),
      groupName: z.string().optional(),
      displayOrder: z.number().optional(),
      hidden: z.boolean().optional(),
      formField: z.boolean().optional(),
      options: z.array(z.object({
        label: z.string(),
        value: z.string(),
        displayOrder: z.number().optional(),
      })).optional(),
    }).describe("Fields to update"),
    portalId: z.string().optional(),
  },
  async ({ objectType, name, updates, portalId }) => {
    const data = await api({
      method: "PATCH",
      path: `/api/properties/${encodeURIComponent(objectType)}/${encodeURIComponent(name)}`,
      body: { updates, portalId },
    });
    return textResult(data);
  }
);

server.tool(
  "delete_property",
  "Delete (archive) a custom property from a HubSpot object type",
  {
    objectType: z.string(),
    name: z.string().describe("Internal property name to delete"),
    portalId: z.string().optional(),
  },
  async ({ objectType, name, portalId }) => {
    const data = await api({
      method: "DELETE",
      path: `/api/properties/${encodeURIComponent(objectType)}/${encodeURIComponent(name)}`,
      query: { portalId },
    });
    return textResult(data);
  }
);

server.tool(
  "audit_properties",
  "Audit properties for an object type — find unused, low fill-rate, and review candidates",
  {
    objectType: z.string(),
    portalId: z.string().optional(),
  },
  async ({ objectType, portalId }) => {
    const data = await api({
      path: "/api/properties/audit",
      query: { objectType, portalId },
    });
    return textResult(data);
  }
);

// ---------------------------------------------------------------------------
// Pipeline Tools
// ---------------------------------------------------------------------------

server.tool(
  "list_pipelines",
  "List all pipelines for deals or tickets",
  {
    objectType: z.enum(["deals", "tickets"]),
    portalId: z.string().optional(),
  },
  async ({ objectType, portalId }) => {
    const data = await api({
      path: "/api/pipelines",
      query: { objectType, portalId },
    });
    return textResult(data);
  }
);

server.tool(
  "create_pipeline",
  "Create a new pipeline with stages",
  {
    objectType: z.enum(["deals", "tickets"]),
    label: z.string().describe("Pipeline display name"),
    stages: z.array(z.object({
      label: z.string(),
      displayOrder: z.number().optional(),
      metadata: z.record(z.string(), z.string()).optional().describe("Stage metadata, e.g. { isClosed: 'true', closedWon: 'true' }"),
    })),
    portalId: z.string().optional(),
  },
  async ({ objectType, label, stages, portalId }) => {
    const data = await api({
      method: "POST",
      path: "/api/pipelines",
      body: { objectType, spec: { label, stages }, portalId },
    });
    return textResult(data);
  }
);

server.tool(
  "audit_pipelines",
  "Audit pipelines — check for missing stages, too many/few stages, missing Closed Won/Lost",
  {
    objectType: z.enum(["deals", "tickets"]),
    portalId: z.string().optional(),
  },
  async ({ objectType, portalId }) => {
    const data = await api({
      path: "/api/pipelines/audit",
      query: { objectType, portalId },
    });
    return textResult(data);
  }
);

// ---------------------------------------------------------------------------
// CRM Record Tools
// ---------------------------------------------------------------------------

server.tool(
  "get_record",
  "Get a single CRM record by ID",
  {
    objectType: z.string().describe("contacts, companies, deals, tickets, etc."),
    id: z.string().describe("Record ID"),
    properties: z.array(z.string()).optional().describe("Specific properties to return (reduces payload)"),
    portalId: z.string().optional(),
  },
  async ({ objectType, id, properties, portalId }) => {
    const query: Record<string, string | undefined> = { portalId };
    if (properties?.length) query.properties = properties.join(",");
    const data = await api({
      path: `/api/records/${encodeURIComponent(objectType)}/${encodeURIComponent(id)}`,
      query,
    });
    return textResult(data);
  }
);

server.tool(
  "search_records",
  "Search CRM records with filters",
  {
    objectType: z.string(),
    filters: z.array(z.object({
      propertyName: z.string(),
      operator: z.string().describe("EQ, NEQ, LT, LTE, GT, GTE, CONTAINS_TOKEN, NOT_CONTAINS_TOKEN, HAS_PROPERTY, NOT_HAS_PROPERTY, IN, NOT_IN"),
      value: z.string().optional(),
      values: z.array(z.string()).optional(),
    })),
    properties: z.array(z.string()).optional(),
    portalId: z.string().optional(),
  },
  async ({ objectType, filters, properties, portalId }) => {
    const data = await api({
      method: "POST",
      path: "/api/records/search",
      body: { objectType, filters, properties, portalId },
    });
    return textResult(data);
  }
);

server.tool(
  "create_record",
  "Create a new CRM record",
  {
    objectType: z.string(),
    properties: z.record(z.string(), z.string()).describe("Property name-value pairs"),
    portalId: z.string().optional(),
  },
  async ({ objectType, properties, portalId }) => {
    const data = await api({
      method: "POST",
      path: "/api/records",
      body: { objectType, properties, portalId },
    });
    return textResult(data);
  }
);

server.tool(
  "update_record",
  "Update a CRM record",
  {
    objectType: z.string(),
    id: z.string(),
    properties: z.record(z.string(), z.string()).describe("Property name-value pairs to update"),
    portalId: z.string().optional(),
  },
  async ({ objectType, id, properties, portalId }) => {
    const data = await api({
      method: "PATCH",
      path: `/api/records/${encodeURIComponent(objectType)}/${encodeURIComponent(id)}`,
      body: { properties, portalId },
    });
    return textResult(data);
  }
);

server.tool(
  "batch_upsert_records",
  "Create or update records in batch (up to 100 per call). Uses email as dedup key for contacts.",
  {
    objectType: z.string(),
    records: z.array(z.record(z.string(), z.string())).describe("Array of property objects"),
    idProperty: z.string().optional().describe("Property to use for dedup (e.g. 'email' for contacts)"),
    portalId: z.string().optional(),
  },
  async ({ objectType, records, idProperty, portalId }) => {
    const data = await api({
      method: "POST",
      path: "/api/records/batch-upsert",
      body: { objectType, records, idProperty, portalId },
    });
    return textResult(data);
  }
);

// ---------------------------------------------------------------------------
// List Tools
// ---------------------------------------------------------------------------

server.tool(
  "list_lists",
  "List all CRM lists (static and dynamic)",
  { portalId: z.string().optional() },
  async ({ portalId }) => {
    const data = await api({
      path: "/api/lists",
      query: { portalId },
    });
    return textResult(data);
  }
);

server.tool(
  "create_list",
  "Create a new CRM list",
  {
    name: z.string(),
    objectTypeId: z.string().optional().describe("Default: 0-1 (contacts)"),
    processingType: z.enum(["DYNAMIC", "MANUAL"]).optional(),
    filterBranch: z.record(z.string(), z.unknown()).optional().describe("Filter definition for dynamic lists"),
    portalId: z.string().optional(),
  },
  async ({ name, objectTypeId, processingType, filterBranch, portalId }) => {
    const data = await api({
      method: "POST",
      path: "/api/lists",
      body: { spec: { name, objectTypeId, processingType, filterBranch }, portalId },
    });
    return textResult(data);
  }
);

// ---------------------------------------------------------------------------
// Workflow Tools
// ---------------------------------------------------------------------------

server.tool(
  "list_workflows",
  "List all automation workflows",
  { portalId: z.string().optional() },
  async ({ portalId }) => {
    const data = await api({
      path: "/api/workflows",
      query: { portalId },
    });
    return textResult(data);
  }
);

server.tool(
  "save_workflow_draft",
  "Save a workflow spec as a local draft (does NOT deploy to HubSpot). Checks for duplicate workflows in portal and existing drafts. Deploy it later from the app UI or via deploy_workflow.",
  {
    workflow: z.record(z.string(), z.unknown()).describe("Full workflow definition matching HubSpot v4 format"),
    portalId: z.string().optional(),
  },
  async ({ workflow, portalId }) => {
    const name = String(workflow.name || "Untitled Workflow");
    const data = await api({
      method: "POST",
      path: "/api/workflows/drafts",
      body: { name, spec: workflow, portalId },
    });
    return textResult(data);
  }
);

server.tool(
  "deploy_workflow",
  "Deploy a new workflow (always created disabled for safety). Use the v4 action format.",
  {
    workflow: z.record(z.string(), z.unknown()).describe("Full workflow definition matching HubSpot v4 format"),
    portalId: z.string().optional(),
  },
  async ({ workflow, portalId }) => {
    const data = await api({
      method: "POST",
      path: "/api/workflows/deploy",
      body: { spec: workflow, portalId },
    });
    return textResult(data);
  }
);

// ---------------------------------------------------------------------------
// Draft Tools — save specs to the server, deploy later from app UI
// ---------------------------------------------------------------------------

server.tool(
  "save_pipeline_draft",
  "Save a pipeline spec as a local draft (does NOT deploy to HubSpot). Checks for duplicate pipelines in portal and existing drafts.",
  {
    spec: z.record(z.string(), z.unknown()).describe("Pipeline definition with label, stages, objectType"),
    name: z.string().optional(),
    portalId: z.string().optional(),
  },
  async ({ spec, name, portalId }) => {
    const draftName = name || String(spec.label || spec.name || "Untitled Pipeline");
    const data = await api({
      method: "POST",
      path: "/api/pipelines/drafts",
      body: { name: draftName, spec, portalId },
    });
    return textResult(data);
  }
);

server.tool(
  "save_property_draft",
  "Save a property spec as a local draft (does NOT create in HubSpot). Checks for duplicate properties in portal and existing drafts.",
  {
    spec: z.record(z.string(), z.unknown()).describe("Property definition with name, label, type, fieldType, objectType"),
    name: z.string().optional(),
    portalId: z.string().optional(),
  },
  async ({ spec, name, portalId }) => {
    const draftName = name || String(spec.label || spec.name || "Untitled Property");
    const data = await api({
      method: "POST",
      path: "/api/properties/drafts",
      body: { name: draftName, spec, portalId },
    });
    return textResult(data);
  }
);

server.tool(
  "save_list_draft",
  "Save a list/segment spec as a local draft (does NOT create in HubSpot). Checks for duplicate lists in portal and existing drafts.",
  {
    spec: z.record(z.string(), z.unknown()).describe("List definition with name, objectTypeId, processingType, optional filterBranch"),
    name: z.string().optional(),
    portalId: z.string().optional(),
  },
  async ({ spec, name, portalId }) => {
    const draftName = name || String(spec.name || "Untitled List");
    const data = await api({
      method: "POST",
      path: "/api/lists/drafts",
      body: { name: draftName, spec, portalId },
    });
    return textResult(data);
  }
);

server.tool(
  "save_template_draft",
  "Save a template/config spec as a local draft (does NOT install to HubSpot). Checks for duplicate drafts.",
  {
    spec: z.record(z.string(), z.unknown()).describe("Template definition with resources (propertyGroups, properties, pipelines, workflows, lists, customObjects, associations)"),
    name: z.string().optional(),
    portalId: z.string().optional(),
  },
  async ({ spec, name, portalId }) => {
    const draftName = name || String(spec.name || spec.id || "Untitled Template");
    const data = await api({
      method: "POST",
      path: "/api/templates/drafts",
      body: { name: draftName, spec, portalId },
    });
    return textResult(data);
  }
);

server.tool(
  "save_custom_object_draft",
  "Save a custom object spec as a local draft (does NOT create in HubSpot). Checks for duplicate drafts.",
  {
    spec: z.record(z.string(), z.unknown()).describe("Custom object definition with name, labels, properties, primaryDisplayProperty"),
    name: z.string().optional(),
    portalId: z.string().optional(),
  },
  async ({ spec, name, portalId }) => {
    const draftName = name || String(spec.name || "Untitled Custom Object");
    const data = await api({
      method: "POST",
      path: "/api/custom-objects/drafts",
      body: { name: draftName, spec, portalId },
    });
    return textResult(data);
  }
);

// ---------------------------------------------------------------------------
// Config Engine Tools (Templates)
// ---------------------------------------------------------------------------

server.tool(
  "validate_config",
  "Validate a Config Engine template payload without executing it",
  {
    resources: z.record(z.string(), z.unknown()).describe("TemplateResources object with propertyGroups, properties, pipelines, workflows, lists, customObjects, associations"),
  },
  async ({ resources }) => {
    const data = await api({
      method: "POST",
      path: "/api/config/validate",
      body: { resources },
    });
    return textResult(data);
  }
);

server.tool(
  "execute_config",
  "Execute a Config Engine template — creates all resources (properties, pipelines, workflows, lists) in dependency order",
  {
    resources: z.record(z.string(), z.unknown()).describe("TemplateResources object"),
    dryRun: z.boolean().optional().describe("If true, validates and resolves dependencies without creating anything"),
    portalId: z.string().optional(),
  },
  async ({ resources, dryRun, portalId }) => {
    const data = await api({
      method: "POST",
      path: "/api/config/execute",
      body: { resources, portalId, dryRun },
    });
    return textResult(data);
  }
);

server.tool(
  "install_template",
  "Install a saved template by ID",
  {
    templateId: z.string(),
    dryRun: z.boolean().optional(),
    portalId: z.string().optional(),
  },
  async ({ templateId, dryRun, portalId }) => {
    const data = await api({
      method: "POST",
      path: "/api/templates/install",
      body: { templateId, portalId, dryRun },
    });
    return textResult(data);
  }
);

// ---------------------------------------------------------------------------
// Activity / Audit Tools
// ---------------------------------------------------------------------------

server.tool(
  "activity_log",
  "Get recent activity/change log entries",
  {
    limit: z.number().optional().describe("Number of entries to return (default 50)"),
    portalId: z.string().optional(),
  },
  async ({ limit, portalId }) => {
    const data = await api({
      path: "/api/activity",
      query: { portalId, limit },
    });
    return textResult(data);
  }
);

// ---------------------------------------------------------------------------
// Association Tools
// ---------------------------------------------------------------------------

server.tool(
  "create_association",
  "Create an association between two CRM records",
  {
    fromType: z.string().describe("e.g. contacts"),
    fromId: z.string(),
    toType: z.string().describe("e.g. companies"),
    toId: z.string(),
    portalId: z.string().optional(),
  },
  async ({ fromType, fromId, toType, toId, portalId }) => {
    const data = await api({
      method: "POST",
      path: "/api/records/associations",
      body: { fromType, fromId, toType, toId, portalId },
    });
    return textResult(data);
  }
);

server.tool(
  "batch_create_associations",
  "Create multiple associations in batch (up to 2,000 pairs)",
  {
    fromType: z.string(),
    toType: z.string(),
    pairs: z.array(z.object({
      fromId: z.string(),
      toId: z.string(),
    })),
    portalId: z.string().optional(),
  },
  async ({ fromType, toType, pairs, portalId }) => {
    const data = await api({
      method: "POST",
      path: "/api/records/associations/batch",
      body: { fromType, toType, pairs, portalId },
    });
    return textResult(data);
  }
);

// ---------------------------------------------------------------------------
// Health & Self-Improvement Tools
// ---------------------------------------------------------------------------

server.tool(
  "deep_health_check",
  "Run a deep health check on a HubSpot portal — tests API connectivity, validates action types, checks scopes, detects deprecation warnings. Use this to verify a portal is fully operational before deploying workflows or templates.",
  {
    portalId: z.string().describe("Portal/Hub ID to check"),
  },
  async ({ portalId }) => {
    const data = await api({
      path: "/api/health/deep",
      query: { portalId },
    });
    return textResult(data);
  }
);

} // end registerTools()

// Register tools on the global server instance (used in stdio mode)
registerTools(server);

// ---------------------------------------------------------------------------
// Transport: parse CLI args
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const httpMode = args.includes("--http");
const portIdx = args.indexOf("--port");
const HTTP_PORT = portIdx !== -1 ? Number(args[portIdx + 1]) : Number(process.env.MCP_PORT) || 8808;

// ---------------------------------------------------------------------------
// CORS helper
// ---------------------------------------------------------------------------

function setCorsHeaders(req: IncomingMessage, res: ServerResponse): void {
  const origin = req.headers["origin"] || "";
  if (origin.includes("claude.ai") || origin.includes("claude.com")) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
  } else {
    res.setHeader("Access-Control-Allow-Origin", "*");
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, Mcp-Session-Id, MCP-Protocol-Version");
  res.setHeader("Access-Control-Expose-Headers", "Mcp-Session-Id");
}

// ---------------------------------------------------------------------------
// Start — STDIO or HTTP+SSE
// ---------------------------------------------------------------------------

async function main() {
  process.stderr.write(`[mcp-server] Proxying to ${APP_BASE_URL}\n`);

  if (!httpMode) {
    // -- STDIO mode (Claude Code, local clients) --
    const transport = new StdioServerTransport();
    await server.connect(transport);
    return;
  }

  // -- HTTP mode (ChatGPT, remote clients) --
  const transports: Record<string, SSEServerTransport | StreamableHTTPServerTransport> = {};

  const httpServer = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
    const pathname = url.pathname;

    setCorsHeaders(req, res);

    console.error(`[HTTP] ${req.method} ${pathname}${url.search || ""}`);

    // Preflight
    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    // Health check
    if (pathname === "/health" && req.method === "GET") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        status: "ok",
        server: "hubspot-operator-mcp",
        version: APP_VERSION,
        mode: "proxy",
        target: APP_BASE_URL,
        activeSessions: Object.keys(transports).length,
      }));
      return;
    }

    // -- Streamable HTTP endpoint: /mcp --
    if (pathname === "/mcp") {
      try {
        const sessionId = req.headers["mcp-session-id"] as string | undefined;
        let transport: StreamableHTTPServerTransport | undefined;

        if (sessionId && transports[sessionId]) {
          const existing = transports[sessionId];
          if (existing instanceof StreamableHTTPServerTransport) {
            transport = existing;
          } else {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ jsonrpc: "2.0", error: { code: -32000, message: "Session uses different transport" }, id: null }));
            return;
          }
        } else if (!sessionId && req.method === "POST") {
          const body = await readBody(req);
          if (isInitializeRequest(body)) {
            transport = new StreamableHTTPServerTransport({
              sessionIdGenerator: () => randomUUID(),
              onsessioninitialized: (sid: string) => {
                transports[sid] = transport!;
              },
            });
            transport.onclose = () => {
              const sid = transport!.sessionId;
              if (sid) delete transports[sid];
            };
            const newServer = createMcpServerInstance();
            await newServer.connect(transport);
          }
          if (transport) {
            await transport.handleRequest(req, res, body);
            return;
          }
        }

        if (transport) {
          await transport.handleRequest(req, res);
        } else {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ jsonrpc: "2.0", error: { code: -32000, message: "No valid session" }, id: null }));
        }
      } catch {
        if (!res.headersSent) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ jsonrpc: "2.0", error: { code: -32603, message: "Internal server error" }, id: null }));
        }
      }
      return;
    }

    // -- SSE endpoint: /sse --
    if (pathname === "/sse" && req.method === "GET") {
      const transport = new SSEServerTransport("/messages", res);
      transports[transport.sessionId] = transport;
      res.on("close", () => { delete transports[transport.sessionId]; });

      const newServer = createMcpServerInstance();
      await newServer.connect(transport);
      return;
    }

    // -- SSE message endpoint: /messages --
    if (pathname === "/messages" && req.method === "POST") {
      const sessionId = url.searchParams.get("sessionId");
      if (!sessionId || !transports[sessionId]) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Invalid or missing sessionId" }));
        return;
      }
      const transport = transports[sessionId];
      if (transport instanceof SSEServerTransport) {
        const body = await readBody(req);
        await transport.handlePostMessage(req, res, body);
      } else {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Session uses different transport" }));
      }
      return;
    }

    // -- Root endpoint --
    if (pathname === "/" && req.method === "GET") {
      const proto = (req.headers["x-forwarded-proto"] as string) || "http";
      const host = req.headers["host"] || `localhost:${HTTP_PORT}`;
      const baseUrl = `${proto}://${host}`;
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        name: "hubspot-operator-mcp",
        version: APP_VERSION,
        mode: "proxy",
        target: APP_BASE_URL,
        mcp: {
          sse: `${baseUrl}/sse`,
          streamable: `${baseUrl}/mcp`,
        },
      }));
      return;
    }

    // -- 404 --
    console.error(`[404] ${req.method} ${pathname}`);
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      error: "Not found",
      endpoints: {
        "/sse": "GET — SSE stream",
        "/mcp": "POST — Streamable HTTP",
        "/messages": "POST — SSE message endpoint",
        "/health": "GET — Health check",
      },
    }));
  });

  httpServer.listen(HTTP_PORT, () => {
    console.error(`\nHubSpot Operator MCP Server (HTTP proxy mode)`);
    console.error(`  Port:   ${HTTP_PORT}`);
    console.error(`  Target: ${APP_BASE_URL}`);
    console.error(`\n  Endpoints:`);
    console.error(`    SSE:              http://localhost:${HTTP_PORT}/sse`);
    console.error(`    Streamable HTTP:  http://localhost:${HTTP_PORT}/mcp`);
    console.error(`    Health:           http://localhost:${HTTP_PORT}/health\n`);
  });

  // Graceful shutdown
  process.on("SIGINT", async () => {
    console.error("\nShutting down...");
    for (const sid of Object.keys(transports)) {
      try { await transports[sid].close(); } catch {} // intentional: transport may already be closed during shutdown
      delete transports[sid];
    }
    httpServer.close();
    process.exit(0);
  });
}

// ---------------------------------------------------------------------------
// Helper: read HTTP request body as JSON
// ---------------------------------------------------------------------------

function readBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => {
      try {
        const raw = Buffer.concat(chunks).toString("utf-8");
        if (!raw) { resolve(undefined); return; }
        const contentType = req.headers["content-type"] || "";
        if (contentType.includes("application/x-www-form-urlencoded")) {
          const params = new URLSearchParams(raw);
          const obj: Record<string, string> = {};
          params.forEach((v, k) => { obj[k] = v; });
          resolve(obj);
          return;
        }
        resolve(JSON.parse(raw));
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });
}

// ---------------------------------------------------------------------------
// Factory: create a fresh MCP server instance (HTTP mode needs one per session)
// ---------------------------------------------------------------------------

function createMcpServerInstance(): McpServer {
  const s = new McpServer({ name: "hubspot-operator", version: APP_VERSION });
  registerTools(s);
  return s;
}

main().catch((err) => {
  console.error("MCP server failed:", err);
  process.exit(1);
});
