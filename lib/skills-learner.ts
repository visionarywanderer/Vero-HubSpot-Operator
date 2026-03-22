/**
 * Skills Learner — auto-appends new failure/success patterns to the
 * hubspot-learnings SKILL.md so Claude learns from every operation.
 *
 * Rules:
 *  - Best-effort: never throws, never blocks the caller
 *  - Deduplicates: won't add a pattern that is already mentioned in the file
 *  - Appends in the correct format so the human-readable log stays clean
 *  - Auto-sanitizes portal-specific data (IDs, emails, UUIDs)
 */

import * as fs from "fs";
import * as path from "path";

// ---------------------------------------------------------------------------
// Known alternatives & fixes
// ---------------------------------------------------------------------------

/** Known alternatives for unsupported workflow action types */
const KNOWN_ALTERNATIVES: Record<string, string> = {
  "0-9":
    "Use Internal email notification (0-8) instead — works reliably on all portals",
  "0-11":
    "Use Set Property (0-5) with hubspot_owner_id + a STATIC_VALUE to assign a specific owner",
  "0-3":
    "Use Internal email notification (0-8) as an alternative notification mechanism",
  "0-15":
    "No direct HubSpot alternative — requires SMS add-on or Twilio integration",
  "0-1":
    "Ensure a published marketing email exists; or use 0-8 Internal email for internal notifications",
};

/** Known error patterns → recommended fixes for all resource types */
const KNOWN_FIXES: Record<string, string> = {
  "property already exists":
    "Check list_properties before creating. Use update_property to modify existing properties.",
  "a property with that name already exists":
    "Check list_properties before creating. Use update_property to modify existing properties.",
  "invalid property option":
    "Enumeration properties require options array with {label, value, displayOrder} for each option.",
  "invalid input json":
    "Check field names and value types match HubSpot's API spec. Common: groupName vs group_name.",
  "objecttype":
    "Valid objectType values: contacts, companies, deals, tickets. Use lowercase.",
  "filterbranchtype":
    "List filters must use OR→AND→filters hierarchy: filterBranchType + filterBranchOperator at each level.",
  "enumeration":
    "ENUMERATION filters: operationType: ENUMERATION, operator: IS_ANY_OF, values: [] (array, NOT singular value).",
  "multistring":
    "MULTISTRING filters: operationType: MULTISTRING, operator: CONTAINS, value: (singular, NOT array).",
  "stage":
    "Deal pipelines MUST have Closed Won (metadata: isClosed=true, closedWon=true) and Closed Lost (isClosed=true, closedWon=false).",
  "scope":
    "Missing OAuth scope. Re-authorize the portal with required scopes via /portals page.",
};

/** Patterns that warrant auto-addition to Quick Reference table */
const QUICK_REF_PATTERNS: Array<{ match: RegExp; category: string; rule: string }> = [
  { match: /type.*fieldType|fieldType.*type/i, category: "PROPERTY", rule: "Validate type/fieldType combination before create_property" },
  { match: /already exists/i, category: "GENERAL", rule: "Check resource existence before creating to avoid duplicates" },
  { match: /closed.*won|closed.*lost|isClosed/i, category: "PIPELINE", rule: "Deal pipelines must include Closed Won and Closed Lost stages" },
  { match: /filterBranch|filterBranchType/i, category: "LIST", rule: "List filters require OR→AND→filters hierarchy structure" },
  { match: /scope.*required|missing.*scope/i, category: "GENERAL", rule: "Verify portal scopes with deep_health_check before deployment" },
  { match: /rate.*limit|429/i, category: "GENERAL", rule: "Add 3-second delay between workflow creations; batch other resources" },
];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type LearningCategory =
  | "WORKFLOW"
  | "PROPERTY"
  | "PIPELINE"
  | "LIST"
  | "TEMPLATE"
  | "CUSTOM_OBJECT"
  | "ASSOCIATION"
  | "GENERAL";

interface PartialInstallLearning {
  category: "WORKFLOW" | "TEMPLATE";
  workflowName: string;
  actionTypeId: string;
  actionLabel: string;
  error: string;
}

export interface ResourceLearning {
  category: LearningCategory;
  resourceKey: string;
  operation: string;
  error: string;
  context?: string;
}

export interface SuccessPattern {
  category: LearningCategory;
  resourceKey: string;
  detail: string;
}

// ---------------------------------------------------------------------------
// Path & helpers
// ---------------------------------------------------------------------------

