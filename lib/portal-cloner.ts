/**
 * Portal Cloning Engine — extracts configuration from a source portal,
 * normalizes it (removes IDs), and installs it on a target portal
 * using the existing Config Executor.
 */

import { authManager } from "@/lib/auth-manager";
import { hubSpotClient } from "@/lib/api-client";
import { executeConfig } from "@/lib/config-executor";
import type {
  TemplateResources,
  PropertyGroupSpec,
  PropertyResourceSpec,
  PipelineResourceSpec,
  PipelineStageSpec,
  ListResourceSpec,
  ExecutionReport,
} from "@/lib/template-types";

// --- Types ---

export interface CloneOptions {
  properties: boolean;
  pipelines: boolean;
  workflows: boolean;
  lists: boolean;
  customObjects: boolean;
  associations: boolean;
}

export interface ExtractedConfig {
  sourcePortalId: string;
  extractedAt: string;
  resources: TemplateResources;
}

export interface CloneResult {
  sourcePortalId: string;
  targetPortalId: string;
  extractedResources: TemplateResources;
  report: ExecutionReport;
}

const DEFAULT_CLONE_OPTIONS: CloneOptions = {
  properties: true,
  pipelines: true,
  workflows: false,
  lists: true,
  customObjects: false,
  associations: false,
};

// --- Property Types Known to be HubSpot-Managed ---

const HUBSPOT_MANAGED_GROUPS = new Set([
  "contactinformation",
  "companyinformation",
  "dealinformation",
  "conversion_information",
  "sales_properties",
]);

const RESERVED_PROPERTY_PREFIXES = ["hs_", "hubspot_"];
const RESERVED_PROPERTY_NAMES = new Set([
  "id", "createdate", "lastmodifieddate", "hs_object_id",
  "firstname", "lastname", "email", "company", "phone",
  "website", "address", "city", "state", "zip", "country",
  "jobtitle", "lifecyclestage", "hs_lead_status",
  "associatedcompanyid", "num_associated_deals",
]);

// --- Extraction Functions ---

const OBJECT_TYPES = ["contacts", "companies", "deals", "tickets"] as const;

async function extractPropertiesForType(objectType: string): Promise<{
  groups: PropertyGroupSpec[];
  properties: PropertyResourceSpec[];
}> {
  const groups: PropertyGroupSpec[] = [];
  const properties: PropertyResourceSpec[] = [];

  const resp = await hubSpotClient.get(`/crm/v3/properties/${objectType}`);
  const data = resp.data as { results?: Array<Record<string, unknown>> };

  for (const prop of data.results ?? []) {
    const name = String(prop.name || "");

    // Skip HubSpot built-in properties
    if (RESERVED_PROPERTY_NAMES.has(name)) continue;
    if (RESERVED_PROPERTY_PREFIXES.some((prefix) => name.startsWith(prefix))) continue;
    if (prop.hubspotDefined === true) continue;

    const groupName = String(prop.groupName || "");

    // Track custom groups
    if (groupName && !HUBSPOT_MANAGED_GROUPS.has(groupName)) {
      const existing = groups.find((g) => g.name === groupName);
      if (!existing) {
        groups.push({
          name: groupName,
          label: groupName.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
          objectType,
          displayOrder: 0,
        });
      }
    }

    const spec: PropertyResourceSpec = {
      name,
      label: String(prop.label || name),
      type: String(prop.type || "string"),
      fieldType: String(prop.fieldType || "text"),
      objectType,
      description: prop.description ? String(prop.description) : undefined,
    };

    if (groupName && !HUBSPOT_MANAGED_GROUPS.has(groupName)) {
      spec.groupName = groupName;
    }

    if (prop.type === "enumeration" && Array.isArray(prop.options)) {
      spec.options = (prop.options as Array<Record<string, unknown>>).map((opt, i) => ({
        label: String(opt.label || opt.value || ""),
        value: String(opt.value || ""),
        displayOrder: typeof opt.displayOrder === "number" ? opt.displayOrder : i,
      }));
    }

    properties.push(spec);
  }

  return { groups, properties };
}

async function extractProperties(): Promise<{
  groups: PropertyGroupSpec[];
  properties: PropertyResourceSpec[];
}> {
  // Extract all object types concurrently
  const results = await Promise.all(
    OBJECT_TYPES.map((objectType) =>
      extractPropertiesForType(objectType).catch(() => ({ groups: [], properties: [] }))
    )
  );

  const groups: PropertyGroupSpec[] = [];
  const properties: PropertyResourceSpec[] = [];

  for (const result of results) {
    groups.push(...result.groups);
    properties.push(...result.properties);
  }

  return { groups, properties };
}

