import { saveWorkflowSpecArtifact } from "@/lib/artifact-store";
import { apiClient, hubSpotClient } from "@/lib/api-client";
import { authManager } from "@/lib/auth-manager";
import { changeLogger } from "@/lib/change-logger";
import { canWriteInEnvironment, missingScopesFor } from "@/lib/safety-governance";

export type WorkflowSpec = Record<string, unknown>;

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export interface DeployResult {
  success: boolean;
  errors?: string[];
  flowId?: string;
  revisionId?: string;
  name?: string;
  isEnabled?: boolean;
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
  list(): Promise<WorkflowSummary[]>;
  get(flowId: string): Promise<WorkflowSpec>;
  update(flowId: string, spec: WorkflowSpec): Promise<DeployResult>;
  delete(flowId: string, confirmationText: string): Promise<void>;
}

export function normalizeWorkflowDefaults(spec: WorkflowSpec): WorkflowSpec {
  // Only set isEnabled:false — don't add fields HubSpot doesn't require
  return { ...spec, isEnabled: false };
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
      return { success: false, errors: governanceErrors };
    }

    const validation = this.validate(spec);
    if (!validation.valid) {
      return { success: false, errors: validation.errors };
    }

    const safeSpec = normalizeWorkflowDefaults(spec);
    const response = await apiClient.workflows.create(safeSpec);
    const created = response.data as { id?: string; flowId?: string; name?: string };
    const flowId = created.id || created.flowId;

    if (!flowId) {
      return { success: false, errors: ["Deploy failed: flowId missing in response"] };
    }

    const deployed = await this.get(flowId);

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
      initiatedBy: "user"
    });

    return {
      success: true,
      flowId,
      revisionId: String((deployed.revisionId as string) || ""),
      name: String((deployed.name as string) || safeSpec.name || ""),
      isEnabled: Boolean(deployed.isEnabled)
    };
  }

  async list(): Promise<WorkflowSummary[]> {
    await authManager.ensureValidatedForSession();
    const response = await apiClient.workflows.list();
    const data = response.data as { results?: WorkflowSummary[] };
    return data.results ?? [];
  }

  async get(flowId: string): Promise<WorkflowSpec> {
    await authManager.ensureValidatedForSession();
    const response = await hubSpotClient.get(`/automation/v4/flows/${flowId}`);
    return response.data as WorkflowSpec;
  }

  async update(flowId: string, spec: WorkflowSpec): Promise<DeployResult> {
    const governanceErrors = await this.enforceWriteGovernance("B4");
    if (governanceErrors.length > 0) {
      return { success: false, errors: governanceErrors };
    }

    const validation = this.validate(spec);
    if (!validation.valid) {
      return { success: false, errors: validation.errors };
    }

    const safeSpec = normalizeWorkflowDefaults(spec);
    await apiClient.workflows.update(flowId, safeSpec);
    const deployed = await this.get(flowId);

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
      initiatedBy: "user"
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
      initiatedBy: "user"
    });
  }
}

export const workflowEngine: WorkflowEngine = new HubSpotWorkflowEngine();
