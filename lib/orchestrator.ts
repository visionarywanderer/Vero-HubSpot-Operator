import { randomUUID } from "crypto";
import { getAnthropicClient } from "@/lib/anthropic";
import { apiClient, hubSpotClient } from "@/lib/api-client";
import { authManager } from "@/lib/auth-manager";
import { changeLogger } from "@/lib/change-logger";
import { HUBSPOT_PRIVATE_APP_REQUIRED_SCOPES } from "@/lib/hubspot-required-scopes";
import { mcpConnector } from "@/lib/mcp-connector";
import { portalConfigStore } from "@/lib/portal-config-store";
import {
  canWriteInEnvironment,
  extractExplicitId,
  isDeleteOperation,
  isWriteModule,
  missingScopesFor,
  sanitizeSensitiveText
} from "@/lib/safety-governance";
import { scriptEngine } from "@/lib/script-engine";

type Layer = "mcp" | "api" | "script";
type Risk = "none" | "low" | "medium" | "high";

export interface Step {
  layer?: Layer | "human";
  module?: string;
  action: string;
  tool?: string;
}

export interface OrchestratorResult {
  planId: string;
  intent: string;
  layer: Layer;
  module: string;
  steps: Step[];
  requiresConfirmation: boolean;
  risk: Risk;
  preview?: string;
  missingScopes?: string[];
  blockedReason?: string;
  requiresExactConfirmationText?: string;
}

export interface ExecutionResult {
  planId: string;
  status: "executed" | "blocked" | "cancelled";
  outputs: unknown[];
  message?: string;
}

export interface Orchestrator {
  processPrompt(prompt: string, portalId?: string): Promise<OrchestratorResult>;
  confirmAndExecute(planId: string, confirmationText?: string): Promise<ExecutionResult>;
  cancelPlan(planId: string): void;
}

type StoredPlan = {
  prompt: string;
  portalId: string;
  plan: OrchestratorResult;
  status: "pending" | "cancelled" | "executed";
};

const planStore = new Map<string, StoredPlan>();

function lower(value: string): string {
  return value.toLowerCase();
}

function detectModuleAndLayer(prompt: string): { layer: Layer; moduleCode: string; intent: string } {
  const text = lower(prompt);

  if (/(bulk|all contacts|all deals|all companies|\b\d{3,}\b|import|csv|export|download|extract|standardize all|clean up all)/.test(text)) {
    return { layer: "script", moduleCode: "F1-F6", intent: "Bulk/data transformation request" };
  }

  if (/(workflow|automation|property|field|list|segment|pipeline|stages)/.test(text)) {
    if (/(create workflow|build workflow|automation)/.test(text)) return { layer: "api", moduleCode: "B1-B2", intent: "Workflow creation request" };
    if (/(get workflow|list workflow|show workflow)/.test(text)) return { layer: "api", moduleCode: "B3", intent: "Workflow read request" };
    if (/(update workflow|modify workflow|change workflow)/.test(text)) return { layer: "api", moduleCode: "B4", intent: "Workflow update request" };
    if (/(delete workflow|remove workflow)/.test(text)) return { layer: "api", moduleCode: "B5", intent: "Workflow delete request" };
    if (/(create property|add property|new field)/.test(text)) return { layer: "api", moduleCode: "C2", intent: "Property creation request" };
    if (/(list properties|show properties|audit properties)/.test(text)) return { layer: "api", moduleCode: "C1/C5", intent: "Property audit request" };
    if (/(create list|create segment|smart list)/.test(text)) return { layer: "api", moduleCode: "D1-D2", intent: "List/segment request" };
    return { layer: "api", moduleCode: "E1-E2", intent: "Pipeline configuration request" };
  }

  if (/(delete|remove)/.test(text)) return { layer: "mcp", moduleCode: "A7", intent: "Delete CRM records" };
  if (/(associate|link|connect)/.test(text)) return { layer: "mcp", moduleCode: "A6", intent: "Association request" };
  if (/(add note|note on|log note)/.test(text)) return { layer: "mcp", moduleCode: "A5", intent: "Create note request" };
  if (/(create task|add task|follow-up|reminder)/.test(text)) return { layer: "mcp", moduleCode: "A4", intent: "Task creation request" };
  if (/(update|change|set|fix)/.test(text)) return { layer: "mcp", moduleCode: "A3", intent: "Update CRM records" };
  if (/(create|add|new)/.test(text)) return { layer: "mcp", moduleCode: "A2", intent: "Create CRM records" };

  return { layer: "mcp", moduleCode: "A1", intent: "Read/search CRM records" };
}

