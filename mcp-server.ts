#!/usr/bin/env npx tsx
/**
 * HubSpot Operator MCP Server
 *
 * Exposes the full HubSpot Operator as an MCP tool server.
 * LLMs talk to this server → it calls the app's validated, rate-limited,
 * audit-logged API layer → HubSpot.
 *
 * Transport modes:
 *   STDIO  (default)  — for Claude Code / local MCP clients
 *     npx tsx mcp-server.ts
 *
 *   HTTP+SSE           — for ChatGPT / remote MCP clients
 *     npx tsx mcp-server.ts --http [--port 8080]
 *
 * ChatGPT configuration (Settings → Apps & Connectors):
 *   Server URL: https://your-domain.com/sse
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
import { resolve } from "node:path";
const envLocalPath = resolve(import.meta.dirname ?? ".", ".env.local");
if (existsSync(envLocalPath)) {
  for (const line of readFileSync(envLocalPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx < 1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
}

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { createServer, IncomingMessage, ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import { z } from "zod";
// node:url — URL is available globally in Node.js 18+

// Import app's business logic
import { authManager } from "./lib/auth-manager";
import { apiClient } from "./lib/api-client";
import { propertyManager } from "./lib/property-manager";
import { pipelineManager } from "./lib/pipeline-manager";
import { listManager } from "./lib/list-manager";
import { workflowEngine } from "./lib/workflow-engine";
import { executeConfig, validateConfig, installTemplate } from "./lib/config-executor";
import { extractPortalConfig, clonePortal } from "./lib/portal-cloner";
import { changeLogger } from "./lib/change-logger";
import { mcpKeysStore } from "./lib/mcp-keys-store";
import { mcpOAuthStore } from "./lib/mcp-oauth-store";
import { startTunnel, stopTunnel, getCurrentTunnelUrl } from "./lib/tunnel-manager";

// ---------------------------------------------------------------------------
// Server setup
// ---------------------------------------------------------------------------

const server = new McpServer({
  name: "hubspot-operator",
  version: "1.0.0",
});

// ---------------------------------------------------------------------------
// Helper: get active portal or first available
// ---------------------------------------------------------------------------

function getPortalId(requested?: string): string {
  if (requested) return requested;
  const portals = authManager.listPortals();
  if (portals.length === 0) throw new Error("No HubSpot portals connected. Connect one in the app first.");
  if (portals.length > 1) {
    const portalList = portals.map((p) => `  - "${p.name}" (Hub ${p.hubId}, ${p.environment}) → portalId: "${p.id}"`).join("\n");
    throw new Error(
      `Multiple portals connected. You MUST specify a portalId to avoid cross-portal contamination.\n\nAvailable portals:\n${portalList}\n\nCall list_portals to see full details, then pass the correct portalId.`
    );
  }
  return portals[0].id;
}

async function withPortal<T>(portalId: string | undefined, fn: () => Promise<T>): Promise<T> {
  const id = getPortalId(portalId);
  return authManager.withPortal(id, fn);
}

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
    const portals = authManager.listPortals();
    const result = {
      portals: portals.map((p) => ({
        id: p.id,
        name: p.name,
        hubId: p.hubId,
        environment: p.environment,
        scopes: p.scopes,
        capabilities: p.capabilities,
      })),
      count: portals.length,
      ...(portals.length > 1 && {
        warning: "Multiple portals connected. You MUST pass portalId to every tool call. Never assume a default — always confirm with the user which portal they want to operate on.",
      }),
    };
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }
);

server.tool(
  "portal_capabilities",
  "Get the capabilities (granted scopes) for a specific portal",
  { portalId: z.string().optional().describe("Portal/Hub ID. Omit to use the first connected portal.") },
  async ({ portalId }) => {
    const id = getPortalId(portalId);
    const portal = authManager.getActivePortal(id);
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          id: portal.id,
          name: portal.name,
          hubId: portal.hubId,
          scopes: portal.scopes,
          capabilities: portal.capabilities,
          environment: portal.environment,
        }, null, 2),
      }],
    };
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
    return withPortal(portalId, async () => {
      const properties = await propertyManager.list(objectType);
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            objectType,
            count: properties.length,
            properties: properties.map((p) => ({
              name: p.name,
              label: p.label,
              type: p.type,
              fieldType: p.fieldType,
              groupName: p.groupName,
              description: p.description,
              hasUniqueValue: p.hasUniqueValue,
              hubspotDefined: p.hubspotDefined,
            })),
          }, null, 2),
        }],
      };
    });
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
    return withPortal(portalId, async () => {
      const result = await propertyManager.create(objectType, {
        name, label, type, fieldType, groupName, description, options,
      });
      return {
        content: [{ type: "text", text: JSON.stringify({ success: true, property: result }, null, 2) }],
      };
    });
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
    return withPortal(portalId, async () => {
      const result = await propertyManager.update(objectType, name, updates);
      return {
        content: [{ type: "text", text: JSON.stringify({ success: true, property: result }, null, 2) }],
      };
    });
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
    return withPortal(portalId, async () => {
      await propertyManager.delete(objectType, name);
      return {
        content: [{ type: "text", text: JSON.stringify({ success: true, deleted: name }) }],
      };
    });
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
    return withPortal(portalId, async () => {
      const audit = await propertyManager.audit(objectType);
      const deleteCandidates = audit.filter((a) => a.recommendation === "DELETE_CANDIDATE");
      const reviewNeeded = audit.filter((a) => a.recommendation === "REVIEW");
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            objectType,
            totalProperties: audit.length,
            deleteCandidates: deleteCandidates.length,
            reviewNeeded: reviewNeeded.length,
            ok: audit.length - deleteCandidates.length - reviewNeeded.length,
            details: audit,
          }, null, 2),
        }],
      };
    });
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
    return withPortal(portalId, async () => {
      const pipelines = await pipelineManager.list(objectType);
      return {
        content: [{ type: "text", text: JSON.stringify({ objectType, pipelines }, null, 2) }],
      };
    });
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
      metadata: z.record(z.string()).optional().describe("Stage metadata, e.g. { isClosed: 'true', closedWon: 'true' }"),
    })),
    portalId: z.string().optional(),
  },
  async ({ objectType, label, stages, portalId }) => {
    return withPortal(portalId, async () => {
      const result = await pipelineManager.create(objectType, { label, stages });
      return {
        content: [{ type: "text", text: JSON.stringify({ success: true, pipeline: result }, null, 2) }],
      };
    });
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
    return withPortal(portalId, async () => {
      const audit = await pipelineManager.audit(objectType);
      return {
        content: [{ type: "text", text: JSON.stringify({ objectType, audit }, null, 2) }],
      };
    });
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
    return withPortal(portalId, async () => {
      const record = await apiClient.crm.get(objectType, id, properties);
      return {
        content: [{ type: "text", text: JSON.stringify(record, null, 2) }],
      };
    });
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
    return withPortal(portalId, async () => {
      const allResults: unknown[] = [];
      const gen = apiClient.crm.search(objectType, [{ filters }], properties);
      for await (const page of gen) {
        allResults.push(...page);
        if (allResults.length >= 200) break; // Safety limit
      }
      return {
        content: [{
          type: "text",
          text: JSON.stringify({ objectType, count: allResults.length, results: allResults }, null, 2),
        }],
      };
    });
  }
);

server.tool(
  "create_record",
  "Create a new CRM record",
  {
    objectType: z.string(),
    properties: z.record(z.string()).describe("Property name-value pairs"),
    portalId: z.string().optional(),
  },
  async ({ objectType, properties, portalId }) => {
    return withPortal(portalId, async () => {
      const record = await apiClient.crm.create(objectType, properties);
      return {
        content: [{ type: "text", text: JSON.stringify({ success: true, record }, null, 2) }],
      };
    });
  }
);

server.tool(
  "update_record",
  "Update a CRM record",
  {
    objectType: z.string(),
    id: z.string(),
    properties: z.record(z.string()).describe("Property name-value pairs to update"),
    portalId: z.string().optional(),
  },
  async ({ objectType, id, properties, portalId }) => {
    return withPortal(portalId, async () => {
      const record = await apiClient.crm.update(objectType, id, properties);
      return {
        content: [{ type: "text", text: JSON.stringify({ success: true, record }, null, 2) }],
      };
    });
  }
);

server.tool(
  "batch_upsert_records",
  "Create or update records in batch (up to 100 per call). Uses email as dedup key for contacts.",
  {
    objectType: z.string(),
    records: z.array(z.record(z.string())).describe("Array of property objects"),
    idProperty: z.string().optional().describe("Property to use for dedup (e.g. 'email' for contacts)"),
    portalId: z.string().optional(),
  },
  async ({ objectType, records, idProperty, portalId }) => {
    return withPortal(portalId, async () => {
      const result = await apiClient.crm.batchUpsert(objectType, records, idProperty);
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            success: result.errors.length === 0,
            created_or_updated: result.successes.length,
            errors: result.errors,
          }, null, 2),
        }],
      };
    });
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
    return withPortal(portalId, async () => {
      const lists = await listManager.list();
      return {
        content: [{ type: "text", text: JSON.stringify({ count: lists.length, lists }, null, 2) }],
      };
    });
  }
);

server.tool(
  "create_list",
  "Create a new CRM list",
  {
    name: z.string(),
    objectTypeId: z.string().optional().describe("Default: 0-1 (contacts)"),
    processingType: z.enum(["DYNAMIC", "MANUAL"]).optional(),
    filterBranch: z.record(z.unknown()).optional().describe("Filter definition for dynamic lists"),
    portalId: z.string().optional(),
  },
  async ({ name, objectTypeId, processingType, filterBranch, portalId }) => {
    return withPortal(portalId, async () => {
      const result = await listManager.create({
        name,
        objectTypeId: objectTypeId || "0-1",
        processingType: processingType || "DYNAMIC",
        filterBranch,
      });
      return {
        content: [{ type: "text", text: JSON.stringify({ success: true, list: result }, null, 2) }],
      };
    });
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
    return withPortal(portalId, async () => {
      const workflows = await workflowEngine.list();
      return {
        content: [{
          type: "text",
          text: JSON.stringify({ count: workflows.length, workflows: workflows.map((w: Record<string, unknown>) => ({
            id: w.flowId || w.id,
            name: w.name,
            type: w.type,
            isEnabled: w.isEnabled,
          })) }, null, 2),
        }],
      };
    });
  }
);

server.tool(
  "save_workflow_draft",
  "Save a workflow spec as a local draft (does NOT deploy to HubSpot). Checks for duplicate workflows in portal and existing drafts. Deploy it later from the app UI or via deploy_workflow.",
  {
    workflow: z.record(z.unknown()).describe("Full workflow definition matching HubSpot v4 format"),
    portalId: z.string().optional(),
  },
  async ({ workflow, portalId }) => {
    const id = getPortalId(portalId);
    const name = String(workflow.name || "Untitled Workflow");
    const { saveDraft, findDraftConflicts } = await import("./lib/draft-store");

    // Check existing drafts
    const draftConflicts = findDraftConflicts(id, "workflow_draft", name);

    // Check existing workflows in portal
    const portalConflicts: { name: string; match: "exact" | "similar" }[] = [];
    try {
      const existing = await withPortal(id, () => workflowEngine.list());
      const nameNorm = name.toLowerCase().trim();
      for (const w of existing) {
        const wName = (w.name || "").toLowerCase().trim();
        if (wName === nameNorm) portalConflicts.push({ name: w.name || "", match: "exact" });
        else if (wName.includes(nameNorm) || nameNorm.includes(wName)) portalConflicts.push({ name: w.name || "", match: "similar" });
      }
    } catch { /* portal may not be reachable — save draft anyway */ }

    const draft = saveDraft(id, "workflow_draft", name, workflow as Record<string, unknown>);
    return {
      content: [{ type: "text", text: JSON.stringify({
        success: true, draftId: draft.id, name,
        message: "Draft saved. Deploy it from the Workflows page in the app.",
        ...(draftConflicts.length > 0 && { warning_draft_duplicates: draftConflicts, warning: `Found ${draftConflicts.length} existing draft(s) with the same name.` }),
        ...(portalConflicts.length > 0 && { warning_portal_duplicates: portalConflicts, warning_portal: `Found ${portalConflicts.length} existing workflow(s) in portal with matching name.` }),
      }, null, 2) }],
    };
  }
);

