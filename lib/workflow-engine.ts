import { saveWorkflowSpecArtifact } from "@/lib/artifact-store";
import { apiClient, hubSpotClient } from "@/lib/api-client";
import { authManager } from "@/lib/auth-manager";
import { changeLogger } from "@/lib/change-logger";
import { canWriteInEnvironment, missingScopesFor } from "@/lib/safety-governance";
import { attemptPartialWorkflowInstall, isActionTypeError, preStripBrokenActions, type PartialWorkflowInstallResult } from "@/lib/partial-install";
import { appendPartialInstallLearning } from "@/lib/skills-learner";
import { validateWorkflowForDeploy } from "@/lib/constraint-validator";

export type WorkflowSpec = Record<string, unknown>;

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export type DeployErrorCategory = "governance" | "validation" | "constraint" | "auth" | "rate_limit" | "action_type" | "api" | "unknown";

export interface DeployResult {
  success: boolean;
  errors?: string[];
  /** Category of the failure for programmatic handling */
  errorCategory?: DeployErrorCategory;
  flowId?: string;
  revisionId?: string;
  name?: string;
  isEnabled?: boolean;
  /** Present when some actions were stripped during partial-install */
  partial?: PartialWorkflowInstallResult;
}

export interface WorkflowSummary {
  id?: string;
  flowId?: string;
  name?: string;
  type?: string;
  objectTypeId?: string;
  isEnabled?: boolean;
  [key: string]: unknown;
}

export interface WorkflowEngine {
  validate(spec: WorkflowSpec): ValidationResult;
  preview(spec: WorkflowSpec): string;
  deploy(spec: WorkflowSpec): Promise<DeployResult>;
  /** Like deploy() but falls back to partial-install if HubSpot rejects the full spec. */
  deployPartial(spec: WorkflowSpec): Promise<DeployResult>;
  list(): Promise<WorkflowSummary[]>;
  get(flowId: string): Promise<WorkflowSpec>;
  update(flowId: string, spec: WorkflowSpec): Promise<DeployResult>;
  delete(flowId: string, confirmationText: string): Promise<void>;
}

export function normalizeWorkflowDefaults(spec: WorkflowSpec): WorkflowSpec {
  return {
    ...spec,
    isEnabled: false,
    flowType: spec.flowType ?? "WORKFLOW",
    crmObjectCreationStatus: spec.crmObjectCreationStatus ?? "COMPLETE",
    canEnrollFromSalesforce: spec.canEnrollFromSalesforce ?? false,
    customProperties: spec.customProperties ?? {},
    dataSources: spec.dataSources ?? [],
    suppressionListIds: spec.suppressionListIds ?? [],
    timeWindows: spec.timeWindows ?? [],
    blockedDates: spec.blockedDates ?? [],
    // HubSpot v4 API requires nextAvailableActionId as a string
    ...(spec.nextAvailableActionId != null
      ? { nextAvailableActionId: String(spec.nextAvailableActionId) }
      : {}),
  };
}

class HubSpotWorkflowEngine implements WorkflowEngine {
  private async enforceWriteGovernance(moduleCode: "B2" | "B4" | "B5"): Promise<string[]> {
    await authManager.ensureValidatedForSession();
    const isFirstSession = authManager.isFirstSessionForActivePortal();

    const portal = authManager.getActivePortal();
    const writeGate = canWriteInEnvironment({
      environment: portal.environment,
      isFirstSession,
      isWriteOperation: true
    });

    if (!writeGate.allowed) {
      return [writeGate.reason || "Write operation blocked by safety policy"];
    }

    const missing = missingScopesFor(moduleCode, "api", authManager.getScopes());
    if (missing.length > 0) {
      return [`Missing required scope(s): ${missing.join(", ")}`];
    }

    return [];
  }