const SKILLS_PATH = path.join(
  process.env.HOME ?? process.cwd(),
  ".claude",
  "skills",
  "hubspot-learnings",
  "SKILL.md"
);

function today(): string {
  return new Date().toISOString().split("T")[0];
}

/** Strip portal-specific data from learnings entries */
function sanitize(text: string): string {
  return text
    // UUIDs first (before portal ID regex can eat parts of them)
    .replace(
      /[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/gi,
      "{uuid}"
    )
    // Emails
    .replace(/[\w.+-]+@[\w.-]+\.\w{2,}/g, "{email}")
    // "portal 12345" / "Hub 12345"
    .replace(/(?:portal|hub)\s+\d+/gi, "portal {portal_id}")
    // portalId=12345 or portalId: "12345"
    .replace(/portalId[=:]\s*"?\d+"?/gi, 'portalId={portal_id}')
    // Standalone 6-10 digit numbers that look like portal/hub IDs
    // (only when surrounded by non-digit context to avoid breaking action type IDs like 0-5)
    .replace(/(?<=\s|^)\d{6,10}(?=\s|$|[,;.\]})])/g, "{portal_id}");
}

/** Read the learnings file content, or return null if not found */
function readLearnings(): string | null {
  try {
    if (!fs.existsSync(SKILLS_PATH)) return null;
    return fs.readFileSync(SKILLS_PATH, "utf8");
  } catch {
    return null;
  }
}

/** Write updated content back to learnings file */
function writeLearnings(content: string): void {
  try {
    fs.writeFileSync(SKILLS_PATH, content, "utf8");
  } catch {
    // Best-effort
  }
}

/** Get the Learnings Log section of the file */
function getLearningsSection(content: string): string {
  const start = content.indexOf("## Learnings Log");
  return start === -1 ? "" : content.slice(start);
}

// ---------------------------------------------------------------------------
// Deduplication
// ---------------------------------------------------------------------------

/** Check if a workflow action type pattern is already documented */
function alreadyDocumented(content: string, actionTypeId: string): boolean {
  const section = getLearningsSection(content);
  return (
    section.includes(`Action type ${actionTypeId}`) ||
    section.includes(`actionTypeId ${actionTypeId}`) ||
    section.includes(`(${actionTypeId})`)
  );
}

/** Check if a generic resource error is already documented */
function alreadyDocumentedGeneric(
  content: string,
  learning: ResourceLearning
): boolean {
  const section = getLearningsSection(content);
  if (!section) return false;

  // Exact match: same resource key AND similar error text
  const errorSnippet = learning.error.slice(0, 80).toLowerCase();
  if (
    section.toLowerCase().includes(learning.resourceKey.toLowerCase()) &&
    section.toLowerCase().includes(errorSnippet)
  ) {
    return true;
  }

  // Pattern match: the error's root cause is already covered by a known fix
  for (const pattern of Object.keys(KNOWN_FIXES)) {
    if (
      learning.error.toLowerCase().includes(pattern.toLowerCase()) &&
      section.toLowerCase().includes(pattern.toLowerCase())
    ) {
      return true;
    }
  }

  return false;
}

/** Check if a success pattern is already documented (and count existing) */
function successAlreadyDocumented(
  content: string,
  pattern: SuccessPattern
): boolean {
  const section = getLearningsSection(content);
  if (!section) return false;

  // Already logged this exact resource
  if (section.includes(pattern.resourceKey)) return true;

  // Cap success entries per category to avoid bloat (max 5)
  const categoryTag = `CONFIRMED WORKING`;
  const categoryEntries = section
    .split("\n")
    .filter(
      (line) =>
        line.includes(categoryTag) &&
        line.includes(pattern.category)
    );
  return categoryEntries.length >= 5;
}

// ---------------------------------------------------------------------------
// Quick Reference auto-update
// ---------------------------------------------------------------------------

/** Auto-add a rule to the Quick Reference table if the error matches a known pattern */
function maybeUpdateQuickReference(content: string, error: string, category: string): string {
  const qrStart = content.indexOf("## Quick Reference");
  if (qrStart === -1) return content;

  const qrEnd = content.indexOf("\n## ", qrStart + 1);
  const qrSection = qrEnd === -1 ? content.slice(qrStart) : content.slice(qrStart, qrEnd);

  for (const p of QUICK_REF_PATTERNS) {
    if (!p.match.test(error)) continue;
    // Skip if this rule is already in the Quick Reference
    if (qrSection.includes(p.rule)) continue;

    // Find the last table row and append after it
    const tableEnd = qrSection.lastIndexOf("|");
    if (tableEnd === -1) continue;

    // Find the end of the last table line
    const lineEnd = qrSection.indexOf("\n", tableEnd);
    if (lineEnd === -1) continue;

    const insertPos = qrStart + lineEnd;
    const newRow = `\n| ${category} | ${p.rule} | Auto-detected ${today()} |`;
    return content.slice(0, insertPos) + newRow + content.slice(insertPos);
  }

  return content;
}