server.tool(
  "deploy_workflow",
  "Deploy a new workflow (always created disabled for safety). Use the v4 action format.",
  {
    workflow: z.record(z.unknown()).describe("Full workflow definition matching HubSpot v4 format"),
    portalId: z.string().optional(),
  },
  async ({ workflow, portalId }) => {
    return withPortal(portalId, async () => {
      const result = await workflowEngine.deploy(workflow as never);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    });
  }
);

// ---------------------------------------------------------------------------
// Draft Tools — save specs locally, deploy later from app UI
// ---------------------------------------------------------------------------

server.tool(
  "save_pipeline_draft",
  "Save a pipeline spec as a local draft (does NOT deploy to HubSpot). Checks for duplicate pipelines in portal and existing drafts.",
  {
    spec: z.record(z.unknown()).describe("Pipeline definition with label, stages, objectType"),
    name: z.string().optional(),
    portalId: z.string().optional(),
  },
  async ({ spec, name, portalId }) => {
    const id = getPortalId(portalId);
    const { saveDraft, findDraftConflicts } = await import("./lib/draft-store");
    const draftName = name || String(spec.label || spec.name || "Untitled Pipeline");

    const draftConflicts = findDraftConflicts(id, "pipeline_draft", draftName, String(spec.label || ""));
    const portalConflicts: { name: string; label?: string; match: "exact" | "similar" }[] = [];
    try {
      const objType = String(spec.objectType || "deals");
      const existing = await withPortal(id, () => pipelineManager.list(objType as "deals" | "tickets"));
      const labelNorm = (String(spec.label || draftName)).toLowerCase().trim();
      for (const p of existing) {
        const pLabel = (p.label || "").toLowerCase().trim();
        if (pLabel === labelNorm) portalConflicts.push({ name: p.id || "", label: p.label || "", match: "exact" });
        else if (pLabel.includes(labelNorm) || labelNorm.includes(pLabel)) portalConflicts.push({ name: p.id || "", label: p.label || "", match: "similar" });
      }
    } catch { /* portal may not be reachable */ }

    const draft = saveDraft(id, "pipeline_draft", draftName, spec as Record<string, unknown>);
    return { content: [{ type: "text", text: JSON.stringify({
      success: true, draftId: draft.id, name: draftName,
      message: "Draft saved. Deploy from Pipelines page.",
      ...(draftConflicts.length > 0 && { warning_draft_duplicates: draftConflicts, warning: `Found ${draftConflicts.length} existing draft(s) with the same name.` }),
      ...(portalConflicts.length > 0 && { warning_portal_duplicates: portalConflicts, warning_portal: `Found ${portalConflicts.length} existing pipeline(s) in portal with matching label.` }),
    }, null, 2) }] };
  }
);

