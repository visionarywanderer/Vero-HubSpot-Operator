/**
 * Configuration Executor — validates, resolves, and executes template resources
 * against a HubSpot portal via existing managers.
 */

import { authManager } from "@/lib/auth-manager";
import { propertyManager } from "@/lib/property-manager";
import { pipelineManager } from "@/lib/pipeline-manager";
import { listManager } from "@/lib/list-manager";
import { workflowEngine } from "@/lib/workflow-engine";
import { hubSpotClient } from "@/lib/api-client";
import { changeLogger } from "@/lib/change-logger";
import { validateTemplate, validateWorkflowForDeploy } from "@/lib/constraint-validator";
import { resolveDependencies } from "@/lib/dependency-resolver";
import { templateStore } from "@/lib/template-store";

import type {
  TemplateResources,
  TemplateDefinition,
  ResolvedResource,
  ResourceExecutionResult,
  ExecutionReport,
  ValidationResult,
  PropertyGroupSpec,
  PropertyResourceSpec,
  PipelineResourceSpec,
  WorkflowResourceSpec,
  ListResourceSpec,
  CustomObjectSpec,
  AssociationSpec,
} from "@/lib/template-types";

// --- Existence Cache (avoids repeated API calls per objectType) ---

interface ResourceCache {
  propertyGroups: Map<string, Set<string>>; // objectType → set of group names
  properties: Map<string, Set<string>>;     // objectType → set of property names
  workflowNames: Set<string> | null;        // existing workflow names for idempotency
}

function createResourceCache(): ResourceCache {
  return { propertyGroups: new Map(), properties: new Map(), workflowNames: null };
}

async function getCachedPropertyGroups(cache: ResourceCache, objectType: string): Promise<Set<string>> {
  if (!cache.propertyGroups.has(objectType)) {
    const groups = await propertyManager.listGroups(objectType);
    cache.propertyGroups.set(objectType, new Set(groups.map((g) => g.name)));
  }
  return cache.propertyGroups.get(objectType)!;
}

async function getCachedProperties(cache: ResourceCache, objectType: string): Promise<Set<string>> {
  if (!cache.properties.has(objectType)) {
    const props = await propertyManager.list(objectType);
    cache.properties.set(objectType, new Set(props.map((p) => p.name)));
  }
  return cache.properties.get(objectType)!;
}

// --- Individual Resource Executors ---

async function executePropertyGroup(spec: PropertyGroupSpec, cache: ResourceCache): Promise<ResourceExecutionResult> {
  const key = `propertyGroup:${spec.name}`;
  try {
    const existing = await getCachedPropertyGroups(cache, spec.objectType);
    if (existing.has(spec.name)) {
      return { key, type: "propertyGroup", status: "skipped", hubspotId: spec.name, error: "Already exists" };
    }
    const response = await hubSpotClient.post(
      `/crm/v3/properties/${spec.objectType}/groups`,
      { name: spec.name, label: spec.label, displayOrder: spec.displayOrder ?? 0 }
    );
    const data = response.data as { name?: string };
    existing.add(spec.name);
    return { key, type: "propertyGroup", status: "success", hubspotId: data.name };
  } catch (error) {
    return { key, type: "propertyGroup", status: "error", error: error instanceof Error ? error.message : "Failed to create property group" };
  }
}

async function executeProperty(spec: PropertyResourceSpec, cache: ResourceCache): Promise<ResourceExecutionResult> {
  const key = `property:${spec.objectType}:${spec.name}`;
  try {
    const existing = await getCachedProperties(cache, spec.objectType);
    if (existing.has(spec.name)) {
      return { key, type: "property", status: "skipped", hubspotId: spec.name, error: "Already exists" };
    }
    const result = await propertyManager.create(spec.objectType, {
      name: spec.name,
      label: spec.label,
      type: spec.type,
      fieldType: spec.fieldType,
      groupName: spec.groupName,
      options: spec.options,
      description: spec.description,
    });
    existing.add(spec.name);
    return { key, type: "property", status: "success", hubspotId: result.name };
  } catch (error) {
    return { key, type: "property", status: "error", error: error instanceof Error ? error.message : "Failed to create property" };
  }
}