// ---------------------------------------------------------------------------
// Find known fix for an error
// ---------------------------------------------------------------------------

function findKnownFix(error: string): string | null {
  const lower = error.toLowerCase();
  for (const [pattern, fix] of Object.entries(KNOWN_FIXES)) {
    if (lower.includes(pattern.toLowerCase())) return fix;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Append a partial-install failure (workflow action type rejected).
 * Existing function — preserved for backward compatibility.
 */
export function appendPartialInstallLearning(
  learning: PartialInstallLearning
): void {
  try {
    const content = readLearnings();
    if (!content) return;

    if (alreadyDocumented(content, learning.actionTypeId)) return;

    const alternative = KNOWN_ALTERNATIVES[learning.actionTypeId];

    const entry = [
      "",
      `### ${today()} — ${learning.category} — Action type ${learning.actionTypeId} (${sanitize(learning.actionLabel)}) rejected by HubSpot`,
      `**Trigger:** Attempted to install workflow "${sanitize(learning.workflowName)}" containing action type ${learning.actionTypeId} (${sanitize(learning.actionLabel)})`,
      `**Failed because:** ${sanitize(learning.error)}`,
      alternative
        ? `**Alternative:** ${alternative}`
        : `**Workaround:** Strip action type ${learning.actionTypeId} from the automated install and add it manually in HubSpot UI`,
      `**Pattern:** Action type ${learning.actionTypeId} (${sanitize(learning.actionLabel)}) → partial-install strips it automatically; user receives manual-step instructions`,
      "",
      "---",
    ].join("\n");

    let updated = content.trimEnd() + "\n" + entry + "\n";
    updated = maybeUpdateQuickReference(updated, learning.error, learning.category);
    writeLearnings(updated);
  } catch {
    // Never block the caller
  }
}

/**
 * Append a generic resource failure learning (property, pipeline, list, etc.).
 * Called automatically by config-executor after any resource creation error.
 */
export function appendResourceLearning(learning: ResourceLearning): void {
  try {
    const content = readLearnings();
    if (!content) return;

    if (alreadyDocumentedGeneric(content, learning)) return;

    const knownFix = findKnownFix(learning.error);

    const entry = [
      "",
      `### ${today()} — ${learning.category} — ${sanitize(learning.resourceKey)} failed on ${learning.operation}`,
      `**Trigger:** Attempted to ${learning.operation} resource "${sanitize(learning.resourceKey)}"`,
      `**Failed because:** ${sanitize(learning.error)}`,
      knownFix
        ? `**Fix:** ${knownFix}`
        : `**Workaround:** Review the error details and correct the resource spec before retrying`,
      ...(learning.context
        ? [`**Context:** ${sanitize(learning.context)}`]
        : []),
      `**Pattern:** ${learning.category} ${learning.operation} → ${sanitize(learning.error.slice(0, 100))}`,
      "",
      "---",
    ].join("\n");

    let updated = content.trimEnd() + "\n" + entry + "\n";
    updated = maybeUpdateQuickReference(updated, learning.error, learning.category);
    writeLearnings(updated);
  } catch {
    // Never block the caller
  }
}

/**
 * Append a success pattern for notable accomplishments.
 * Only logs when the operation is noteworthy (complex workflows, large templates).
 * Caps at 5 success entries per category to avoid bloat.
 */
export function appendSuccessPattern(pattern: SuccessPattern): void {
  try {
    const content = readLearnings();
    if (!content) return;

    if (successAlreadyDocumented(content, pattern)) return;

    const entry = [
      "",
      `### ${today()} — ${pattern.category} — CONFIRMED WORKING: ${sanitize(pattern.resourceKey)}`,
      `**Detail:** ${sanitize(pattern.detail)}`,
      `**Pattern:** This configuration is verified working — reuse as reference for similar setups`,
      "",
      "---",
    ].join("\n");

    const updated = content.trimEnd() + "\n" + entry + "\n";
    writeLearnings(updated);
  } catch {
    // Never block the caller
  }
}
