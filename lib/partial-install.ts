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

import { hubSpotClient, HubSpotApiError } from "@/lib/api-client";
import type { ManualStep, StrippedAction } from "@/lib/template-types";
import db from "@/lib/db";

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

// Action types known to fail on most portals (silent 500s, missing scopes)
const UNIVERSALLY_BROKEN_ACTION_TYPES = new Set(["0-9", "0-11"]);

// Deprecated action types that should be auto-replaced before deployment
const DEPRECATED_ACTION_REPLACEMENTS: Record<string, string> = {
  "0-7": "0-3",        // Old Create task → new Create task
  "0-13": "0-63809083", // Alter list membership → Add to static list
};

// ---------------------------------------------------------------------------
// Error Classification — distinguish action-type errors from auth/scope/rate errors
// ---------------------------------------------------------------------------

/**
 * Determine whether a HubSpot API error is likely caused by unsupported action
 * types (and thus eligible for partial-install retry) versus a structural error
 * like auth failure, missing scope, malformed payload, or rate limiting.
 */
export function isActionTypeError(error: unknown): boolean {
  if (error instanceof HubSpotApiError) {
    // Auth, permission, and rate limit errors are never action-type errors
    if ([401, 403, 429].includes(error.statusCode)) return false;
    // 404 is "endpoint not found", not an action type issue
    if (error.statusCode === 404) return false;
  }

  const message = error instanceof Error ? error.message : String(error);
  const lowerMessage = message.toLowerCase();

  // Check for action-type-related keywords in the error
  const actionTypePatterns = [
    /action\s*type/i,
    /actiontypeid/i,
    /not\s+(?:available|supported|allowed|enabled)/i,
    /unsupported\s+action/i,
  ];

  for (const pattern of actionTypePatterns) {
    if (pattern.test(message)) return true;
  }

  // HubSpot sometimes returns generic 400/500 for action type issues.
  // Be selective: only allow partial-install for errors likely caused by action types.
  if (error instanceof HubSpotApiError) {
    // Check if the error mentions specific structural issues that are NOT about action types
    const structuralErrors = [
      /required\s+field/i,
      /invalid\s+(?:type|format|value)/i,
      /missing\s+(?:required|property)/i,
      /enrollment/i,
      /filter/i,
      /nextAvailableActionId/i,
      /startActionId/i,
      /objectTypeId/i,
      /malformed/i,
      /parse\s*error/i,
    ];
    for (const pattern of structuralErrors) {
      if (pattern.test(lowerMessage) && !actionTypePatterns.some(p => p.test(message))) {
        return false;
      }
    }
    // For 400s with no identifiable cause, allow partial install to try
    // (it will fail fast if no actions can be identified to strip)
    if (error.statusCode === 400) return true;
    // For 500s, only retry if the message contains action-related hints
    if (error.statusCode >= 500) {
      return /action/i.test(lowerMessage);
    }
  }

  return false;
}

// ---------------------------------------------------------------------------
// Pre-flight Action Type Stripping
// ---------------------------------------------------------------------------

/**
 * Get the set of action type IDs known to be broken on a specific portal.
 * Reads from cached deep_health_check results + universal broken list.
 */
export function getKnownBrokenActionTypes(portalId?: string): Set<string> {
  const broken = new Set(UNIVERSALLY_BROKEN_ACTION_TYPES);

  if (portalId) {
    try {
      const row = db
        .prepare("SELECT value FROM app_settings WHERE key = ?")
        .get(`health_deep_${portalId}`) as { value: string } | undefined;

      if (row) {
        const health = JSON.parse(row.value) as {
          action_types?: { broken?: Array<{ id: string }> };
        };
        if (health.action_types?.broken) {
          for (const action of health.action_types.broken) {
            broken.add(action.id);
          }
        }
      }
    } catch {
      // Fall back to universal list only
    }
  }

  return broken;
}

/**
 * Pre-strip known broken action types from a workflow payload BEFORE
 * sending it to HubSpot. Returns the cleaned payload and any stripped actions.
 */
