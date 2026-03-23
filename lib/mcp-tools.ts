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
    .replace(/(?:\+\d{1,3}[-.\s])\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}|\(\d{2,4}\)[-.\s]?\d{3,4}[-.\s]?\d{3,4}/g, "{phone}")
    .replace(/"(?:firstname|lastname|first_name|last_name)"\s*:\s*"[^"]*"/gi, (match) => {
      const key = match.split(":")[0];
      return `${key}: "{name}"`;
    });
}

/** Convenience: return MCP text content from any JSON-serializable value */
export function textResult(data: unknown) {
  return { content: [{ type: "text" as const, text: redactPII(JSON.stringify(data, null, 2)) }] };
}

/** Return MCP text content without PII redaction — for workflow specs that must stay deployable */
function rawTextResult(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
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
// List Member Management Tools
// ---------------------------------------------------------------------------

server.tool(
  "add_list_members",
  "Add records to a manual/static list by record IDs",
  {
    listId: z.string().describe("The list ID to add members to"),
    recordIds: z.array(z.string()).describe("Record IDs to add to the list"),
    portalId: z.string().optional().describe("Portal ID. Omit to use the active portal set via set_active_portal."),
  },
  async ({ listId, recordIds, portalId }) => {
    const data = await api({
      method: "PUT",
      path: `/api/lists/${encodeURIComponent(listId)}/memberships/add`,
      body: { recordIds, portalId },
    });
    return textResult(data);
  }
);

server.tool(
  "remove_list_members",
  "Remove records from a manual/static list by record IDs",
  {
    listId: z.string().describe("The list ID to remove members from"),
    recordIds: z.array(z.string()).describe("Record IDs to remove from the list"),
    portalId: z.string().optional().describe("Portal ID. Omit to use the active portal set via set_active_portal."),
  },
  async ({ listId, recordIds, portalId }) => {
    const data = await api({
      method: "PUT",
      path: `/api/lists/${encodeURIComponent(listId)}/memberships/remove`,
      body: { recordIds, portalId },
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
    "REQUIRED SPEC STRUCTURE:",
    '  name: string (prefix with "[VD] ")',
    "  type: CONTACT_FLOW (objectTypeId 0-1) or PLATFORM_FLOW (all other objects)",
    '  objectTypeId: "0-1" (contacts), "0-2" (companies), "0-3" (deals), "0-5" (tickets)',
    "  isEnabled: false (REQUIRED — safety enforcement)",
    '  startActionId: string ID of first action (e.g. "1")',
    "  nextAvailableActionId: STRING of (max actionId + 1)",
    "  enrollmentCriteria: { type: EVENT_BASED|LIST_BASED|MANUAL, ... }",
    "  actions: array of action objects",
    "",
    "ACTION FORMAT:",
    '  { actionId: "1", actionTypeId: "0-5", type: "SET_PROPERTY",',
    '    fields: [{ name: "propertyName", type: "STATIC_VALUE", staticValue: "my_prop" },',
    '            { name: "newValue", type: "STATIC_VALUE", staticValue: "value" }],',
    '    connection: { nextActionId: "2" } }',
    "",
    "ENROLLMENT (EVENT_BASED with property filter):",
    "  { type: EVENT_BASED, shouldReEnroll: false,",
    "    filterBranch: { filterBranchType: OR, filterBranchOperator: OR,",
    "      filterBranches: [{ filterBranchType: AND, filterBranchOperator: AND,",
    "        filters: [{ property: prop_name, operation: { operationType: STRING,",
    "          operator: IS_EQUAL_TO, value: target_value } }] }] } }",
    "",
    "ENUMERATION filter (values is array): operationType: ENUMERATION, operator: IS_ANY_OF, values: [val1, val2]",
    "MULTISTRING filter (value is singular): operationType: MULTISTRING, operator: CONTAINS, value: text",
    "",
    "COMMON ACTION TYPES: 0-1 (Delay, needs delta+time_unit), 0-3 (Create task, needs subject),",
    "  0-5 (Set property, needs propertyName+newValue fields), 0-8 (Internal email, needs user_ids+subject+body),",
    "  0-35 (Delay, alternate). AVOID: 0-9 (In-app notif, broken), 0-11 (Rotate owner, broken).",
    "  Use 0-5 with hubspot_owner_id instead of 0-11. Use 0-8 instead of 0-9.",
    "",
    "BRANCHING (IF_BRANCH):",
    '  { actionId: "2", type: "IF_BRANCH", filterBranch: { ... same as enrollment ... },',
    '    acceptActions: [{ actionId: "3", ... }], rejectActions: [{ actionId: "4", ... }] }',
    "",
    "LIST_BRANCH uses listBranches (NOT filterListBranches). defaultBranch MUST include nextActionId.",
    "",
    "PARTIAL INSTALL: If HubSpot rejects specific actions (e.g. unsupported action types),",
    "the engine strips those actions, re-links the chain, and retries up to 5 times.",
    "Response includes strippedActions + manualSteps — ALWAYS surface manualSteps to the user.",
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
    // Return unredacted so the spec stays deployable (owner IDs, emails, queue IDs intact)
    return rawTextResult(data);
  }
);

server.tool(
  "get_workflow_by_name",
  [
    "Find a workflow by name (case-insensitive partial match).",
    "Returns the matching workflow summary. Use get_workflow with the flowId to get the full spec.",
  ].join("\n"),
  {
    name: z.string().describe("Workflow name to search for (case-insensitive partial match)"),
    portalId: z.string().optional().describe("Portal ID. Omit to use the active portal set via set_active_portal."),
  },
  async ({ name, portalId }) => {
    const data = await api({
      method: "POST",
      path: "/api/workflows/search",
      body: { name, portalId },
    });
    return textResult(data);
  }
);

server.tool(
  "clone_workflow",
  [
    "Clone an existing workflow under a new name.",
    "Fetches the full spec of the source workflow, replaces the name,",
    "and deploys it as a new workflow (disabled). Useful for creating",
    "variations of working workflows.",
  ].join("\n"),
  {
    sourceFlowId: z.string().describe("Flow ID of the workflow to clone"),
    newName: z.string().describe("Name for the cloned workflow (should include [VD] prefix)"),
    portalId: z.string().optional().describe("Portal ID. Omit to use the active portal set via set_active_portal."),
  },
  async ({ sourceFlowId, newName, portalId }) => {
    const data = await api({
      method: "POST",
      path: "/api/workflows/clone",
      body: { sourceFlowId, newName, portalId },
    });
    return textResult(data);
  }
);

// ---------------------------------------------------------------------------
// Batch Delete Records Tool
// ---------------------------------------------------------------------------

server.tool(
  "batch_delete_records",
  "Delete (archive) CRM records in batch by IDs (up to 100 per call)",
  {
    objectType: z.string().describe("contacts, companies, deals, tickets, etc."),
    ids: z.array(z.string()).describe("Array of record IDs to delete"),
    portalId: z.string().optional().describe("Portal ID. Omit to use the active portal set via set_active_portal."),
  },
  async ({ objectType, ids, portalId }) => {
    const data = await api({
      method: "POST",
      path: "/api/records/batch-delete",
      body: { objectType, ids, portalId },
    });
    return textResult(data);
  }
);

// ---------------------------------------------------------------------------
// Template Export Tool (reverse-engineer portal → template)
// ---------------------------------------------------------------------------

server.tool(
  "export_portal_template",
  [
    "Export the current portal configuration as a reusable template.",
    "Reads custom properties, property groups, pipelines, lists, and workflows",
    "from the portal and generates a TemplateDefinition that can be saved and",
    "installed on another portal via install_template.",
  ].join("\n"),
  {
    name: z.string().describe("Name for the exported template"),
    objectTypes: z.array(z.string()).optional().describe("Object types to include (default: contacts, companies, deals, tickets)"),
    includeWorkflows: z.boolean().optional().describe("Include workflows in export (default: true)"),
    includeLists: z.boolean().optional().describe("Include lists in export (default: true)"),
    portalId: z.string().optional().describe("Portal ID. Omit to use the active portal set via set_active_portal."),
  },
  async ({ name, objectTypes, includeWorkflows, includeLists, portalId }) => {
    const data = await api({
      method: "POST",
      path: "/api/templates/export",
      body: { name, objectTypes, includeWorkflows, includeLists, portalId },
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

// ---------------------------------------------------------------------------
// Workflow Management Tools
// ---------------------------------------------------------------------------

server.tool(
  "enable_workflow",
  "Enable (activate) a workflow in HubSpot. The workflow will start enrolling records based on its trigger criteria. Use with caution — verify the workflow spec is correct before enabling.",
  {
    flowId: z.string().describe("The workflow flow ID to enable"),
    portalId: z.string().optional().describe("Portal ID. Omit to use the active portal."),
  },
  async ({ flowId, portalId }) => {
    const data = await api({
      method: "PUT",
      path: `/api/workflows/${encodeURIComponent(flowId)}`,
      body: { portalId, spec: { isEnabled: true } },
    });
    return textResult(data);
  }
);

server.tool(
  "disable_workflow",
  "Disable (deactivate) a workflow in HubSpot. The workflow will stop enrolling new records but won't affect currently enrolled records.",
  {
    flowId: z.string().describe("The workflow flow ID to disable"),
    portalId: z.string().optional().describe("Portal ID. Omit to use the active portal."),
  },
  async ({ flowId, portalId }) => {
    const data = await api({
      method: "PUT",
      path: `/api/workflows/${encodeURIComponent(flowId)}`,
      body: { portalId, spec: { isEnabled: false } },
    });
    return textResult(data);
  }
);

server.tool(
  "delete_workflow",
  "Permanently delete a workflow from HubSpot. This action cannot be undone. Requires confirmation text 'DELETE' to proceed.",
  {
    flowId: z.string().describe("The workflow flow ID to delete"),
    confirmationText: z.string().describe("Must be exactly 'DELETE' to confirm deletion"),
    portalId: z.string().optional().describe("Portal ID. Omit to use the active portal."),
  },
  async ({ flowId, confirmationText, portalId }) => {
    const data = await api({
      method: "DELETE",
      path: `/api/workflows/${encodeURIComponent(flowId)}`,
      body: { portalId, confirmationText },
    });
    return textResult(data);
  }
);

// ---------------------------------------------------------------------------
// Property Group Tools
// ---------------------------------------------------------------------------

server.tool(
  "list_property_groups",
  "List all property groups for a HubSpot object type",
  {
    objectType: z.string().describe("contacts, companies, deals, tickets, etc."),
    portalId: z.string().optional().describe("Portal ID. Omit to use the active portal."),
  },
  async ({ objectType, portalId }) => {
    const data = await api({
      path: "/api/properties/groups",
      query: { objectType, ...(portalId ? { portalId } : {}) },
    });
    return textResult(data);
  }
);

server.tool(
  "create_property_group",
  "Create a new property group on a HubSpot object type. Groups organize properties in the HubSpot UI.",
  {
    objectType: z.string().describe("contacts, companies, deals, tickets, etc."),
    name: z.string().describe("Internal group name (lowercase_snake_case)"),
    label: z.string().describe("Display label for the group"),
    displayOrder: z.number().optional().describe("Display order (default: 0)"),
    portalId: z.string().optional().describe("Portal ID. Omit to use the active portal."),
  },
  async ({ objectType, name, label, displayOrder, portalId }) => {
    const data = await api({
      method: "POST",
      path: "/api/properties/groups",
      body: { objectType, spec: { name, label, displayOrder }, portalId },
    });
    return textResult(data);
  }
);

// ---------------------------------------------------------------------------
// Pipeline Stage Tools
// ---------------------------------------------------------------------------

server.tool(
  "add_pipeline_stage",
  "Add a new stage to an existing pipeline",
  {
    objectType: z.enum(["deals", "tickets"]),
    pipelineId: z.string().describe("Pipeline ID"),
    label: z.string().describe("Stage display name"),
    displayOrder: z.number().optional().describe("Position in the pipeline"),
    metadata: z.record(z.string(), z.string()).optional().describe("Stage metadata, e.g. { probability: '0.5', isClosed: 'true', closedWon: 'true' }"),
    portalId: z.string().optional().describe("Portal ID. Omit to use the active portal."),
  },
  async ({ objectType, pipelineId, label, displayOrder, metadata, portalId }) => {
    const data = await api({
      method: "POST",
      path: `/api/pipelines/${objectType}/${encodeURIComponent(pipelineId)}/stages`,
      body: { label, displayOrder, metadata, portalId },
    });
    return textResult(data);
  }
);

server.tool(
  "update_pipeline_stage",
  "Update an existing pipeline stage (rename, reorder, change metadata)",
  {
    objectType: z.enum(["deals", "tickets"]),
    pipelineId: z.string().describe("Pipeline ID"),
    stageId: z.string().describe("Stage ID to update"),
    label: z.string().optional().describe("New stage name"),
    displayOrder: z.number().optional().describe("New position"),
    metadata: z.record(z.string(), z.string()).optional().describe("Updated metadata"),
    portalId: z.string().optional().describe("Portal ID. Omit to use the active portal."),
  },
  async ({ objectType, pipelineId, stageId, label, displayOrder, metadata, portalId }) => {
    const data = await api({
      method: "PATCH",
      path: `/api/pipelines/${objectType}/${encodeURIComponent(pipelineId)}/stages/${encodeURIComponent(stageId)}`,
      body: { label, displayOrder, metadata, portalId },
    });
    return textResult(data);
  }
);

server.tool(
  "delete_pipeline_stage",
  "Delete a stage from a pipeline. Cannot delete a stage that has records in it.",
  {
    objectType: z.enum(["deals", "tickets"]),
    pipelineId: z.string().describe("Pipeline ID"),
    stageId: z.string().describe("Stage ID to delete"),
    portalId: z.string().optional().describe("Portal ID. Omit to use the active portal."),
  },
  async ({ objectType, pipelineId, stageId, portalId }) => {
    const data = await api({
      method: "DELETE",
      path: `/api/pipelines/${objectType}/${encodeURIComponent(pipelineId)}/stages/${encodeURIComponent(stageId)}`,
      body: { portalId },
    });
    return textResult(data);
  }
);

server.tool(
  "update_pipeline",
  "Update an existing pipeline (rename, reorder)",
  {
    objectType: z.enum(["deals", "tickets"]),
    pipelineId: z.string().describe("Pipeline ID to update"),
    label: z.string().optional().describe("New pipeline name"),
    displayOrder: z.number().optional().describe("New display order"),
    portalId: z.string().optional().describe("Portal ID. Omit to use the active portal."),
  },
  async ({ objectType, pipelineId, label, displayOrder, portalId }) => {
    const data = await api({
      method: "PATCH",
      path: `/api/pipelines/${objectType}/${encodeURIComponent(pipelineId)}`,
      body: { label, displayOrder, portalId },
    });
    return textResult(data);
  }
);

// ---------------------------------------------------------------------------
// Owner Tools
// ---------------------------------------------------------------------------

server.tool(
  "list_owners",
  "List all HubSpot owners (users) in the portal. Returns owner IDs, names, and emails. Use owner IDs for assigning records via hubspot_owner_id property.",
  {
    portalId: z.string().optional().describe("Portal ID. Omit to use the active portal."),
  },
  async ({ portalId }) => {
    const data = await api({
      path: "/api/owners",
      query: portalId ? { portalId } : {},
    });
    return textResult(data);
  }
);

// ---------------------------------------------------------------------------
// Record Merge Tools
// ---------------------------------------------------------------------------

server.tool(
  "merge_records",
  "Merge two CRM records. The secondary record is merged into the primary record. Property values from the primary take precedence. Associations from both records are preserved.",
  {
    objectType: z.string().describe("contacts, companies, deals, tickets"),
    primaryId: z.string().describe("ID of the record to keep (primary)"),
    secondaryId: z.string().describe("ID of the record to merge into the primary (will be archived)"),
    portalId: z.string().optional().describe("Portal ID. Omit to use the active portal."),
  },
  async ({ objectType, primaryId, secondaryId, portalId }) => {
    const data = await api({
      method: "POST",
      path: `/api/records/merge`,
      body: { objectType, primaryId, secondaryId, portalId },
    });
    return textResult(data);
  }
);

// ---------------------------------------------------------------------------
// Engagement Tools (Tasks, Notes, Calls, Meetings, Emails)
// ---------------------------------------------------------------------------

server.tool(
  "create_engagement",
  "Create an engagement (task, note, call, meeting, or email) associated with CRM records. Engagements track activities and interactions.",
  {
    type: z.enum(["tasks", "notes", "calls", "meetings", "emails"]).describe("Engagement type"),
    properties: z.record(z.string(), z.unknown()).describe("Engagement properties (e.g. hs_task_subject, hs_note_body, hs_call_title)"),
    associations: z.array(z.object({
      toObjectType: z.string(),
      toObjectId: z.string(),
    })).optional().describe("Records to associate the engagement with"),
    portalId: z.string().optional().describe("Portal ID. Omit to use the active portal."),
  },
  async ({ type, properties, associations, portalId }) => {
    const data = await api({
      method: "POST",
      path: `/api/records`,
      body: { objectType: type, properties, associations, portalId },
    });
    return textResult(data);
  }
);

// ---------------------------------------------------------------------------
// Batch Property Tools
// ---------------------------------------------------------------------------

server.tool(
  "batch_create_properties",
  "Create multiple properties in a single batch operation (up to 100 per call). Much faster than creating one by one.",
  {
    objectType: z.string().describe("contacts, companies, deals, tickets, etc."),
    properties: z.array(z.object({
      name: z.string(),
      label: z.string(),
      type: z.string(),
      fieldType: z.string(),
      groupName: z.string().optional(),
      description: z.string().optional(),
      options: z.array(z.object({
        label: z.string(),
        value: z.string(),
        displayOrder: z.number().optional(),
      })).optional(),
    })).describe("Array of property specs to create"),
    portalId: z.string().optional().describe("Portal ID. Omit to use the active portal."),
  },
  async ({ objectType, properties, portalId }) => {
    const data = await api({
      method: "POST",
      path: "/api/properties/batch",
      body: { objectType, properties, portalId },
    });
    return textResult(data);
  }
);

// ---------------------------------------------------------------------------
// List Management Tools
// ---------------------------------------------------------------------------

server.tool(
  "update_list",
  "Update an existing list (rename or change filter criteria)",
  {
    listId: z.string().describe("List ID to update"),
    name: z.string().optional().describe("New list name"),
    filterBranch: z.record(z.string(), z.unknown()).optional().describe("Updated filter definition for dynamic lists"),
    portalId: z.string().optional().describe("Portal ID. Omit to use the active portal."),
  },
  async ({ listId, name, filterBranch, portalId }) => {
    const data = await api({
      method: "PATCH",
      path: `/api/lists/${encodeURIComponent(listId)}`,
      body: { name, filterBranch, portalId },
    });
    return textResult(data);
  }
);

server.tool(
  "delete_list",
  "Delete a CRM list. This removes the list definition but does not delete the records in it.",
  {
    listId: z.string().describe("List ID to delete"),
    portalId: z.string().optional().describe("Portal ID. Omit to use the active portal."),
  },
  async ({ listId, portalId }) => {
    const data = await api({
      method: "DELETE",
      path: `/api/lists/${encodeURIComponent(listId)}`,
      body: { portalId },
    });
    return textResult(data);
  }
);

// ---------------------------------------------------------------------------
// GDPR Tools
// ---------------------------------------------------------------------------

server.tool(
  "gdpr_delete_contact",
  "Permanently delete a contact for GDPR compliance (right to be forgotten). This is irreversible and removes all data including analytics.",
  {
    contactId: z.string().describe("Contact record ID to permanently delete"),
    portalId: z.string().optional().describe("Portal ID. Omit to use the active portal."),
  },
  async ({ contactId, portalId }) => {
    const data = await api({
      method: "POST",
      path: "/api/records/gdpr-delete",
      body: { contactId, portalId },
    });
    return textResult(data);
  }
);

} // end registerTools()
