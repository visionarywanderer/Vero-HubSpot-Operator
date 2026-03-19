/**
 * Skills Learner — auto-appends new failure/success patterns to the
 * hubspot-learnings SKILL.md so Claude learns from each partial install.
 *
 * Rules:
 *  - Best-effort: never throws, never blocks the caller
 *  - Deduplicates: won't add a pattern that is already mentioned in the file
 *  - Appends in the correct format so the human-readable log stays clean
 */

import * as fs from "fs";
import * as path from "path";

// Known alternatives to suggest for unsupported action types
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

interface PartialInstallLearning {
  category: "WORKFLOW" | "TEMPLATE";
  workflowName: string;
  actionTypeId: string;
  actionLabel: string;
  error: string;
}

const SKILLS_PATH = path.join(
  process.env.HOME ?? process.cwd(),
  ".claude",
  "skills",
  "hubspot-learnings",
  "SKILL.md"
);

/** Return today's date in YYYY-MM-DD format (local time). */
function today(): string {
  return new Date().toISOString().split("T")[0];
}

/**
 * Check whether a pattern for this actionTypeId already exists in the file,
 * to avoid duplicate entries.
 */
function alreadyDocumented(content: string, actionTypeId: string): boolean {
  // Simple check: if the exact string "Action type X-Y" or "actionTypeId X-Y"
  // appears in the Learnings Log section we assume it's already recorded.
  const learningsStart = content.indexOf("## Learnings Log");
  if (learningsStart === -1) return false;
  const learningsSection = content.slice(learningsStart);
  return (
    learningsSection.includes(`Action type ${actionTypeId}`) ||
    learningsSection.includes(`actionTypeId ${actionTypeId}`) ||
    learningsSection.includes(`(${actionTypeId})`)
  );
}

/**
 * Append a new failure pattern to hubspot-learnings SKILL.md.
 * No-ops silently if the file doesn't exist or the pattern is already there.
 */
export function appendPartialInstallLearning(
  learning: PartialInstallLearning
): void {
  try {
    if (!fs.existsSync(SKILLS_PATH)) return;

    const content = fs.readFileSync(SKILLS_PATH, "utf8");

    if (alreadyDocumented(content, learning.actionTypeId)) return;

    const alternative = KNOWN_ALTERNATIVES[learning.actionTypeId];

    const entry = [
      "",
      `### ${today()} — ${learning.category} — Action type ${learning.actionTypeId} (${learning.actionLabel}) rejected by HubSpot`,
      `**Trigger:** Attempted to install workflow "${learning.workflowName}" containing action type ${learning.actionTypeId} (${learning.actionLabel})`,
      `**Failed because:** ${learning.error}`,
      alternative
        ? `**Alternative:** ${alternative}`
        : `**Workaround:** Strip action type ${learning.actionTypeId} from the automated install and add it manually in HubSpot UI`,
      `**Pattern:** Action type ${learning.actionTypeId} (${learning.actionLabel}) → partial-install strips it automatically; user receives manual-step instructions`,
      "",
      "---",
    ].join("\n");

    const updated = content.trimEnd() + "\n" + entry + "\n";
    fs.writeFileSync(SKILLS_PATH, updated, "utf8");
  } catch {
    // Never block the caller — skills learning is best-effort
  }
}