export function preStripBrokenActions(
  payload: Record<string, unknown>,
  workflowName: string,
  portalId?: string
): {
  payload: Record<string, unknown>;
  strippedActions: StrippedAction[];
  manualSteps: ManualStep[];
} {
  const brokenTypes = getKnownBrokenActionTypes(portalId);
  const actions = (Array.isArray(payload.actions) ? payload.actions : []) as WorkflowAction[];

  // Phase 1: Auto-replace deprecated action types with their modern equivalents
  let hasReplacements = false;
  const updatedActions = actions.map((action) => {
    const typeId = String(action.actionTypeId ?? "");
    if (typeId && typeId in DEPRECATED_ACTION_REPLACEMENTS) {
      hasReplacements = true;
      return { ...action, actionTypeId: DEPRECATED_ACTION_REPLACEMENTS[typeId] };
    }
    return action;
  });

  const workingPayload = hasReplacements ? { ...payload, actions: updatedActions } : payload;
  const currentActions = (Array.isArray(workingPayload.actions) ? workingPayload.actions : []) as WorkflowAction[];

  // Phase 2: Strip known broken action types
  const actionsToRemove = new Set<string>();
  const strippedActions: StrippedAction[] = [];

  for (const action of currentActions) {
    const typeId = String(action.actionTypeId ?? "");
    if (typeId && brokenTypes.has(typeId)) {
      const actionId = String(action.actionId ?? "");
      actionsToRemove.add(actionId);
      strippedActions.push({
        actionId,
        actionTypeId: typeId,
        label: getActionTypeLabel(typeId),
        reason: `Pre-stripped: action type ${typeId} is known to fail on this portal`,
        manualStep: buildManualStep(typeId, workflowName, actionId),
      });
    }
  }

  if (actionsToRemove.size === 0) {
    return { payload: workingPayload, strippedActions: [], manualSteps: [] };
  }

  const cleaned = stripActionsAndRelink(workingPayload, actionsToRemove);

  return { payload: cleaned, strippedActions, manualSteps: buildManualSteps(strippedActions) };
}

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
  /** false when the error parser couldn't identify which actions to strip */
  parseSucceeded?: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getActionTypeLabel(actionTypeId: string): string {
  return ACTION_TYPE_LABELS[actionTypeId] ?? `Action type ${actionTypeId}`;
}

function buildManualSteps(stripped: StrippedAction[]): ManualStep[] {
  return stripped.map((sa) => ({ step: sa.manualStep, priority: "required" as const }));
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
  context?: Record<string, unknown>;
}

/**
 * Parse a HubSpot API error to find which actionTypeIds and/or action array
 * indices are problematic.
 */
export function parseHubSpotWorkflowError(error: unknown): {
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

  // Support both HubSpotApiError (has properties directly) and axios-style errors
  const hsError = error as {
    statusCode?: number;
    category?: string;
    response?: { data?: HubSpotApiErrorBody };
    message?: string;
    context?: Record<string, unknown>;
  };

  rawMessage = hsError.message || rawMessage;

  // HubSpotApiError from api-client.ts has properties directly on the error
  // Axios-style errors have them on response.data
  const data: HubSpotApiErrorBody | undefined = hsError.response?.data || (
    hsError.category ? {
      status: String(hsError.statusCode ?? ""),
      message: hsError.message,
      category: hsError.category,
    } : undefined
  );

  if (!data && !hsError.message) {
    return { problematicActionTypeIds, problematicActionIndices, rawMessage };
  }

  const topMessage = data?.message || hsError.message || "";
  if (topMessage) rawMessage = topMessage;

  // --- Strategy 1: Parse structured error fields first (most reliable) ---
  if (Array.isArray(data?.errors)) {
    for (const err of data.errors) {
      // Check for structured code/subCategory fields
      const code = String(err.code || "");
      const msg = err.message || "";

      // Extract index from "in" field: "actions[2]" or "actions[2].actionTypeId"
      const inField = err.in || "";
      const indexMatch = inField.match(/actions\[(\d+)\]/);
      if (indexMatch) {
        problematicActionIndices.add(parseInt(indexMatch[1], 10));
      }

      // Parse actionTypeId from structured error context
      if (code === "INVALID_ACTION_TYPE" || code === "UNSUPPORTED_ACTION_TYPE") {
        extractTypeIds(msg, problematicActionTypeIds);
      } else {
        extractTypeIds(msg, problematicActionTypeIds);
      }
    }
  }

  // --- Strategy 2: Parse top-level message (fallback — only if strategy 1 found nothing) ---
  if (problematicActionTypeIds.size === 0 && problematicActionIndices.size === 0) {
    extractTypeIds(topMessage, problematicActionTypeIds);
  }

  // --- Strategy 3: Parse HubSpot context object (fallback — only if still nothing) ---
  if (problematicActionTypeIds.size > 0 || problematicActionIndices.size > 0) {
    return { problematicActionTypeIds, problematicActionIndices, rawMessage };
  }
  const context = data?.context || hsError.context;
  if (context && typeof context === "object") {
    const ctxRecord = context as Record<string, unknown>;
    // HubSpot sometimes puts the problematic actionTypeId in context fields
    for (const [key, value] of Object.entries(ctxRecord)) {
      if (key.toLowerCase().includes("actiontype") && typeof value === "string") {
        const match = value.match(/^(\d+-\d+)$/);
        if (match) problematicActionTypeIds.add(match[1]);
      }
    }
  }

  return { problematicActionTypeIds, problematicActionIndices, rawMessage };
}