  validate(spec: WorkflowSpec): ValidationResult {
    const errors: string[] = [];

    if (!spec.name) errors.push("Missing: name");
    if (!spec.type) errors.push("Missing: type (CONTACT_FLOW or PLATFORM_FLOW)");
    if (!spec.objectTypeId) errors.push("Missing: objectTypeId");
    if (!spec.startActionId) errors.push("Missing: startActionId");
    if (!Array.isArray(spec.actions) || spec.actions.length === 0) errors.push("Missing: actions array");
    if (!spec.enrollmentCriteria) errors.push("Missing: enrollmentCriteria");

    if (spec.isEnabled !== false) errors.push("SAFETY: isEnabled must be false");

    const actions = (Array.isArray(spec.actions) ? spec.actions : []) as Array<Record<string, unknown>>;
    const actionIds = new Set(actions.map((action) => String(action.actionId || "")));

    const startActionId = String(spec.startActionId || "");
    if (startActionId && !actionIds.has(startActionId)) {
      errors.push(`startActionId "${startActionId}" not found in actions`);
    }

    for (const action of actions) {
      const actionId = String(action.actionId || "unknown");
      const branchTypes = ["STATIC_BRANCH", "LIST_BRANCH", "IF_BRANCH", "UNIFIED_BRANCH"];
      if (!action.actionTypeId && !branchTypes.includes(String(action.type))) {
        errors.push(`Action ${actionId} missing actionTypeId`);
      }

      const connection = action.connection as { nextActionId?: string } | undefined;
      const nextActionId = connection?.nextActionId;
      if (nextActionId && !actionIds.has(String(nextActionId))) {
        errors.push(`Action ${actionId} points to non-existent ${nextActionId}`);
      }
    }

    const numericIds = actions
      .map((action) => Number(action.actionId))
      .filter((value) => Number.isFinite(value));
    if (numericIds.length) {
      const maxActionId = Math.max(...numericIds);
      const nextAvailableActionId = Number(spec.nextAvailableActionId);
      if (!Number.isFinite(nextAvailableActionId) || nextAvailableActionId !== maxActionId + 1) {
        errors.push(`nextAvailableActionId must be ${maxActionId + 1}`);
      }
    }

    const type = String(spec.type || "");
    const objectTypeId = String(spec.objectTypeId || "");
    if (objectTypeId === "0-1" && type !== "CONTACT_FLOW") {
      errors.push("Contacts workflows must use type CONTACT_FLOW");
    }
    if (objectTypeId !== "0-1" && type && type !== "PLATFORM_FLOW") {
      errors.push("Non-contact workflows must use type PLATFORM_FLOW");
    }

    return { valid: errors.length === 0, errors };
  }

  preview(spec: WorkflowSpec): string {
    const name = String(spec.name || "Unnamed Workflow");
    const type = String(spec.type || "Unknown");
    const status = spec.isEnabled === false ? "DISABLED" : "ENABLED";

    const enrollment = spec.enrollmentCriteria as { type?: string } | undefined;
    const trigger = enrollment?.type || "UNKNOWN";

    const actions = (Array.isArray(spec.actions) ? spec.actions : []) as Array<Record<string, unknown>>;
    const actionLines = actions.map((action) => {
      const id = String(action.actionId || "?");
      const actionTypeId = String(action.actionTypeId || "?");
      return `  ${id}. actionTypeId ${actionTypeId}`;
    });

    return [
      "--- WORKFLOW SPEC ---",
      `Name: ${name}`,
      `Type: ${type}`,
      `Status: ${status} (will be enabled after review)`,
      "",
      `TRIGGER: ${trigger}`,
      "",
      "ACTIONS:",
      ...(actionLines.length ? actionLines : ["  (none)"]),
      "",
      "--------------------"
    ].join("\n");
  }

  async deploy(spec: WorkflowSpec): Promise<DeployResult> {
    const governanceErrors = await this.enforceWriteGovernance("B2");
    if (governanceErrors.length > 0) {
      return { success: false, errors: governanceErrors, errorCategory: "governance" };
    }

    const validation = this.validate(spec);
    if (!validation.valid) {
      return { success: false, errors: validation.errors, errorCategory: "validation" };
    }

    // Run constraint validation (action type checks, enrollment criteria, required fields)
    const constraintErrors = validateWorkflowForDeploy(spec as Record<string, unknown>);
    if (constraintErrors.length > 0) {
      return { success: false, errors: constraintErrors.map((e) => `${e.field}: ${e.message}`), errorCategory: "constraint" };
    }

    const safeSpec = normalizeWorkflowDefaults(spec);
    const response = await apiClient.workflows.create(safeSpec);
    const created = response.data as { id?: string; flowId?: string; name?: string };
    const flowId = created.id || created.flowId;

    if (!flowId) {
      return { success: false, errors: ["Deploy failed: flowId missing in response"], errorCategory: "api" };
    }

    const deployed = await this.get(flowId).catch(() => ({} as WorkflowSpec));

    const portalId = authManager.getActivePortal().id;
    const artifactName = String(safeSpec.name || "workflow-spec");
    await saveWorkflowSpecArtifact(portalId, artifactName, safeSpec);

    await changeLogger.log({
      portalId,
      layer: "api",
      module: "B2",
      action: "workflow_deploy",
      objectType: "workflow",
      recordId: flowId,
      description: `Deployed workflow "${String(safeSpec.name || "Unnamed")}" (disabled)`,
      after: safeSpec,
      status: "success",
      initiatedBy: "VeroDigital"
    });

    return {
      success: true,
      flowId,
      revisionId: String((deployed.revisionId as string) || ""),
      name: String((deployed.name as string) || safeSpec.name || ""),
      isEnabled: Boolean(deployed.isEnabled)
    };
  }