async function extractPipelines(): Promise<PipelineResourceSpec[]> {
  const pipelines: PipelineResourceSpec[] = [];

  for (const objectType of ["deals", "tickets"] as const) {
    try {
      const resp = await hubSpotClient.get(`/crm/v3/pipelines/${objectType}`);
      const data = resp.data as { results?: Array<Record<string, unknown>> };

      for (const pipeline of data.results ?? []) {
        // Skip the default pipeline
        if (pipeline.default === true) continue;

        const stages: PipelineStageSpec[] = [];
        const rawStages = Array.isArray(pipeline.stages) ? pipeline.stages : [];

        for (const stage of rawStages as Array<Record<string, unknown>>) {
          stages.push({
            label: String(stage.label || ""),
            displayOrder: typeof stage.displayOrder === "number" ? stage.displayOrder : stages.length,
            metadata: stage.metadata as Record<string, string> | undefined,
          });
        }

        if (stages.length > 0) {
          pipelines.push({
            label: String(pipeline.label || ""),
            objectType,
            displayOrder: typeof pipeline.displayOrder === "number" ? pipeline.displayOrder : 0,
            stages,
          });
        }
      }
    } catch {
      // Skip if no access
    }
  }

  return pipelines;
}

async function extractLists(): Promise<ListResourceSpec[]> {
  const lists: ListResourceSpec[] = [];

  try {
    const resp = await hubSpotClient.get("/crm/v3/lists/", { count: 250 });
    const data = resp.data as { lists?: Array<Record<string, unknown>> };

    for (const list of data.lists ?? []) {
      // Only clone user-created lists
      if (list.listType === "SYSTEM" || list.internal === true) continue;

      lists.push({
        name: String(list.name || ""),
        objectTypeId: String(list.objectTypeId || "0-1"),
        processingType: list.processingType === "MANUAL" ? "MANUAL" : "DYNAMIC",
        filterBranch: list.filterBranch as Record<string, unknown> | undefined,
      });
    }
  } catch {
    // Skip if no access
  }

  return lists;
}

// --- Main Extraction ---

export async function extractPortalConfig(
  portalId: string,
  options: Partial<CloneOptions> = {}
): Promise<ExtractedConfig> {
  const opts = { ...DEFAULT_CLONE_OPTIONS, ...options };
  const resources: TemplateResources = {};

  return authManager.withPortal(portalId, async () => {
    // Run all extractions concurrently — they're independent API calls
    const [propertyResult, pipelineResult, listResult] = await Promise.all([
      opts.properties ? extractProperties().catch(() => ({ groups: [], properties: [] })) : Promise.resolve(null),
      opts.pipelines ? extractPipelines().catch(() => []) : Promise.resolve(null),
      opts.lists ? extractLists().catch(() => []) : Promise.resolve(null),
    ]);

    if (propertyResult) {
      if (propertyResult.groups.length > 0) resources.propertyGroups = propertyResult.groups;
      if (propertyResult.properties.length > 0) resources.properties = propertyResult.properties;
    }
    if (pipelineResult && pipelineResult.length > 0) resources.pipelines = pipelineResult;
    if (listResult && listResult.length > 0) resources.lists = listResult;

    return {
      sourcePortalId: portalId,
      extractedAt: new Date().toISOString(),
      resources,
    };
  });
}

// --- Clone Execution ---

export async function clonePortal(
  sourcePortalId: string,
  targetPortalId: string,
  options: Partial<CloneOptions> = {},
  dryRun = true
): Promise<CloneResult> {
  // Step 1: Extract from source
  const extracted = await extractPortalConfig(sourcePortalId, options);

  // Step 2: Execute on target (uses existing config executor with dependency resolution)
  const report = await executeConfig(targetPortalId, extracted.resources, {
    dryRun,
    templateId: `clone:${sourcePortalId}`,
  });

  return {
    sourcePortalId,
    targetPortalId,
    extractedResources: extracted.resources,
    report,
  };
}

// --- Export as Template Pack ---

export function exportAsTemplate(config: ExtractedConfig): Record<string, unknown> {
  return {
    id: `clone-${config.sourcePortalId}`,
    name: `Clone of Portal ${config.sourcePortalId}`,
    version: "1.0.0",
    description: `Configuration exported from portal ${config.sourcePortalId} on ${config.extractedAt}`,
    tags: ["clone", "export"],
    resources: config.resources,
  };
}