server.tool(
  "save_property_draft",
  "Save a property spec as a local draft (does NOT create in HubSpot). Checks for duplicate properties in portal and existing drafts.",
  {
    spec: z.record(z.unknown()).describe("Property definition with name, label, type, fieldType, objectType"),
    name: z.string().optional(),
    portalId: z.string().optional(),
  },
  async ({ spec, name, portalId }) => {
    const id = getPortalId(portalId);
    const { saveDraft, findDraftConflicts } = await import("./lib/draft-store");
    const draftName = name || String(spec.label || spec.name || "Untitled Property");
    const internalName = String(spec.name || "");

    const draftConflicts = findDraftConflicts(id, "property_draft", draftName, internalName);
    const portalConflicts: { name: string; label?: string; match: "exact" | "similar" }[] = [];
    try {
      const objType = String(spec.objectType || "contacts");
      const existing = await withPortal(id, () => propertyManager.list(objType));
      const nameNorm = internalName.toLowerCase().trim();
      for (const p of existing) {
        if (p.name.toLowerCase() === nameNorm) portalConflicts.push({ name: p.name, label: p.label, match: "exact" });
      }
    } catch { /* portal may not be reachable */ }

    const draft = saveDraft(id, "property_draft", draftName, spec as Record<string, unknown>);
    return { content: [{ type: "text", text: JSON.stringify({
      success: true, draftId: draft.id, name: draftName,
      message: "Draft saved. Deploy from Properties page.",
      ...(draftConflicts.length > 0 && { warning_draft_duplicates: draftConflicts, warning: `Found ${draftConflicts.length} existing draft(s) with the same name.` }),
      ...(portalConflicts.length > 0 && { warning_portal_duplicates: portalConflicts, warning_portal: `Property "${internalName}" already exists in portal on ${spec.objectType}. Deploying will fail — update the existing property instead.` }),
    }, null, 2) }] };
  }
);