// Known HubSpot correlation ID pattern — exclude from action type matching
const CORRELATION_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}/i;

function extractTypeIds(msg: string, target: Set<string>): void {
  // Pattern 1: "action type 0-11 is not available" or "actionTypeId 0-11"
  const pattern = /(?:action\s*type\s+|actionTypeId["\s:]+)([\d]+-[\d]+)/gi;
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(msg)) !== null) {
    if (!CORRELATION_ID_PATTERN.test(m[1])) {
      target.add(m[1]);
    }
  }

  // Pattern 2: "X-Y not supported / not available / not allowed"
  // Use word boundary and ensure it looks like an action type (small numbers)
  const bare = /\b(\d{1,2}-\d{1,3})\b(?=.*?(?:not\s+(?:available|supported|allowed|enabled)|unsupported|invalid))/gi;
  let b: RegExpExecArray | null;
  while ((b = bare.exec(msg)) !== null) {
    // Exclude patterns that look like version numbers (e.g., "3-0" with preceding "v")
    // or correlation IDs
    const candidate = b[1];
    if (!CORRELATION_ID_PATTERN.test(candidate) && !/v\d/.test(msg.substring(Math.max(0, b.index - 2), b.index))) {
      target.add(candidate);
    }
  }
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
 * @param initialError  If provided, skip the first API call and parse this error directly.
 *                      This avoids a redundant deployment attempt when the caller already tried and failed.
 */
export async function attemptPartialWorkflowInstall(
  payload: Record<string, unknown>,
  workflowName: string,
  initialError?: unknown
): Promise<PartialWorkflowInstallResult> {
  let currentPayload = { ...payload };
  const allStrippedActions: StrippedAction[] = [];
  let attempts = 0;

  // If we have an initial error from the caller, process it first without making an API call
  if (initialError) {
    attempts++;
    const {
      problematicActionTypeIds,
      problematicActionIndices,
      rawMessage,
    } = parseHubSpotWorkflowError(initialError);

    const actions = (
      Array.isArray(currentPayload.actions) ? currentPayload.actions : []
    ) as WorkflowAction[];

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
      return {
        status: "failed",
        installedActionIds: [],
        strippedActions: [],
        manualSteps: [],
        attemptsNeeded: attempts,
        error: rawMessage,
        parseSucceeded: false,
      };
    }

    for (const actionId of Array.from(actionsToRemove)) {
      const action = actions.find((a) => String(a.actionId ?? "") === actionId);
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

    currentPayload = stripActionsAndRelink(currentPayload, actionsToRemove);

    const remaining = (
      Array.isArray(currentPayload.actions) ? currentPayload.actions : []
    ) as WorkflowAction[];

    if (remaining.length === 0) {
      return {
        status: "failed",
        installedActionIds: [],
        strippedActions: allStrippedActions,
        manualSteps: buildManualSteps(allStrippedActions),
        attemptsNeeded: attempts,
        error: "All actions were stripped — no deployable actions remain",
        parseSucceeded: true,
      };
    }
  }

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

      return {
        flowId,
        status: allStrippedActions.length > 0 ? "partial" : "success",
        installedActionIds: installedActions.map((a) => String(a.actionId ?? "")),
        strippedActions: allStrippedActions,
        manualSteps: buildManualSteps(allStrippedActions),
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
        return {
          status: "failed",
          installedActionIds: [],
          strippedActions: allStrippedActions,
          manualSteps: buildManualSteps(allStrippedActions),
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
        return {
          status: "failed",
          installedActionIds: [],
          strippedActions: allStrippedActions,
          manualSteps: buildManualSteps(allStrippedActions),
          attemptsNeeded: attempts,
          error: "All actions were stripped — no deployable actions remain",
        };
      }
    }
  }

  // Exhausted retries
  return {
    status: "failed",
    installedActionIds: [],
    strippedActions: allStrippedActions,
    manualSteps: buildManualSteps(allStrippedActions),
    attemptsNeeded: attempts,
    error: "Maximum retry attempts reached during partial install",
  };
}