  async deployPartial(spec: WorkflowSpec): Promise<DeployResult> {
    const governanceErrors = await this.enforceWriteGovernance("B2");
    if (governanceErrors.length > 0) {
      return { success: false, errors: governanceErrors };
    }

    const validation = this.validate(spec);
    if (!validation.valid) {
      return { success: false, errors: validation.errors };
    }

    // Run constraint validation (action type checks, enrollment criteria, required fields)
    const constraintErrors = validateWorkflowForDeploy(spec as Record<string, unknown>);
    if (constraintErrors.length > 0) {
      return { success: false, errors: constraintErrors.map((e) => `${e.field}: ${e.message}`) };
    }

    const safeSpec = normalizeWorkflowDefaults(spec);
    const workflowName = String(safeSpec.name || "Unnamed Workflow");
    const portalId = authManager.getActivePortal().id;

    // Phase 2: Pre-strip known broken action types before attempting deployment
    const preStrip = preStripBrokenActions(
      safeSpec as Record<string, unknown>,
      workflowName,
      portalId
    );
    const deployPayload = preStrip.payload;
    const preStrippedActions = preStrip.strippedActions;

    // Try full deploy first (with pre-stripped payload)
    let firstDeployError: unknown = undefined;
    try {
      const response = await apiClient.workflows.create(deployPayload);
      const created = response.data as { id?: string; flowId?: string; name?: string };
      const flowId = created.id || created.flowId;

      if (!flowId) {
        return { success: false, errors: ["Deploy failed: flowId missing in response"], errorCategory: "api" };
      }

      const deployed = await this.get(flowId).catch(() => ({} as WorkflowSpec));
      await saveWorkflowSpecArtifact(portalId, workflowName, safeSpec);
      await changeLogger.log({
        portalId,
        layer: "api",
        module: "B2",
        action: "workflow_deploy",
        objectType: "workflow",
        recordId: flowId,
        description: preStrippedActions.length > 0
          ? `Deployed workflow "${workflowName}" (disabled) — ${preStrippedActions.length} action(s) pre-stripped`
          : `Deployed workflow "${workflowName}" (disabled)`,
        after: safeSpec,
        status: "success",
        initiatedBy: "VeroDigital",
      });

      // If we pre-stripped actions, report as partial success
      if (preStrippedActions.length > 0) {
        return {
          success: true,
          flowId,
          revisionId: String((deployed.revisionId as string) || ""),
          name: String((deployed.name as string) || workflowName),
          isEnabled: Boolean(deployed.isEnabled),
          partial: {
            flowId,
            status: "partial",
            installedActionIds: ((deployPayload.actions || []) as Array<Record<string, unknown>>).map(a => String(a.actionId ?? "")),
            strippedActions: preStrippedActions,
            manualSteps: preStrip.manualSteps,
            attemptsNeeded: 1,
          },
        };
      }

      return {
        success: true,
        flowId,
        revisionId: String((deployed.revisionId as string) || ""),
        name: String((deployed.name as string) || workflowName),
        isEnabled: Boolean(deployed.isEnabled),
      };
    } catch (error) {
      firstDeployError = error;
    }

    // Phase 1: Error triage — only fall through to partial-install for action-type errors
    if (!isActionTypeError(firstDeployError)) {
      const errorMessage = firstDeployError instanceof Error
        ? firstDeployError.message
        : "Workflow deployment failed";
      return {
        success: false,
        errors: [errorMessage],
        errorCategory: "api" as DeployErrorCategory,
        ...(preStrippedActions.length > 0 ? {
          partial: {
            status: "failed" as const,
            installedActionIds: [],
            strippedActions: preStrippedActions,
            manualSteps: preStrip.manualSteps,
            attemptsNeeded: 1,
            error: errorMessage,
          }
        } : {}),
      };
    }

    // Partial-install: strip unsupported actions, retry
    // Pass the initial error to avoid a redundant API call
    const partial = await attemptPartialWorkflowInstall(
      deployPayload,
      workflowName,
      firstDeployError
    );
    // Merge pre-stripped actions into the partial result
    partial.strippedActions = [...preStrippedActions, ...partial.strippedActions];
    if (preStrip.manualSteps.length > 0) {
      partial.manualSteps = [...preStrip.manualSteps, ...partial.manualSteps];
    }

    // Self-improve: log new failure patterns
    for (const stripped of partial.strippedActions) {
      appendPartialInstallLearning({
        category: "WORKFLOW",
        workflowName,
        actionTypeId: stripped.actionTypeId,
        actionLabel: stripped.label,
        error: stripped.reason,
      });
    }

    if (partial.status === "failed") {
      return {
        success: false,
        errors: [partial.error ?? "Workflow deployment failed after partial-install attempts"],
        errorCategory: "action_type",
        partial,
      };
    }

    // Partial or full success
    if (partial.flowId) {
      const deployed = await this.get(partial.flowId).catch(() => ({} as WorkflowSpec));
      await saveWorkflowSpecArtifact(portalId, workflowName, safeSpec);
      await changeLogger.log({
        portalId,
        layer: "api",
        module: "B2",
        action: "workflow_deploy",
        objectType: "workflow",
        recordId: partial.flowId,
        description: `Partially deployed workflow "${workflowName}" — ${partial.strippedActions.length} action(s) stripped`,
        after: { ...safeSpec, strippedActions: partial.strippedActions },
        status: "success",
        initiatedBy: "VeroDigital",
      });

      return {
        success: true,
        flowId: partial.flowId,
        revisionId: String((deployed.revisionId as string) || ""),
        name: String((deployed.name as string) || workflowName),
        isEnabled: Boolean(deployed.isEnabled),
        partial,
      };
    }

    return { success: false, errors: ["Partial install did not return a flowId"], errorCategory: "api", partial };
  }