server.tool(
  "save_list_draft",
  "Save a list/segment spec as a local draft (does NOT create in HubSpot). Checks for duplicate lists in portal and existing drafts.",
  {
    spec: z.record(z.unknown()).describe("List definition with name, objectTypeId, processingType, optional filterBranch"),
    name: z.string().optional(),
    portalId: z.string().optional(),
  },
  async ({ spec, name, portalId }) => {
    const id = getPortalId(portalId);
    const { saveDraft, findDraftConflicts } = await import("./lib/draft-store");
    const draftName = name || String(spec.name || "Untitled List");

    const draftConflicts = findDraftConflicts(id, "list_draft", draftName, String(spec.name || ""));
    const portalConflicts: { name: string; match: "exact" | "similar" }[] = [];
    try {
      const existing = await withPortal(id, () => listManager.list());
      const nameNorm = draftName.toLowerCase().trim();
      for (const l of existing) {
        const lName = (l.name || "").toLowerCase().trim();
        if (lName === nameNorm) portalConflicts.push({ name: l.name || "", match: "exact" });
        else if (lName.includes(nameNorm) || nameNorm.includes(lName)) portalConflicts.push({ name: l.name || "", match: "similar" });
      }
    } catch { /* portal may not be reachable */ }

    const draft = saveDraft(id, "list_draft", draftName, spec as Record<string, unknown>);
    return { content: [{ type: "text", text: JSON.stringify({
      success: true, draftId: draft.id, name: draftName,
      message: "Draft saved. Deploy from Lists page.",
      ...(draftConflicts.length > 0 && { warning_draft_duplicates: draftConflicts, warning: `Found ${draftConflicts.length} existing draft(s) with the same name.` }),
      ...(portalConflicts.length > 0 && { warning_portal_duplicates: portalConflicts, warning_portal: `Found ${portalConflicts.length} existing list(s) in portal with matching name. List names must be unique — deploying will fail.` }),
    }, null, 2) }] };
  }
);

server.tool(
  "save_template_draft",
  "Save a template/config spec as a local draft (does NOT install to HubSpot). Checks for duplicate drafts.",
  {
    spec: z.record(z.unknown()).describe("Template definition with resources (propertyGroups, properties, pipelines, workflows, lists, customObjects, associations)"),
    name: z.string().optional(),
    portalId: z.string().optional(),
  },
  async ({ spec, name, portalId }) => {
    const id = getPortalId(portalId);
    const { saveDraft, findDraftConflicts } = await import("./lib/draft-store");
    const draftName = name || String(spec.name || spec.id || "Untitled Template");
    const draftConflicts = findDraftConflicts(id, "template_draft", draftName);
    const draft = saveDraft(id, "template_draft", draftName, spec as Record<string, unknown>);
    return { content: [{ type: "text", text: JSON.stringify({
      success: true, draftId: draft.id, name: draftName,
      message: "Draft saved. Deploy from Templates page.",
      ...(draftConflicts.length > 0 && { warning_draft_duplicates: draftConflicts, warning: `Found ${draftConflicts.length} existing draft(s) with the same name.` }),
    }, null, 2) }] };
  }
);

server.tool(
  "save_script_draft",
  "Save a bulk operation script as a local draft (does NOT execute). Checks for duplicate drafts.",
  {
    spec: z.record(z.unknown()).describe("Script definition with code, description"),
    name: z.string().optional(),
    portalId: z.string().optional(),
  },
  async ({ spec, name, portalId }) => {
    const id = getPortalId(portalId);
    const { saveDraft, findDraftConflicts } = await import("./lib/draft-store");
    const draftName = name || String(spec.description || spec.name || "Untitled Script");
    const draftConflicts = findDraftConflicts(id, "bulk_draft", draftName);
    const draft = saveDraft(id, "bulk_draft", draftName, spec as Record<string, unknown>);
    return { content: [{ type: "text", text: JSON.stringify({
      success: true, draftId: draft.id, name: draftName,
      message: "Draft saved. Deploy from Bulk Operations page.",
      ...(draftConflicts.length > 0 && { warning_draft_duplicates: draftConflicts, warning: `Found ${draftConflicts.length} existing draft(s) with the same name.` }),
    }, null, 2) }] };
  }
);

server.tool(
  "save_clone_draft",
  "Save a portal clone configuration as a local draft (does NOT execute the clone). Checks for duplicate drafts.",
  {
    spec: z.record(z.unknown()).describe("Clone config with sourcePortalId, targetPortalId, options, extractedTemplate"),
    name: z.string().optional(),
    portalId: z.string().optional(),
  },
  async ({ spec, name, portalId }) => {
    const id = getPortalId(portalId);
    const { saveDraft, findDraftConflicts } = await import("./lib/draft-store");
    const draftName = name || String(spec.name || "Untitled Clone Config");
    const draftConflicts = findDraftConflicts(id, "clone_draft", draftName);
    const draft = saveDraft(id, "clone_draft", draftName, spec as Record<string, unknown>);
    return { content: [{ type: "text", text: JSON.stringify({
      success: true, draftId: draft.id, name: draftName,
      message: "Draft saved. Deploy from Clone page.",
      ...(draftConflicts.length > 0 && { warning_draft_duplicates: draftConflicts, warning: `Found ${draftConflicts.length} existing draft(s) with the same name.` }),
    }, null, 2) }] };
  }
);