async function executePipeline(spec: PipelineResourceSpec): Promise<ResourceExecutionResult> {
  // Auto-prefix pipeline label with [VD] if not already present
  const label = spec.label.startsWith("[VD]") ? spec.label : `[VD] ${spec.label}`;
  const key = `pipeline:${spec.objectType}:${label}`;
  try {
    const result = await pipelineManager.create(spec.objectType, {
      label,
      displayOrder: spec.displayOrder,
      stages: spec.stages,
    });
    const pipelineId = result.id || result.pipelineId;
    return { key, type: "pipeline", status: "success", hubspotId: pipelineId };
  } catch (error) {
    return { key, type: "pipeline", status: "error", error: error instanceof Error ? error.message : "Failed to create pipeline" };
  }
}

async function getCachedWorkflowNames(cache: ResourceCache): Promise<Set<string>> {
  if (cache.workflowNames) return cache.workflowNames;
  try {
    const response = await hubSpotClient.get("/automation/v4/flows", { limit: 500 });
    const data = response.data as { results?: Array<{ name?: string }> };
    cache.workflowNames = new Set(
      (data.results || []).map((w) => String(w.name || "")).filter(Boolean)
    );
  } catch {
    cache.workflowNames = new Set();
  }
  return cache.workflowNames;
}

async function executeWorkflow(spec: WorkflowResourceSpec, cache: ResourceCache): Promise<ResourceExecutionResult> {
  const key = `workflow:${spec.name}`;

  // Idempotency — check if workflow already exists
  const existing = await getCachedWorkflowNames(cache);
  if (existing.has(spec.name)) {
    return {
      key,
      type: "workflow",
      status: "skipped",
      error: `Workflow "${spec.name}" already exists — skipping to avoid duplicates`,
    };
  }

  // Build payload from template spec
  const specAny = spec as unknown as Record<string, unknown>;
  const payload: Record<string, unknown> = {
    name: spec.name,
    type: spec.type,
    objectTypeId: spec.objectTypeId,
    flowType: "WORKFLOW",
    isEnabled: false,
    startActionId: spec.startActionId,
    nextAvailableActionId: String(spec.nextAvailableActionId),
    enrollmentCriteria: spec.enrollmentCriteria,
    actions: spec.actions,
    ...(Array.isArray(specAny.dataSources) ? { dataSources: specAny.dataSources } : {}),
  };

  // Small delay before each workflow creation to avoid HubSpot rate limits
  await new Promise((resolve) => setTimeout(resolve, 3000));

  // Delegate to workflowEngine which handles pre-strip, error triage,
  // partial-install fallback, artifact saving, and learning append
  const result = await workflowEngine.deployPartial(payload);

  // Track as created for idempotency
  if (result.success) {
    existing.add(spec.name);
  }

  // Map DeployResult to ResourceExecutionResult
  if (!result.success) {
    return {
      key,
      type: "workflow",
      status: "error",
      error: result.errors?.join("; ") ?? "Workflow deployment failed",
      strippedActions: result.partial?.strippedActions.length ? result.partial.strippedActions : undefined,
      manualSteps: result.partial?.manualSteps.length ? result.partial.manualSteps : undefined,
    };
  }

  const hasStripped = result.partial && result.partial.strippedActions.length > 0;
  return {
    key,
    type: "workflow",
    status: hasStripped ? "partial" : "success",
    hubspotId: result.flowId,
    strippedActions: hasStripped ? result.partial!.strippedActions : undefined,
    manualSteps: result.partial?.manualSteps.length ? result.partial.manualSteps : undefined,
  };
}

async function executeList(spec: ListResourceSpec): Promise<ResourceExecutionResult> {
  const key = `list:${spec.name}`;
  try {
    const result = await listManager.create({
      name: spec.name,
      objectTypeId: spec.objectTypeId,
      processingType: spec.processingType,
      filterBranch: spec.filterBranch,
    });
    const listId = result.listId || result.id;
    return { key, type: "list", status: "success", hubspotId: listId };
  } catch (error) {
    return { key, type: "list", status: "error", error: error instanceof Error ? error.message : "Failed to create list" };
  }
}

async function executeCustomObject(spec: CustomObjectSpec): Promise<ResourceExecutionResult> {
  const key = `customObject:${spec.name}`;
  try {
    const response = await hubSpotClient.post("/crm/v3/schemas", {
      name: spec.name,
      labels: spec.labels,
      primaryDisplayProperty: spec.primaryDisplayProperty,
      properties: spec.properties?.map((p) => ({
        name: p.name,
        label: p.label,
        type: p.type,
        fieldType: p.fieldType,
      })) ?? [],
      requiredProperties: [spec.primaryDisplayProperty],
    });
    const data = response.data as { objectTypeId?: string; id?: string };
    return { key, type: "customObject", status: "success", hubspotId: data.objectTypeId || data.id };
  } catch (error) {
    return { key, type: "customObject", status: "error", error: error instanceof Error ? error.message : "Failed to create custom object" };
  }
}