function riskFromPrompt(prompt: string, moduleCode: string): Risk {
  const text = lower(prompt);
  if (/(delete|remove)/.test(text) || moduleCode === "A7" || moduleCode === "B5") return "high";
  if (moduleCode.startsWith("F") || /(bulk|\b\d{2,}\b|all )/.test(text)) return "high";
  if (isWriteModule(moduleCode)) return "medium";
  return "none";
}

function buildPreview(plan: Omit<OrchestratorResult, "planId">): string {
  const stepLines = plan.steps.map((step, index) => `${index + 1}. ${step.action}`).join("\n");
  return `Intent: ${plan.intent}\nLayer: ${plan.layer} (${plan.module})\nRisk: ${plan.risk}\nSteps:\n${stepLines}`;
}

function tryParsePlanJson(text: string): Partial<OrchestratorResult> | null {
  const firstCurly = text.indexOf("{");
  const lastCurly = text.lastIndexOf("}");
  if (firstCurly < 0 || lastCurly <= firstCurly) return null;

  try {
    return JSON.parse(text.slice(firstCurly, lastCurly + 1)) as Partial<OrchestratorResult>;
  } catch {
    return null;
  }
}

async function llmPlan(prompt: string, scopes: string[], portalConfigText: string): Promise<Partial<OrchestratorResult> | null> {
  try {
    const client = getAnthropicClient();
    const systemPrompt = `You are the Vero HubSpot Operator. You help manage HubSpot portals.\n\nYou have three execution layers available:\n1) MCP LAYER for CRM ops (records/tasks/notes/associations)\n2) API LAYER for workflows/properties/lists/pipelines\n3) SCRIPT LAYER for bulk operations (50+ records) and transforms\n\nCURRENT PORTAL SCOPES: ${scopes.join(", ")}\nCURRENT PORTAL CONFIG: ${portalConfigText}\n\nRespond with a JSON object only:\n{\n  "intent":"...",\n  "layer":"mcp|api|script",\n  "module":"A1-A7/B1-B5/C1-C5/D1-D3/E1-E2/F1-F6",\n  "steps":[{"action":"...","tool":"..."}],\n  "requiresConfirmation":true,\n  "risk":"none|low|medium|high"\n}\n\nSafety:\n- Any write on production requires confirmation\n- Bulk (50+) routes to script with dry-run\n- Workflow deployment isEnabled false\n- Delete is high-risk and needs explicit confirmation\n- If scopes missing, include that in intent and choose best safe layer.`;

    const safePrompt = sanitizeSensitiveText(prompt);
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 900,
      temperature: 0,
      system: [{ type: "text", text: systemPrompt }],
      messages: [{ role: "user", content: safePrompt }]
    });

    const text = response.content
      .filter((block) => block.type === "text")
      .map((block) => (block.type === "text" ? block.text : ""))
      .join("\n");

    return tryParsePlanJson(text);
  } catch {
    return null;
  }
}

async function logExecution(portalId: string, args: {
  layer: "mcp" | "api" | "script";
  module: string;
  action: "script_execute" | "update";
  objectType: string;
  recordId: string;
  description: string;
  status: "success" | "error" | "dry_run";
  prompt?: string;
  error?: string;
  after?: object;
}): Promise<void> {
  try {
    await changeLogger.log({
      portalId,
      layer: args.layer,
      module: args.module,
      action: args.action,
      objectType: args.objectType,
      recordId: args.recordId,
      description: args.description,
      status: args.status,
      error: args.error,
      initiatedBy: "user",
      prompt: args.prompt,
      after: args.after
    });
  } catch {
    // Do not fail orchestration when logging fails.
  }
}