server.tool(
  "save_custom_object_draft",
  "Save a custom object spec as a local draft (does NOT create in HubSpot). Checks for duplicate drafts.",
  {
    spec: z.record(z.unknown()).describe("Custom object definition with name, labels, properties, primaryDisplayProperty"),
    name: z.string().optional(),
    portalId: z.string().optional(),
  },
  async ({ spec, name, portalId }) => {
    const id = getPortalId(portalId);
    const { saveDraft, findDraftConflicts } = await import("./lib/draft-store");
    const draftName = name || String(spec.name || "Untitled Custom Object");
    const draftConflicts = findDraftConflicts(id, "custom_object_draft", draftName);
    const draft = saveDraft(id, "custom_object_draft", draftName, spec as Record<string, unknown>);
    return { content: [{ type: "text", text: JSON.stringify({
      success: true, draftId: draft.id, name: draftName,
      message: "Draft saved. Deploy from Custom Objects section.",
      ...(draftConflicts.length > 0 && { warning_draft_duplicates: draftConflicts, warning: `Found ${draftConflicts.length} existing draft(s) with the same name.` }),
    }, null, 2) }] };
  }
);

// ---------------------------------------------------------------------------
// Config Engine Tools (Templates)
// ---------------------------------------------------------------------------

server.tool(
  "validate_config",
  "Validate a Config Engine template payload without executing it",
  {
    resources: z.record(z.unknown()).describe("TemplateResources object with propertyGroups, properties, pipelines, workflows, lists, customObjects, associations"),
  },
  async ({ resources }) => {
    const result = validateConfig(resources as never);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }
);

server.tool(
  "execute_config",
  "Execute a Config Engine template — creates all resources (properties, pipelines, workflows, lists) in dependency order",
  {
    resources: z.record(z.unknown()).describe("TemplateResources object"),
    dryRun: z.boolean().optional().describe("If true, validates and resolves dependencies without creating anything"),
    portalId: z.string().optional(),
  },
  async ({ resources, dryRun, portalId }) => {
    const id = getPortalId(portalId);
    const report = await executeConfig(id, resources as never, { dryRun });
    return {
      content: [{ type: "text", text: JSON.stringify(report, null, 2) }],
    };
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
    const id = getPortalId(portalId);
    const report = await installTemplate(templateId, id, { dryRun });
    return {
      content: [{ type: "text", text: JSON.stringify(report, null, 2) }],
    };
  }
);

// ---------------------------------------------------------------------------
// Portal Cloning Tools
// ---------------------------------------------------------------------------

server.tool(
  "extract_portal_config",
  "Extract all custom configuration (properties, pipelines, lists) from a portal as a template",
  {
    portalId: z.string(),
    includeProperties: z.boolean().optional().describe("Default: true"),
    includePipelines: z.boolean().optional().describe("Default: true"),
    includeLists: z.boolean().optional().describe("Default: true"),
  },
  async ({ portalId, includeProperties, includePipelines, includeLists }) => {
    const config = await extractPortalConfig(portalId, {
      properties: includeProperties ?? true,
      pipelines: includePipelines ?? true,
      lists: includeLists ?? true,
    });
    return {
      content: [{ type: "text", text: JSON.stringify(config, null, 2) }],
    };
  }
);

server.tool(
  "clone_portal",
  "Clone configuration from one portal to another (dry-run by default)",
  {
    sourcePortalId: z.string(),
    targetPortalId: z.string(),
    dryRun: z.boolean().optional().describe("Default: true — preview without applying"),
  },
  async ({ sourcePortalId, targetPortalId, dryRun }) => {
    const result = await clonePortal(sourcePortalId, targetPortalId, {}, dryRun ?? true);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
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
    const id = getPortalId(portalId);
    const allEntries = await changeLogger.getLog(id);
    const entries = allEntries.slice(0, limit || 50);
    return {
      content: [{ type: "text", text: JSON.stringify({ count: entries.length, entries }, null, 2) }],
    };
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
    return withPortal(portalId, async () => {
      const result = await apiClient.associations.create(fromType, fromId, toType, toId);
      return {
        content: [{ type: "text", text: JSON.stringify({ success: true, result: result.data }, null, 2) }],
      };
    });
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
    return withPortal(portalId, async () => {
      const result = await apiClient.associations.batchCreate(fromType, toType, pairs);
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            success: result.errors.length === 0,
            created: result.successes.length,
            errors: result.errors,
          }, null, 2),
        }],
      };
    });
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
// Auth check — validates Bearer token against database-stored MCP API keys
// Keys are managed via the UI at /settings → MCP Connections
// ---------------------------------------------------------------------------

function checkAuth(req: IncomingMessage, res: ServerResponse): boolean {
  // Check if any keys or OAuth clients exist
  const allKeys = mcpKeysStore.list();
  const allClients = mcpOAuthStore.listClients();
  const hasKeys = allKeys.some((k) => k.is_active);
  const hasClients = allClients.some((c) => c.is_active);

  // If nothing created yet, allow access (first-time setup)
  if (!hasKeys && !hasClients) return true;

  // Build WWW-Authenticate header for 401 responses (RFC 9728)
  const baseUrl = getPublicBaseUrl(req);
  const wwwAuth = `Bearer resource_metadata="${baseUrl}/.well-known/oauth-protected-resource"`;

  const authHeader = req.headers["authorization"];
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.writeHead(401, {
      "Content-Type": "application/json",
      "WWW-Authenticate": wwwAuth,
    });
    res.end(JSON.stringify({
      error: "Unauthorized",
      hint: "Create an API key or OAuth client in Settings → MCP Connections",
    }));
    return false;
  }

  const token = authHeader.slice(7);

  // 1. Check against MCP API keys (mcp_xxx)
  const validKey = mcpKeysStore.validate(token);
  if (validKey) {
    console.error(`[Auth] API key: ${validKey.label} (${validKey.platform})`);
    return true;
  }

  // 2. Check against OAuth access tokens (mct_xxx)
  const validClient = mcpOAuthStore.validateToken(token);
  if (validClient) {
    console.error(`[Auth] OAuth: ${validClient.label} (${validClient.platform})`);
    return true;
  }

  res.writeHead(401, {
    "Content-Type": "application/json",
    "WWW-Authenticate": wwwAuth,
  });
  res.end(JSON.stringify({ error: "invalid_token", error_description: "Invalid or revoked API key / token" }));
  return false;
}

