/**
 * Partial-Install Engine for HubSpot Workflow Automation v4
 *
 * When a full workflow deployment fails (e.g. unsupported action types, missing
 * scopes), this engine:
 *
 *  1. Parses the HubSpot error response to identify which action type(s) are
 *     problematic.
 *  2. Strips those actions from the workflow spec and re-links the action chain
 *     around them.
 *  3. Retries the deploy with the reduced spec (up to MAX_ATTEMPTS times).
 *  4. Returns a structured report: installed action IDs, stripped actions with
 *     manual-completion steps, and how many attempts were needed.
 *
 * The caller is responsible for logging new failure patterns to skills-learner.
 */

import { hubSpotClient } from "@/lib/api-client";
import type { ManualStep, StrippedAction } from "@/lib/template-types";

// ---------------------------------------------------------------------------
// Constants — known action types and their manual-fallback instructions
// ---------------------------------------------------------------------------

const ACTION_TYPE_LABELS: Record<string, string> = {
  "0-1": "Send marketing email",
  "0-2": "Send automated email",
  "0-3": "Create task",
  "0-4": "Set contact property (legacy)",
  "0-5": "Set property",
  "0-6": "Copy property value",
  "0-7": "Clear property value",
  "0-8": "Internal email notification",
  "0-9": "In-app notification",
  "0-10": "Webhook",
  "0-11": "Rotate record to owner",
  "0-12": "Manage subscription",
  "0-14": "Add to workflow",
  "0-15": "Send SMS",
  "0-18": "Score property",
  "0-22": "Add to list",
  "0-23": "Remove from list",
  "0-25": "Custom code",
  "0-35": "Delay",
};

const ACTION_TYPE_MANUAL_STEPS: Record<string, string> = {
  "0-3":
    "In HubSpot UI: open the workflow → Edit → Add action → Create task → fill in task details. " +
    "Note: requires the 'tasks' scope. Check portal_capabilities first. " +
    "Alternative: use Internal email notification (0-8) to alert the owner instead.",
  "0-9":
    "In HubSpot UI: open the workflow → Edit → Add action → In-app notification → choose recipients and message. " +
    "Alternative: use Internal email notification (0-8) which works reliably across all portals.",
  "0-11":
    "In HubSpot UI: open the workflow → Edit → Add action → Rotate record to owner → configure rotation pool. " +
    "Alternative: use Set Property (0-5) with hubspot_owner_id to assign a specific owner directly.",
  "0-15":
    "In HubSpot UI: open the workflow → Edit → Add action → Send SMS → configure message and sender. " +
    "Requires the SMS add-on or a Twilio integration to be active on the portal.",
  "0-1":
    "In HubSpot UI: open the workflow → Edit → Add action → Send email → select a published marketing email.",
  "0-2":
    "In HubSpot UI: open the workflow → Edit → Add action → Send email → select an automated email template.",
};

const MAX_ATTEMPTS = 5;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type WorkflowAction = Record<string, unknown>;