async function executeAssociation(spec: AssociationSpec): Promise<ResourceExecutionResult> {
  const key = `association:${spec.fromObjectType}->${spec.toObjectType}`;
  try {
    const response = await hubSpotClient.post(
      `/crm/v4/associations/${spec.fromObjectType}/${spec.toObjectType}/labels`,
      {
        label: spec.label || `${spec.fromObjectType}_to_${spec.toObjectType}`,
        name: `${spec.fromObjectType}_to_${spec.toObjectType}`,
      }
    );
    const data = response.data as { typeId?: string };
    return { key, type: "association", status: "success", hubspotId: String(data.typeId ?? "") };
  } catch (error) {
    return { key, type: "association", status: "error", error: error instanceof Error ? error.message : "Failed to create association" };
  }
}

// --- Resource Executor Dispatch ---

async function executeResource(resource: ResolvedResource, cache: ResourceCache): Promise<ResourceExecutionResult> {
  switch (resource.type) {
    case "propertyGroup":
      return executePropertyGroup(resource.spec as unknown as PropertyGroupSpec, cache);
    case "property":
      return executeProperty(resource.spec as unknown as PropertyResourceSpec, cache);
    case "pipeline":
      return executePipeline(resource.spec as unknown as PipelineResourceSpec);
    case "workflow":
      return executeWorkflow(resource.spec as unknown as WorkflowResourceSpec, cache);
    case "list":
      return executeList(resource.spec as unknown as ListResourceSpec);
    case "customObject":
      return executeCustomObject(resource.spec as unknown as CustomObjectSpec);
    case "association":
      return executeAssociation(resource.spec as unknown as AssociationSpec);
    default:
      return { key: resource.key, type: resource.type, status: "error", error: `Unknown resource type: ${resource.type}` };
  }
}

// --- Core Execution ---