// ---------------------------------------------------------------------------
// Helper: resolve the public base URL (tunnel or request host)
// ---------------------------------------------------------------------------

function getPublicBaseUrl(req: IncomingMessage): string {
  // Prefer the tunnel URL if available
  const tunnelUrl = getCurrentTunnelUrl();
  if (tunnelUrl) return tunnelUrl;

  // Fall back to request headers
  const proto = (req.headers["x-forwarded-proto"] as string) || "http";
  const host = req.headers["host"] || `localhost:${HTTP_PORT}`;
  return `${proto}://${host}`;
}

// ---------------------------------------------------------------------------
// CORS helper
// ---------------------------------------------------------------------------

function setCorsHeaders(req: IncomingMessage, res: ServerResponse): void {
  const origin = req.headers["origin"] || "";
  // Allow claude.ai, claude.com, and any origin (for local dev)
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
  if (!httpMode) {
    // ── STDIO mode (Claude Code, local clients) ──────────────────────────
    const transport = new StdioServerTransport();
    await server.connect(transport);
    return;
  }

  // ── HTTP mode (ChatGPT, remote clients) ──────────────────────────────
  // Stores active transports by session ID
  const transports: Record<string, SSEServerTransport | StreamableHTTPServerTransport> = {};

  const httpServer = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
    const pathname = url.pathname;

    setCorsHeaders(req, res);

    // Log every request for debugging
    console.error(`[HTTP] ${req.method} ${pathname}${url.search || ""} (${req.headers["user-agent"]?.slice(0, 40) || "no-ua"})`);

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
        version: "1.0.0",
        activeSessions: Object.keys(transports).length,
        tunnelUrl: getCurrentTunnelUrl(),
      }));
      return;
    }

    // ── OAuth 2.1 Endpoints ────────────────────────────────────────────

    // Protected Resource Metadata: RFC 9728 (required by MCP June 2025 spec)
    if (pathname === "/.well-known/oauth-protected-resource" && req.method === "GET") {
      console.error(`[OAuth] Protected Resource Metadata request from ${req.headers["user-agent"] || "unknown"}`);
      const baseUrl = getPublicBaseUrl(req);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        resource: baseUrl,
        authorization_servers: [baseUrl],
        scopes_supported: ["mcp"],
        bearer_methods_supported: ["header"],
      }));
      return;
    }

    // Discovery: RFC 8414
    if (pathname === "/.well-known/oauth-authorization-server" && req.method === "GET") {
      console.error(`[OAuth] Discovery request from ${req.headers["user-agent"] || "unknown"}`);
      const baseUrl = getPublicBaseUrl(req);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        issuer: baseUrl,
        authorization_endpoint: `${baseUrl}/authorize`,
        token_endpoint: `${baseUrl}/token`,
        registration_endpoint: `${baseUrl}/register`,
        response_types_supported: ["code"],
        grant_types_supported: ["authorization_code", "refresh_token"],
        code_challenge_methods_supported: ["S256"],
        token_endpoint_auth_methods_supported: ["client_secret_post", "client_secret_basic"],
        scopes_supported: ["mcp"],
      }));
      return;
    }

    // Dynamic Client Registration (RFC 7591)
    if (pathname === "/register" && req.method === "POST") {
      try {
        const body = await readBody(req) as Record<string, unknown>;
        console.error(`[OAuth] Registration request:`, JSON.stringify(body));
        const clientName = (body.client_name as string) || "Dynamic Client";
        const redirectUris = (body.redirect_uris as string[]) || [];
        const grantTypes = (body.grant_types as string[]) || ["authorization_code"];

        // Determine platform from client name
        const platform = clientName.toLowerCase().includes("claude") ? "claude_desktop" : "other";

        // Create a new client for dynamic registration
        const client = mcpOAuthStore.createClient(clientName, platform);

        // Accept whatever redirect_uris the client specifies (Claude uses claude.ai callback)
        const effectiveRedirectUris = redirectUris.length > 0 ? redirectUris : client.redirect_uris;

        res.writeHead(201, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
          client_id: client.client_id,
          client_secret: client.client_secret,
          client_name: clientName,
          redirect_uris: effectiveRedirectUris,
          grant_types: grantTypes,
          response_types: ["code"],
          token_endpoint_auth_method: "client_secret_post",
        }));
        console.error(`[OAuth] Client registered: ${client.client_id} (${clientName}) redirects=${JSON.stringify(effectiveRedirectUris)}`);
      } catch (err) {
        console.error(`[OAuth] Registration error:`, (err as Error).message);
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "invalid_request" }));
      }
      return;
    }

    // Authorization endpoint
    if (pathname === "/authorize" && (req.method === "GET" || req.method === "POST")) {
      console.error(`[OAuth] Authorization request (${req.method}): ${url.search}`);

      // Support both GET params and POST body
      let clientId = url.searchParams.get("client_id");
      let responseType = url.searchParams.get("response_type");
      let redirectUri = url.searchParams.get("redirect_uri") || "";
      let state = url.searchParams.get("state") || "";
      let codeChallenge = url.searchParams.get("code_challenge") || "";
      let codeChallengeMethod = url.searchParams.get("code_challenge_method") || "S256";
      let scope = url.searchParams.get("scope") || "";
      let resource = url.searchParams.get("resource") || "";

      // If POST, parse the body too
      if (req.method === "POST") {
        const body = await readBody(req) as Record<string, string>;
        clientId = clientId || body.client_id || "";
        responseType = responseType || body.response_type || "";
        redirectUri = redirectUri || body.redirect_uri || "";
        state = state || body.state || "";
        codeChallenge = codeChallenge || body.code_challenge || "";
        codeChallengeMethod = codeChallengeMethod || body.code_challenge_method || "S256";
        scope = scope || body.scope || "";
        resource = resource || body.resource || "";
      }

      console.error(`[OAuth] Auth params: client_id=${clientId}, response_type=${responseType}, redirect_uri=${redirectUri}, has_challenge=${!!codeChallenge}, scope=${scope}, resource=${resource}`);

      if (!clientId || responseType !== "code" || !codeChallenge) {
        console.error(`[OAuth] Auth error: missing params — client_id=${!!clientId}, response_type=${responseType}, code_challenge=${!!codeChallenge}`);
        res.writeHead(400, { "Content-Type": "text/html" });
        res.end("<h1>Bad Request</h1><p>Missing required OAuth parameters (client_id, response_type=code, code_challenge).</p>");
        return;
      }

      const client = mcpOAuthStore.getClientById(clientId);
      if (!client) {
        res.writeHead(400, { "Content-Type": "text/html" });
        res.end("<h1>Unknown Client</h1><p>No OAuth client found with this client_id. Create one in Settings → MCP Connections.</p>");
        return;
      }

      // Auto-approve: since the user already created and controls the OAuth client
      // from the Settings UI, we auto-approve the authorization.
      // This is safe because:
      // 1. The client_id+client_secret were created by the user
      // 2. PKCE ensures the code can only be exchanged by the original requester
      const code = mcpOAuthStore.createAuthCode(clientId, codeChallenge, codeChallengeMethod, redirectUri);

      // Redirect back with the code
      // Note: redirect_uri may use custom schemes (e.g. claude://callback)
      // which NodeURL can't parse, so we build the redirect manually
      const separator = redirectUri.includes("?") ? "&" : "?";
      let redirectLocation = `${redirectUri}${separator}code=${encodeURIComponent(code)}`;
      if (state) redirectLocation += `&state=${encodeURIComponent(state)}`;

      res.writeHead(302, { Location: redirectLocation });
      res.end();
      console.error(`[OAuth] Authorization code issued for: ${client.label} → ${redirectUri}`);
      return;
    }

    // Token endpoint
    if (pathname === "/token" && req.method === "POST") {
      try {
        const body = await readBody(req) as Record<string, string>;

        // Extract client credentials from Basic auth header OR body
        let clientId = body.client_id || "";
        let clientSecret = body.client_secret || "";

        const authHeader = req.headers["authorization"];
        if (authHeader && authHeader.startsWith("Basic ")) {
          const decoded = Buffer.from(authHeader.slice(6), "base64").toString("utf-8");
          const colonIdx = decoded.indexOf(":");
          if (colonIdx > 0) {
            clientId = decodeURIComponent(decoded.slice(0, colonIdx));
            clientSecret = decodeURIComponent(decoded.slice(colonIdx + 1));
          }
        }

        const grantType = body.grant_type;
        const code = body.code;
        const codeVerifier = body.code_verifier;
        const redirectUri = body.redirect_uri || "";
        const resource = body.resource || "";

        console.error(`[OAuth] Token request: grant_type=${grantType}, client_id=${clientId}, has_code=${!!code}, has_verifier=${!!codeVerifier}, has_secret=${!!clientSecret}, resource=${resource}, auth_method=${authHeader ? (authHeader.startsWith("Basic") ? "basic" : "bearer") : "body"}, content-type=${req.headers["content-type"]}`);

        if (grantType !== "authorization_code" && grantType !== "refresh_token") {
          console.error(`[OAuth] Token error: unsupported_grant_type (${grantType})`);
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "unsupported_grant_type" }));
          return;
        }

        // Handle refresh_token grant
        if (grantType === "refresh_token") {
          // We don't issue refresh tokens yet — return error
          console.error(`[OAuth] Token error: refresh_token not yet supported`);
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "invalid_grant", error_description: "Refresh tokens not supported yet" }));
          return;
        }

        if (!code || !clientId || !codeVerifier) {
          console.error(`[OAuth] Token error: missing params — code=${!!code}, clientId=${!!clientId}, codeVerifier=${!!codeVerifier}`);
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "invalid_request", error_description: "Missing code, client_id, or code_verifier" }));
          return;
        }

        // Validate client credentials if provided
        if (clientSecret) {
          const valid = mcpOAuthStore.validateClient(clientId, clientSecret);
          if (!valid) {
            console.error(`[OAuth] Token error: invalid_client (secret mismatch for ${clientId})`);
            res.writeHead(401, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "invalid_client" }));
            return;
          }
        }

        // Exchange code for token (validates PKCE)
        const result = mcpOAuthStore.exchangeCode(code, clientId, codeVerifier, redirectUri);
        if (!result) {
          console.error(`[OAuth] Token error: invalid_grant (code exchange failed for ${clientId})`);
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "invalid_grant", error_description: "Invalid, expired, or already-used authorization code, or PKCE mismatch" }));
          return;
        }

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
          access_token: result.access_token,
          token_type: "Bearer",
          expires_in: result.expires_in,
          scope: "mcp",
        }));

        const client = mcpOAuthStore.getClientById(clientId);
        console.error(`[OAuth] Token issued for: ${client?.label || clientId}`);
      } catch (err) {
        console.error(`[OAuth] Token error: exception —`, (err as Error).message);
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "invalid_request" }));
      }
      return;
    }

    // ── Streamable HTTP endpoint: /mcp (protocol version 2025-11-25) ───
    if (pathname === "/mcp") {
      if (!checkAuth(req, res)) return;

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
          // Read body for initialization check
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
          // Handle the request (pass parsed body)
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
      } catch (err) {
        if (!res.headersSent) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ jsonrpc: "2.0", error: { code: -32603, message: "Internal server error" }, id: null }));
        }
      }
      return;
    }

    // ── SSE endpoint: /sse (protocol version 2024-11-05 — ChatGPT) ─────
    if (pathname === "/sse" && req.method === "GET") {
      if (!checkAuth(req, res)) return;

      const transport = new SSEServerTransport("/messages", res);
      transports[transport.sessionId] = transport;
      res.on("close", () => { delete transports[transport.sessionId]; });

      const newServer = createMcpServerInstance();
      await newServer.connect(transport);
      return;
    }

    // ── SSE message endpoint: /messages (POST) ─────────────────────────
    if (pathname === "/messages" && req.method === "POST") {
      if (!checkAuth(req, res)) return;

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

    // ── Root endpoint — server info ──────────────────────────────────
    if (pathname === "/" && req.method === "GET") {
      const baseUrl = getPublicBaseUrl(req);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        name: "hubspot-operator-mcp",
        version: "1.0.0",
        mcp: {
          sse: `${baseUrl}/sse`,
          streamable: `${baseUrl}/mcp`,
          oauth_protected_resource: `${baseUrl}/.well-known/oauth-protected-resource`,
          oauth_discovery: `${baseUrl}/.well-known/oauth-authorization-server`,
        },
      }));
      return;
    }

    // ── 404 ────────────────────────────────────────────────────────────
    console.error(`[404] ${req.method} ${pathname}`);
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      error: "Not found",
      endpoints: {
        "/.well-known/oauth-protected-resource": "GET — Protected Resource Metadata (RFC 9728)",
        "/.well-known/oauth-authorization-server": "GET — OAuth discovery (RFC 8414)",
        "/register": "POST — Dynamic client registration (RFC 7591)",
        "/authorize": "GET — OAuth authorization",
        "/token": "POST — OAuth token exchange",
        "/sse": "GET — SSE stream (ChatGPT / older MCP clients)",
        "/mcp": "POST — Streamable HTTP (newer MCP clients)",
        "/messages": "POST — SSE message endpoint (paired with /sse)",
        "/health": "GET — Health check",
      },
    }));
  });

  httpServer.listen(HTTP_PORT, async () => {
    console.error(`\n🔌 HubSpot Operator MCP Server (HTTP mode)`);
    console.error(`   Port:       ${HTTP_PORT}`);
    const keyCount = mcpKeysStore.list().filter(k => k.is_active).length;
    const clientCount = mcpOAuthStore.listClients().filter(c => c.is_active).length;
    console.error(`   Auth:       ${keyCount} API key(s), ${clientCount} OAuth client(s)`);
    console.error(`\n   Local Endpoints:`);
    console.error(`     SSE (ChatGPT):      http://localhost:${HTTP_PORT}/sse`);
    console.error(`     Streamable HTTP:    http://localhost:${HTTP_PORT}/mcp`);
    console.error(`     OAuth Discovery:    http://localhost:${HTTP_PORT}/.well-known/oauth-authorization-server`);
    console.error(`     Health:             http://localhost:${HTTP_PORT}/health`);

    // Auto-start Cloudflare tunnel
    const skipTunnel = args.includes("--no-tunnel");
    if (!skipTunnel) {
      console.error(`\n   🌐 Starting Cloudflare tunnel...`);
      try {
        const tunnelUrl = await startTunnel(HTTP_PORT);
        console.error(`   ✅ Tunnel ready: ${tunnelUrl}`);
        console.error(`\n   Public Endpoints:`);
        console.error(`     MCP Server URL:     ${tunnelUrl}/sse`);
        console.error(`     OAuth Discovery:    ${tunnelUrl}/.well-known/oauth-authorization-server`);
        console.error(`     Health:             ${tunnelUrl}/health`);
      } catch (err) {
        console.error(`   ⚠️  Tunnel failed: ${(err as Error).message}`);
        console.error(`   Continuing without tunnel — use --no-tunnel to suppress this.`);
      }
    }

    console.error(`\n   Manage connections: http://localhost:3000/settings (MCP Connections tab)\n`);
  });

  // Graceful shutdown
  process.on("SIGINT", async () => {
    console.error("\nShutting down...");
    stopTunnel();
    for (const sid of Object.keys(transports)) {
      try { await transports[sid].close(); } catch {}
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

        // Handle application/x-www-form-urlencoded (OAuth token requests)
        if (contentType.includes("application/x-www-form-urlencoded")) {
          const params = new URLSearchParams(raw);
          const obj: Record<string, string> = {};
          params.forEach((v, k) => { obj[k] = v; });
          resolve(obj);
          return;
        }

        // Default: JSON
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
  // In HTTP mode, each SSE/Streamable session gets its own McpServer instance
  // but they all share the same business logic (authManager, apiClient, etc.)
  // For simplicity, we reuse the global `server` for stdio mode
  // and create fresh instances for HTTP sessions.
  //
  // The tool registrations are identical — we call registerTools() on new instances.
  const s = new McpServer({ name: "hubspot-operator", version: "1.0.0" });
  registerTools(s);
  return s;
}

main().catch((err) => {
  console.error("MCP server failed:", err);
  process.exit(1);
});