class LlmOrchestrator implements Orchestrator {
  async processPrompt(prompt: string, portalId?: string): Promise<OrchestratorResult> {
    const isFirstSession = authManager.isFirstSessionForActivePortal(portalId);
    await authManager.ensureValidatedForSession(portalId);

    const scopes = authManager.getScopes(portalId);
    const portal = authManager.getActivePortal(portalId);
    const portalConfig = await portalConfigStore.load(portal.id).catch(() => null);
    const portalConfigText = portalConfig ? JSON.stringify(portalConfig) : "{}";
    const safety = portalConfig?.safety;

    const fallback = detectModuleAndLayer(prompt);
    const llm = await llmPlan(prompt, scopes, portalConfigText);

    const layer = (llm?.layer as Layer) || fallback.layer;
    const moduleCode = llm?.module || fallback.moduleCode;
    const intent = llm?.intent || fallback.intent;

    const defaultSteps: Step[] = [
      {
        layer,
        module: moduleCode,
        action: intent,
        tool: layer === "api" ? "HubSpot REST API" : layer === "mcp" ? "HubSpot MCP tools" : "Script executor"
      }
    ];

    const steps = Array.isArray(llm?.steps) && llm?.steps.length > 0 ? llm.steps : defaultSteps;

    const promptRisk = riskFromPrompt(prompt, moduleCode);
    const llmRisk = llm?.risk;
    const risk: Risk = ["none", "low", "medium", "high"].includes(String(llmRisk)) ? (llmRisk as Risk) : promptRisk;

    const requireConfirmationByPolicy = safety?.requireConfirmation ?? true;
    const writeOperation = isWriteModule(moduleCode);
    const writeGate = canWriteInEnvironment({
      environment: portal.environment,
      isFirstSession,
      isWriteOperation: writeOperation
    });

    const requiredMissingScopes = missingScopesFor(moduleCode, layer, scopes);

    const promptCountMatch = prompt.match(/\b(\d{2,6})\b/);
    const promptCount = promptCountMatch ? Number(promptCountMatch[1]) : null;
    const exceedsMaxBulk = promptCount !== null && typeof safety?.maxBulkRecords === "number" && promptCount > safety.maxBulkRecords;

    const isDelete = isDeleteOperation(moduleCode, prompt);
    const deleteId = isDelete ? extractExplicitId(prompt) : null;
    const deleteBlockedByPolicy = isDelete && safety?.allowDeletes === false;
    const deleteMissingId = isDelete && !deleteId;

    const requiresConfirmation =
      requireConfirmationByPolicy || Boolean(llm?.requiresConfirmation) || writeOperation || risk !== "none";

    const blockedReason = !writeGate.allowed
      ? writeGate.reason
      : deleteBlockedByPolicy
        ? "Safety policy disallows deletes for this portal"
        : deleteMissingId
          ? "Delete operations require explicit record/workflow ID in the prompt (for example: flowId: 123456)."
          : exceedsMaxBulk
            ? `Requested record count exceeds safety.maxBulkRecords (${safety?.maxBulkRecords})`
            : requiredMissingScopes.length > 0
              ? `Missing required scope(s): ${requiredMissingScopes.join(", ")}`
              : undefined;

    const planWithoutId: Omit<OrchestratorResult, "planId"> = {
      intent,
      layer,
      module: moduleCode,
      steps,
      requiresConfirmation,
      risk,
      preview: "",
      missingScopes: requiredMissingScopes.length ? requiredMissingScopes : undefined,
      blockedReason,
      requiresExactConfirmationText: isDelete ? deleteId ?? undefined : undefined
    };

    planWithoutId.preview = buildPreview(planWithoutId);

    const planId = randomUUID();
    const plan: OrchestratorResult = { planId, ...planWithoutId };

    planStore.set(planId, {
      prompt,
      portalId: portal.id,
      plan,
      status: "pending"
    });

    return plan;
  }