export async function executeConfig(
  portalId: string,
  resources: TemplateResources,
  options?: { dryRun?: boolean; templateId?: string }
): Promise<ExecutionReport> {
  const startedAt = new Date().toISOString();

  // Validate non-workflow resources using template validator
  const { workflows: templateWorkflows, ...validationResources } = resources;
  const validation = validateTemplate({
    id: options?.templateId || "inline",
    name: "inline-config",
    version: "1.0.0",
    description: "Inline configuration",
    resources: validationResources,
  });

  // Validate workflows separately using deploy-format validator
  const workflowValidationErrors = (templateWorkflows || []).flatMap((w) =>
    validateWorkflowForDeploy(w as unknown as Record<string, unknown>)
  );

  const allValidationErrors = [...validation.errors, ...workflowValidationErrors];

  if (allValidationErrors.length > 0) {
    return {
      templateId: options?.templateId,
      portalId,
      status: "failed",
      results: allValidationErrors.map((e) => ({
        key: e.resource,
        type: "property" as const,
        status: "error" as const,
        error: `${e.field}: ${e.message}`,
      })),
      startedAt,
      completedAt: new Date().toISOString(),
    };
  }

  // Resolve dependency order
  const sorted = resolveDependencies(resources);

  // Dry-run: return resolved order without executing
  if (options?.dryRun) {
    return {
      templateId: options.templateId,
      portalId,
      status: "success",
      results: sorted.map((r) => ({
        key: r.key,
        type: r.type,
        status: "skipped" as const,
      })),
      startedAt,
      completedAt: new Date().toISOString(),
    };
  }

  // Execute resources in dependency order within portal context.
  // Resources at the same dependency level with same type run concurrently.
  return authManager.withPortal(portalId, async () => {
    const results: ResourceExecutionResult[] = [];
    const failedKeys = new Set<string>();
    const cache = createResourceCache();

    // Group sorted resources into execution tiers: resources with all
    // dependencies already executed can run concurrently within a tier.
    const completedKeys = new Set<string>();
    let remaining = [...sorted];

    while (remaining.length > 0) {
      // Find all resources whose dependencies are already completed
      const tier: ResolvedResource[] = [];
      const deferred: ResolvedResource[] = [];

      for (const resource of remaining) {
        const hasDependencyFailure = resource.dependsOn.some((dep) => failedKeys.has(dep));
        if (hasDependencyFailure) {
          results.push({
            key: resource.key,
            type: resource.type,
            status: "skipped",
            error: "Skipped due to dependency failure",
          });
          failedKeys.add(resource.key);
          completedKeys.add(resource.key);
          continue;
        }

        const allDepsComplete = resource.dependsOn.every((dep) => completedKeys.has(dep));
        if (allDepsComplete) {
          tier.push(resource);
        } else {
          deferred.push(resource);
        }
      }

      if (tier.length === 0 && deferred.length > 0) {
        // Circular dependency safety — execute one at a time to break the cycle
        const [next, ...rest] = deferred;
        const result = await executeResource(next, cache);
        results.push(result);
        if (result.status === "error") failedKeys.add(next.key);
        completedKeys.add(next.key);
        remaining = rest;
        continue;
      }

      // Execute the tier: workflows run sequentially (rate limit safety),
      // other resource types run concurrently within the tier.
      const workflowResources = tier.filter((r) => r.type === "workflow");
      const nonWorkflowResources = tier.filter((r) => r.type !== "workflow");

      // Non-workflow resources: execute concurrently
      const nonWfResults = await Promise.all(
        nonWorkflowResources.map((resource) => executeResource(resource, cache))
      );
      for (let i = 0; i < nonWorkflowResources.length; i++) {
        results.push(nonWfResults[i]);
        if (nonWfResults[i].status === "error") failedKeys.add(nonWorkflowResources[i].key);
        completedKeys.add(nonWorkflowResources[i].key);
      }

      // Workflow resources: execute sequentially to avoid rate limits
      for (const wfResource of workflowResources) {
        const wfResult = await executeResource(wfResource, cache);
        results.push(wfResult);
        if (wfResult.status === "error") failedKeys.add(wfResource.key);
        completedKeys.add(wfResource.key);
      }

      remaining = deferred;
    }

    const completedAt = new Date().toISOString();
    const hasErrors = results.some((r) => r.status === "error");
    const hasPartial = results.some((r) => r.status === "partial");
    const allErrors = results.length > 0 && results.every((r) => r.status === "error");
    const status = allErrors ? "failed" : (hasErrors || hasPartial) ? "partial" : "success";

    // Aggregate manual steps from all resources (e.g. partial workflow installs)
    const allManualSteps = results.flatMap((r) => r.manualSteps ?? []);

    // Log the installation
    try {
      await changeLogger.log({
        portalId,
        layer: "api",
        module: "T1",
        action: "create",
        objectType: "template_install",
        recordId: options?.templateId || "inline",
        description: `Template installation: ${status} (${results.filter((r) => r.status === "success").length}/${results.length} resources)`,
        after: { results },
        status: status === "failed" ? "error" : "success",
        initiatedBy: "VeroDigital",
      });
    } catch {
      // Never block on logging
    }

    return {
      templateId: options?.templateId,
      portalId,
      status,
      results,
      startedAt,
      completedAt,
      ...(allManualSteps.length > 0 ? { manualSteps: allManualSteps } : {}),
    };
  });
}

// --- Template Installation ---

export async function installTemplate(
  templateId: string,
  portalId: string,
  options?: { dryRun?: boolean }
): Promise<ExecutionReport> {
  const template = await templateStore.getTemplate(templateId);
  if (!template) {
    const startedAt = new Date().toISOString();
    return {
      templateId,
      portalId,
      status: "failed",
      results: [{
        key: `template:${templateId}`,
        type: "property",
        status: "error",
        error: `Template "${templateId}" not found`,
      }],
      startedAt,
      completedAt: new Date().toISOString(),
    };
  }

  return executeConfig(portalId, template.resources, {
    dryRun: options?.dryRun,
    templateId,
  });
}

export async function installTemplatePack(
  templateIds: string[],
  portalId: string,
  options?: { dryRun?: boolean }
): Promise<ExecutionReport[]> {
  const reports: ExecutionReport[] = [];

  for (const templateId of templateIds) {
    const report = await installTemplate(templateId, portalId, options);
    reports.push(report);

    // Stop on full failure
    if (report.status === "failed") {
      break;
    }
  }

  return reports;
}

// --- Validation Only ---

export function validateConfig(resources: TemplateResources): ValidationResult {
  return validateTemplate({
    id: "validation",
    name: "validation",
    version: "1.0.0",
    description: "Validation check",
    resources,
  });
}