  async list(): Promise<WorkflowSummary[]> {
    await authManager.ensureValidatedForSession();
    const response = await apiClient.workflows.list();
    const data = response.data as { results?: WorkflowSummary[] };
    return data.results ?? [];
  }

  async get(flowId: string): Promise<WorkflowSpec> {
    await authManager.ensureValidatedForSession();
    const safeFlowId = encodeURIComponent(flowId);
    const response = await hubSpotClient.get(`/automation/v4/flows/${safeFlowId}`);
    return response.data as WorkflowSpec;
  }

  async update(flowId: string, spec: WorkflowSpec): Promise<DeployResult> {
    const governanceErrors = await this.enforceWriteGovernance("B4");
    if (governanceErrors.length > 0) {
      return { success: false, errors: governanceErrors, errorCategory: "governance" };
    }

    const validation = this.validate(spec);
    if (!validation.valid) {
      return { success: false, errors: validation.errors, errorCategory: "validation" };
    }

    const safeSpec = normalizeWorkflowDefaults(spec);
    await apiClient.workflows.update(flowId, safeSpec);
    const deployed = await this.get(flowId).catch(() => ({} as WorkflowSpec));

    await changeLogger.log({
      portalId: authManager.getActivePortal().id,
      layer: "api",
      module: "B4",
      action: "workflow_deploy",
      objectType: "workflow",
      recordId: flowId,
      description: `Updated workflow "${String(safeSpec.name || "Unnamed")}" (disabled)`,
      after: safeSpec,
      status: "success",
      initiatedBy: "VeroDigital"
    });

    return {
      success: true,
      flowId,
      revisionId: String((deployed.revisionId as string) || ""),
      name: String((deployed.name as string) || safeSpec.name || ""),
      isEnabled: Boolean(deployed.isEnabled)
    };
  }

  async delete(flowId: string, confirmationText: string): Promise<void> {
    const governanceErrors = await this.enforceWriteGovernance("B5");
    if (governanceErrors.length > 0) {
      throw new Error(governanceErrors.join("; "));
    }

    if (confirmationText.trim() !== flowId) {
      throw new Error(`Delete confirmation failed. confirmationText must exactly match flowId ${flowId}`);
    }

    await apiClient.workflows.delete(flowId);

    await changeLogger.log({
      portalId: authManager.getActivePortal().id,
      layer: "api",
      module: "B5",
      action: "delete",
      objectType: "workflow",
      recordId: flowId,
      description: `Deleted workflow ${flowId}`,
      status: "success",
      initiatedBy: "VeroDigital"
    });
  }
}

export const workflowEngine: WorkflowEngine = new HubSpotWorkflowEngine();
