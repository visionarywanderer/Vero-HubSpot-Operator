/**
 * Shared MCP tool registration — used by both mcp-server.ts (STDIO/HTTP standalone)
 * and the embedded Next.js route handler (app/api/mcp/route.ts).
 *
 * All tool handlers call an `api()` function that is injected at registration time.
 * This allows the same tool definitions to proxy to either an external URL or localhost.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ApiOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  path: string;
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
}

export type ApiFn = <T = unknown>(opts: ApiOptions) => Promise<T>;

// ---------------------------------------------------------------------------
// PII redaction — strip sensitive data before returning to MCP clients
// ---------------------------------------------------------------------------

export function redactPII(text: string): string {
  return text
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, "{email}")
    .replace(/(?:\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}/g, "{phone}")
    .replace(/"(?:firstname|lastname|first_name|last_name)"\s*:\s*"[^"]*"/gi, (match) => {
      const key = match.split(":")[0];
      return `${key}: "{name}"`;
    });
}

/** Convenience: return MCP text content from any JSON-serializable value */
export function textResult(data: unknown) {
  return { content: [{ type: "text" as const, text: redactPII(JSON.stringify(data, null, 2)) }] };
}

// ---------------------------------------------------------------------------
// Tool registration
// ---------------------------------------------------------------------------

export function registerTools(server: McpServer, api: ApiFn): void {

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
  "set_active_portal",
  "Set the active portal for this session by name. Once set, all other tools (create_workflow, install_template, list_properties, etc.) will use this portal automatically — no need to pass portalId every time. Use list_portals first to see available portal names.",
  {
    portalName: z.string().describe("Portal name (case-insensitive, partial match supported). Use list_portals to see available names."),
  },
  async ({ portalName }) => {
    const data = await api({
      method: "POST",
      path: "/api/active-portal",
      body: { portalName },
    });
    return textResult(data);
  }
);

server.tool(
  "get_active_portal",
  "Get the currently active portal for this session, including its name, environment, and available scopes. Call this at the start of a session to confirm which portal is in context before making changes.",
  {},
  async () => {
    const data = await api({ path: "/api/active-portal" });
    return textResult(data);
  }
);

server.tool(
  "clear_active_portal",
  "Clear the active portal selection. After this, all tools will require an explicit portalId again.",
  {},
  async () => {
    const data = await api({ method: "DELETE", path: "/api/active-portal" });
    return textResult(data);
  }
);