export interface PartialWorkflowInstallResult {
  /** HubSpot flowId on success or partial success */
  flowId?: string;
  /** success = all actions installed; partial = some stripped; failed = nothing deployed */
  status: "success" | "partial" | "failed";
  /** actionIds of actions actually deployed to HubSpot */
  installedActionIds: string[];
  /** actions stripped from the spec with the reasons why */
  strippedActions: StrippedAction[];
  /** manual steps the user must take to complete the workflow */
  manualSteps: ManualStep[];
  /** total deploy attempts made */
  attemptsNeeded: number;
  /** final error if status === "failed" */
  error?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getActionTypeLabel(actionTypeId: string): string {
  return ACTION_TYPE_LABELS[actionTypeId] ?? `Action type ${actionTypeId}`;
}

function buildManualStep(
  actionTypeId: string,
  workflowName: string,
  actionId: string
): string {
  const label = getActionTypeLabel(actionTypeId);
  const base = ACTION_TYPE_MANUAL_STEPS[actionTypeId];
  const context = `[Workflow: "${workflowName}", action ID: ${actionId} (${label}, type ${actionTypeId})]`;
  if (base) return `${context} ${base}`;
  return (
    `${context} Add this action manually: open the workflow in HubSpot UI → ` +
    `Automation → Workflows → "${workflowName}" → Edit → find the correct ` +
    `position in the flow → Add action → search for "${label}".`
  );
}

// ---------------------------------------------------------------------------
// Error Parsing
// ---------------------------------------------------------------------------

interface HubSpotApiErrorBody {
  status?: string;
  message?: string;
  errors?: Array<{ message?: string; in?: string; code?: string }>;
  category?: string;
}

/**
 * Parse a HubSpot API error to find which actionTypeIds and/or action array
 * indices are problematic.
 */
function parseHubSpotWorkflowError(error: unknown): {
  problematicActionTypeIds: Set<string>;
  problematicActionIndices: Set<number>;
  rawMessage: string;
} {
  const problematicActionTypeIds = new Set<string>();
  const problematicActionIndices = new Set<number>();
  let rawMessage = "Unknown error";

  if (!error || typeof error !== "object") {
    return { problematicActionTypeIds, problematicActionIndices, rawMessage };
  }

  const axiosError = error as {
    response?: { data?: HubSpotApiErrorBody };
    message?: string;
  };

  rawMessage = axiosError.message || rawMessage;
  const data = axiosError.response?.data;
  if (!data) {
    return { problematicActionTypeIds, problematicActionIndices, rawMessage };
  }

  const topMessage = data.message || "";
  if (topMessage) rawMessage = topMessage;

  // Pattern: "action type 0-11 is not available" or "0-11" adjacent to keywords
  function extractTypeIds(msg: string): void {
    const pattern = /(?:action\s+type\s+|actionTypeId["\s:]+)([\d]+-[\d]+)/gi;
    let m: RegExpExecArray | null;
    while ((m = pattern.exec(msg)) !== null) {
      problematicActionTypeIds.add(m[1]);
    }
    // Also pick up bare "X-Y not supported / not available / not allowed" patterns
    const bare = /\b([\d]+-[\d]+)\b.*?(?:not\s+(?:available|supported|allowed|enabled))/gi;
    let b: RegExpExecArray | null;
    while ((b = bare.exec(msg)) !== null) {
      problematicActionTypeIds.add(b[1]);
    }
  }

  extractTypeIds(topMessage);

  if (Array.isArray(data.errors)) {
    for (const err of data.errors) {
      const msg = err.message || "";
      extractTypeIds(msg);

      // Extract index from "in" field: "actions[2]" or "actions[2].actionTypeId"
      const inField = err.in || "";
      const indexMatch = inField.match(/actions\[(\d+)\]/);
      if (indexMatch) {
        problematicActionIndices.add(parseInt(indexMatch[1], 10));
      }
    }
  }

  return { problematicActionTypeIds, problematicActionIndices, rawMessage };
}

// ---------------------------------------------------------------------------
// Action-chain re-linking
// ---------------------------------------------------------------------------

/**
 * Given a set of actionIds to remove, re-link all references in the workflow:
 *  - connection.nextActionId
 *  - listBranches[].nextActionId
 *  - branches[].nextActionId
 *  - defaultBranch.nextActionId
 *  - startActionId at the top level
 *
 * When a reference points to a stripped action, we "follow through" to that
 * action's own nextActionId (recursive skip), effectively bypassing it.
 */
function stripActionsAndRelink(
  payload: Record<string, unknown>,
  actionsToRemove: Set<string>
): Record<string, unknown> {
  const actions = (
    Array.isArray(payload.actions) ? payload.actions : []
  ) as WorkflowAction[];

  // Build stripped-action → its nextActionId map for follow-through
  const strippedNextMap = new Map<string, string | undefined>();
  for (const action of actions) {
    const id = String(action.actionId ?? "");
    if (actionsToRemove.has(id)) {
      const conn = action.connection as { nextActionId?: string } | undefined;
      strippedNextMap.set(id, conn?.nextActionId);
    }
  }

  /** Resolve a nextActionId, skipping over any stripped actions. */
  function resolveNextId(nextId: string | undefined): string | undefined {
    if (!nextId) return undefined;
    let current = nextId;
    const visited = new Set<string>();
    while (actionsToRemove.has(current)) {
      if (visited.has(current)) return undefined; // circular safety
      visited.add(current);
      const next = strippedNextMap.get(current);
      if (!next) return undefined;
      current = next;
    }
    return current;
  }

  // Build updated actions array (stripped ones removed, remaining re-linked)
  const newActions: WorkflowAction[] = [];
  for (const action of actions) {
    const id = String(action.actionId ?? "");
    if (actionsToRemove.has(id)) continue;

    const newAction: WorkflowAction = { ...action };

    // Re-link connection
    const conn = action.connection as Record<string, unknown> | undefined;
    if (conn && conn.nextActionId) {
      const resolved = resolveNextId(String(conn.nextActionId));
      const newConn = { ...conn };
      if (resolved) {
        newConn.nextActionId = resolved;
      } else {
        delete newConn.nextActionId;
      }
      newAction.connection = newConn;
    }

    // Re-link branch arrays: listBranches, branches
    for (const branchField of ["listBranches", "branches"]) {
      if (Array.isArray(action[branchField])) {
        newAction[branchField] = (
          action[branchField] as Array<Record<string, unknown>>
        ).map((branch) => {
          if (!branch.nextActionId) return branch;
          const resolved = resolveNextId(String(branch.nextActionId));
          const newBranch = { ...branch };
          if (resolved) {
            newBranch.nextActionId = resolved;
          } else {
            delete newBranch.nextActionId;
          }
          return newBranch;
        });
      }
    }

    // Re-link defaultBranch
    if (action.defaultBranch && typeof action.defaultBranch === "object") {
      const db = action.defaultBranch as Record<string, unknown>;
      if (db.nextActionId) {
        const resolved = resolveNextId(String(db.nextActionId));
        const newDb = { ...db };
        if (resolved) {
          newDb.nextActionId = resolved;
        } else {
          delete newDb.nextActionId;
        }
        newAction.defaultBranch = newDb;
      }
    }

    newActions.push(newAction);
  }

  // Re-link startActionId if it pointed to a stripped action
  let startActionId = String(payload.startActionId ?? "");
  if (actionsToRemove.has(startActionId)) {
    startActionId = resolveNextId(startActionId) ?? "";
  }

  // Recalculate nextAvailableActionId
  const numericIds = newActions
    .map((a) => Number(a.actionId))
    .filter((n) => Number.isFinite(n));
  const maxId = numericIds.length ? Math.max(...numericIds) : 0;
  const nextAvailableActionId = String(maxId + 1);

  return {
    ...payload,
    actions: newActions,
    startActionId: startActionId || payload.startActionId,
    nextAvailableActionId,
  };
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Attempt to deploy a workflow, stripping unsupported actions iteratively
 * until the deploy succeeds or all actions are gone.
 *
 * @param payload   Full HubSpot v4 workflow payload (will NOT be mutated)
 * @param workflowName  Name used in manual-step instructions
 */
export async function attemptPartialWorkflowInstall(
  payload: Record<string, unknown>,
  workflowName: string
): Promise<PartialWorkflowInstallResult> {
  let currentPayload = { ...payload };
  const allStrippedActions: StrippedAction[] = [];
  let attempts = 0;

  while (attempts < MAX_ATTEMPTS) {
    attempts++;

    // Rate-limit delay on retries
    if (attempts > 1) {
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }

    try {
      const response = await hubSpotClient.post(
        "/automation/v4/flows",
        currentPayload
      );
      const created = response.data as { id?: string; flowId?: string };
      const flowId = created.id || created.flowId;

      const installedActions = (
        Array.isArray(currentPayload.actions) ? currentPayload.actions : []
      ) as WorkflowAction[];

      const manualSteps: ManualStep[] = allStrippedActions.map((sa) => ({
        step: sa.manualStep,
        priority: "required" as const,
      }));

      return {
        flowId,
        status: allStrippedActions.length > 0 ? "partial" : "success",
        installedActionIds: installedActions.map((a) => String(a.actionId ?? "")),
        strippedActions: allStrippedActions,
        manualSteps,
        attemptsNeeded: attempts,
      };
    } catch (error) {
      const {
        problematicActionTypeIds,
        problematicActionIndices,
        rawMessage,
      } = parseHubSpotWorkflowError(error);

      const actions = (
        Array.isArray(currentPayload.actions) ? currentPayload.actions : []
      ) as WorkflowAction[];

      // Identify action IDs to remove
      const actionsToRemove = new Set<string>();

      for (const action of actions) {
        const typeId = String(action.actionTypeId ?? "");
        if (typeId && problematicActionTypeIds.has(typeId)) {
          actionsToRemove.add(String(action.actionId ?? ""));
        }
      }

      for (const idx of Array.from(problematicActionIndices)) {
        if (idx < actions.length) {
          const id = String(actions[idx].actionId ?? "");
          if (id) actionsToRemove.add(id);
        }
      }

      if (actionsToRemove.size === 0) {
        // Cannot identify which actions are at fault — give up
        const manualSteps: ManualStep[] = allStrippedActions.map((sa) => ({
          step: sa.manualStep,
          priority: "required" as const,
        }));
        return {
          status: "failed",
          installedActionIds: [],
          strippedActions: allStrippedActions,
          manualSteps,
          attemptsNeeded: attempts,
          error: rawMessage,
        };
      }

      // Record stripped actions
      for (const actionId of Array.from(actionsToRemove)) {
        const action = actions.find(
          (a) => String(a.actionId ?? "") === actionId
        );
        if (!action) continue;
        const actionTypeId = String(action.actionTypeId ?? "unknown");
        allStrippedActions.push({
          actionId,
          actionTypeId,
          label: getActionTypeLabel(actionTypeId),
          reason: rawMessage,
          manualStep: buildManualStep(actionTypeId, workflowName, actionId),
        });
      }

      // Strip and re-link the chain
      currentPayload = stripActionsAndRelink(currentPayload, actionsToRemove);

      // If no actions remain, bail out
      const remaining = (
        Array.isArray(currentPayload.actions) ? currentPayload.actions : []
      ) as WorkflowAction[];

      if (remaining.length === 0) {
        const manualSteps: ManualStep[] = allStrippedActions.map((sa) => ({
          step: sa.manualStep,
          priority: "required" as const,
        }));
        return {
          status: "failed",
          installedActionIds: [],
          strippedActions: allStrippedActions,
          manualSteps,
          attemptsNeeded: attempts,
          error: "All actions were stripped — no deployable actions remain",
        };
      }
    }
  }

  // Exhausted retries
  const manualSteps: ManualStep[] = allStrippedActions.map((sa) => ({
    step: sa.manualStep,
    priority: "required" as const,
  }));
  return {
    status: "failed",
    installedActionIds: [],
    strippedActions: allStrippedActions,
    manualSteps,
    attemptsNeeded: attempts,
    error: "Maximum retry attempts reached during partial install",
  };
}