  async confirmAndExecute(planId: string, confirmationText?: string): Promise<ExecutionResult> {
    const stored = planStore.get(planId);
    if (!stored || stored.status !== "pending") {
      return { planId, status: "blocked", outputs: [], message: "Plan not found or not pending" };
    }

    const { plan, prompt, portalId } = stored;
    if (plan.blockedReason) {
      return { planId, status: "blocked", outputs: [], message: plan.blockedReason };
    }

    if (plan.requiresConfirmation) {
      if (plan.requiresExactConfirmationText) {
        if ((confirmationText || "").trim() !== plan.requiresExactConfirmationText) {
          return {
            planId,
            status: "blocked",
            outputs: [],
            message: `Delete confirmation failed. Re-submit with confirmationText exactly: ${plan.requiresExactConfirmationText}`
          };
        }
      } else if (!confirmationText || !/(yes|confirm|proceed)/i.test(confirmationText)) {
        return {
          planId,
          status: "blocked",
          outputs: [],
          message: "Confirmation required. Provide confirmationText: yes|confirm|proceed"
        };
      }
    }

    const outputs: unknown[] = [];

    try {
      if (plan.layer === "mcp") {
        await authManager.withPortal(portalId, async () => mcpConnector.connectWithAuthManager());
        const result = await authManager.withPortal(portalId, async () => mcpConnector.executePrompt(prompt, { planId, module: plan.module }));
        outputs.push(result);
        await logExecution(portalId, {
          layer: "mcp",
          module: plan.module,
          action: "update",
          objectType: "mcp_operation",
          recordId: planId,
          description: `Executed MCP plan ${planId}`,
          status: "success",
          prompt,
          after: { result }
        });
      } else if (plan.layer === "api") {
        const result = await authManager.withPortal(portalId, async () => executeApiPlan(plan));
        outputs.push(result);
      } else {
        const generatedScript = await authManager.withPortal(portalId, async () => scriptEngine.generate(prompt));
        const result = await authManager.withPortal(portalId, async () => scriptEngine.execute(generatedScript, "dry-run"));
        outputs.push({ script: generatedScript, result });
        await logExecution(portalId, {
          layer: "script",
          module: plan.module,
          action: "script_execute",
          objectType: "script",
          recordId: generatedScript.id,
          description: `Dry-run script plan ${planId}`,
          status: "dry_run",
          prompt,
          after: result
        });
      }
    } catch (error) {
      await logExecution(portalId, {
        layer: plan.layer,
        module: plan.module,
        action: plan.layer === "script" ? "script_execute" : "update",
        objectType: `${plan.layer}_operation`,
        recordId: planId,
        description: `Failed execution for plan ${planId}`,
        status: "error",
        prompt,
        error: error instanceof Error ? error.message : "Execution failed"
      });
      throw error;
    }

    stored.status = "executed";
    planStore.set(planId, stored);

    return {
      planId,
      status: "executed",
      outputs
    };
  }

  cancelPlan(planId: string): void {
    const stored = planStore.get(planId);
    if (!stored) return;

    stored.status = "cancelled";
    planStore.set(planId, stored);
  }
}

async function executeApiPlan(plan: OrchestratorResult): Promise<unknown> {
  const firstStep = plan.steps[0];
  const tool = firstStep?.tool || "";
  const directEndpointMatch = tool.match(/^(GET|POST|PUT|PATCH|DELETE)\s+(\/[^\s]+)$/i);

  if (directEndpointMatch) {
    const method = directEndpointMatch[1].toUpperCase();
    const endpointPath = directEndpointMatch[2];

    if (method === "GET") return hubSpotClient.get(endpointPath);
    if (method === "POST") return hubSpotClient.post(endpointPath, {});
    if (method === "PUT") return hubSpotClient.put(endpointPath, {});
    if (method === "PATCH") return hubSpotClient.patch(endpointPath, {});
    return hubSpotClient.delete(endpointPath);
  }

  if (plan.module.startsWith("B")) return apiClient.workflows.list();
  if (plan.module.startsWith("C")) return apiClient.properties.list("contacts");
  if (plan.module.startsWith("D")) return apiClient.lists.list();
  if (plan.module.startsWith("E")) return apiClient.pipelines.list("deals");

  return { status: "noop", message: `No direct API executor for module ${plan.module}` };
}

export const orchestrator: Orchestrator = new LlmOrchestrator();
export const REQUIRED_SCOPES_REFERENCE = HUBSPOT_PRIVATE_APP_REQUIRED_SCOPES;
export function listPlanIds(): string[] {
  return Array.from(planStore.keys());
}