server.tool(
  "portal_capabilities",
  "Get the capabilities (granted scopes) for a specific portal",
  { portalId: z.string().optional().describe("Portal/Hub ID. Omit to use the first connected portal.") },
  async ({ portalId }) => {
    const path = portalId ? `/api/portals/${encodeURIComponent(portalId)}/capabilities` : "/api/portals/capabilities";
    const data = await api({ path });
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
    portalId: z.string().optional().describe("Portal ID. Omit to use the active portal set via set_active_portal."),
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
    portalId: z.string().optional().describe("Portal ID. Omit to use the active portal set via set_active_portal."),
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
    portalId: z.string().optional().describe("Portal ID. Omit to use the active portal set via set_active_portal."),
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
    portalId: z.string().optional().describe("Portal ID. Omit to use the active portal set via set_active_portal."),
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
    portalId: z.string().optional().describe("Portal ID. Omit to use the active portal set via set_active_portal."),
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
    portalId: z.string().optional().describe("Portal ID. Omit to use the active portal set via set_active_portal."),
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
    portalId: z.string().optional().describe("Portal ID. Omit to use the active portal set via set_active_portal."),
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
    portalId: z.string().optional().describe("Portal ID. Omit to use the active portal set via set_active_portal."),
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
    portalId: z.string().optional().describe("Portal ID. Omit to use the active portal set via set_active_portal."),
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
    portalId: z.string().optional().describe("Portal ID. Omit to use the active portal set via set_active_portal."),
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
    portalId: z.string().optional().describe("Portal ID. Omit to use the active portal set via set_active_portal."),
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
    portalId: z.string().optional().describe("Portal ID. Omit to use the active portal set via set_active_portal."),
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
    portalId: z.string().optional().describe("Portal ID. Omit to use the active portal set via set_active_portal."),
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
    portalId: z.string().optional().describe("Portal ID. Omit to use the active portal set via set_active_portal."),
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
    portalId: z.string().optional().describe("Portal ID. Omit to use the active portal set via set_active_portal."),
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
  [
    "Deploy a new workflow to HubSpot (always created disabled for safety). Uses the v4 action format.",
    "",
    "PARTIAL INSTALL: If HubSpot rejects specific actions (e.g. unsupported action types like 0-9 or 0-11),",
    "the engine automatically strips those actions, re-links the remaining chain, and retries up to 5 times.",
    "The response will include a 'partial' report listing:",
    "  • installedActionIds — which actions were deployed successfully",
    "  • strippedActions   — which actions were removed and why",
    "  • manualSteps       — exact instructions for the user to complete manually in HubSpot UI",
    "",
    "When partial install occurs, ALWAYS surface the manualSteps to the user so they know what to do next.",
    "New failure patterns are automatically appended to hubspot-learnings so future installs can avoid them.",
  ].join("\n"),
  {
    workflow: z.record(z.string(), z.unknown()).describe("Full workflow definition matching HubSpot v4 format"),
    portalId: z.string().optional().describe("Portal ID. Omit to use the active portal set via set_active_portal."),
    allowPartial: z.boolean().optional().describe("If true (default), strip unsupported actions and retry instead of hard-failing."),
  },
  async ({ workflow, portalId, allowPartial }) => {
    const data = await api({
      method: "POST",
      path: "/api/workflows/deploy",
      body: { spec: workflow, portalId, allowPartial },
    });
    return textResult(data);
  }
);

server.tool(
  "get_workflow",
  [
    "Get the full spec of an existing workflow by its flow ID.",
    "Use this to reverse-engineer working workflow patterns when building new workflows.",
    "Returns the complete v4 workflow spec including enrollment criteria, actions, and branching.",
    "Useful for: finding correct field formats, understanding enrollment patterns,",
    "copying action structures from working workflows to fix deployment failures.",
  ].join("\n"),
  {
    flowId: z.string().describe("The workflow flow ID to retrieve"),
    portalId: z.string().optional().describe("Portal ID. Omit to use the active portal set via set_active_portal."),
  },
  async ({ flowId, portalId }) => {
    const data = await api({
      method: "GET",
      path: `/api/workflows/${flowId}`,
      query: portalId ? { portalId } : undefined,
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
    portalId: z.string().optional().describe("Portal ID. Omit to use the active portal set via set_active_portal."),
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
    portalId: z.string().optional().describe("Portal ID. Omit to use the active portal set via set_active_portal."),
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
    portalId: z.string().optional().describe("Portal ID. Omit to use the active portal set via set_active_portal."),
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
    portalId: z.string().optional().describe("Portal ID. Omit to use the active portal set via set_active_portal."),
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
    portalId: z.string().optional().describe("Portal ID. Omit to use the active portal set via set_active_portal."),
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
  [
    "Execute a Config Engine template — creates all resources (properties, pipelines, workflows, lists) in dependency order.",
    "",
    "PARTIAL INSTALL: Same as install_template — workflows use the partial-install engine.",
    "Check the response's top-level 'manualSteps' array and surface it to the user.",
  ].join("\n"),
  {
    resources: z.record(z.string(), z.unknown()).describe("TemplateResources object"),
    dryRun: z.boolean().optional().describe("If true, validates and resolves dependencies without creating anything"),
    portalId: z.string().optional().describe("Portal ID. Omit to use the active portal set via set_active_portal."),
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
  [
    "Install a saved template (properties, pipelines, lists, workflows) by ID.",
    "",
    "PARTIAL INSTALL: Workflows inside the template use the partial-install engine.",
    "If any workflow action type is unsupported on this portal, it is stripped automatically",
    "and the workflow is deployed with the remaining actions. The response includes:",
    "  • results[].status: 'partial' for affected workflows",
    "  • results[].strippedActions: which actions were removed",
    "  • manualSteps (top-level): aggregate list of manual completion steps",
    "",
    "ALWAYS show the top-level manualSteps to the user after a partial install so they",
    "know exactly which steps to complete in HubSpot UI.",
  ].join("\n"),
  {
    templateId: z.string(),
    dryRun: z.boolean().optional(),
    portalId: z.string().optional().describe("Portal ID. Omit to use the active portal set via set_active_portal."),
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
    portalId: z.string().optional().describe("Portal ID. Omit to use the active portal set via set_active_portal."),
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
    portalId: z.string().optional().describe("Portal ID. Omit to use the active portal set via set_active_portal."),
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
    portalId: z.string().optional().describe("Portal ID. Omit to use the active portal set via set_active_portal."),
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
