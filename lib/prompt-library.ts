import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { orchestrator } from "@/lib/orchestrator";
import { authManager } from "@/lib/auth-manager";
import { portalConfigStore, type PortalConfig } from "@/lib/portal-config-store";

export interface PromptParameter {
  name: string;
  default?: string;
  options?: string[];
}

export interface PromptEntry {
  id: string;
  name: string;
  category: string;
  module: string;
  layer: "mcp" | "api" | "script";
  description: string;
  prompt: string;
  parameters?: PromptParameter[];
  tags: string[];
}

export interface PromptLibrary {
  list(category?: string): PromptEntry[];
  get(id: string): PromptEntry;
  search(query: string): PromptEntry[];
  execute(id: string, parameters?: Record<string, string>, portalId?: string): Promise<void>;
  add(entry: PromptEntry): void;
  remove(id: string): void;
  resolve(id: string, portalConfig: PortalConfig): string;
}

const PROMPTS_FILE = path.join(process.cwd(), "prompts", "prompts.json");

const DEFAULT_PROMPTS: PromptEntry[] = [
  {
    id: "audit-data-quality",
    name: "Data Quality Audit",
    category: "audit",
    module: "A1",
    layer: "mcp",
    description: "Scan records for missing required fields and fill-rate issues",
    prompt:
      "Search all {objectType} and check missing critical fields. Report total, with value, missing, fill rate %, flag <80%, sort worst first.",
    parameters: [{ name: "objectType", default: "contacts", options: ["contacts", "companies", "deals"] }],
    tags: ["audit", "data quality", "contacts"]
  },
  {
    id: "audit-pipeline-health",
    name: "Pipeline Health Audit",
    category: "audit",
    module: "A1",
    layer: "mcp",
    description: "Audit pipeline stage health and stuck deals",
    prompt:
      "Get deals grouped by pipeline/stage. Report totals, value, avg days in stage, deals stuck >30 days, past close dates still open, amount=0/null. Return Green/Yellow/Red health score.",
    tags: ["audit", "pipeline", "deals"]
  },
  {
    id: "crm-create-followup-tasks",
    name: "Create Follow-up Tasks",
    category: "crm",
    module: "A4",
    layer: "mcp",
    description: "Create owner tasks for matching records",
    prompt:
      "For each {objectType} matching {criteria}, create owner task with subject '{taskPrefix}{subject}', body '{body}', due in {dueDays} days, priority {priority}. Show count/owners and wait for confirmation.",
    parameters: [
      { name: "objectType", default: "deals", options: ["contacts", "companies", "deals", "tickets"] },
      { name: "criteria", default: "open deals in stage for more than 14 days" },
      { name: "taskPrefix", default: "[Vero Audit] " },
      { name: "subject", default: "Follow up" },
      { name: "body", default: "Please review and update this record." },
      { name: "dueDays", default: "2" },
      { name: "priority", default: "HIGH" }
    ],
    tags: ["tasks", "follow-up", "crm"]
  },
  {
    id: "crm-fix-missing-associations",
    name: "Fix Missing Associations",
    category: "crm",
    module: "A6",
    layer: "mcp",
    description: "Repair missing company associations",
    prompt:
      "Find contacts with non-empty company text and no company association. Match by exact name, auto-associate one-match, log no-match/ambiguous. Show summary and wait for confirmation.",
    tags: ["associations", "repair", "crm"]
  },
  {
    id: "workflow-lead-routing",
    name: "Workflow Lead Routing",
    category: "workflows",
    module: "B1-B2",
    layer: "api",
    description: "Generate lead routing workflow",
    prompt:
      "Workflow: Lead Routing - {formName}. Object: contact. Trigger: form {formId}. Actions: set lifecyclestage=lead, create owner task, notify sales manager. Deploy disabled.",
    parameters: [
      { name: "formName", default: "Demo Request" },
      { name: "formId", default: "{forms.demoRequest}" }
    ],
    tags: ["workflow", "lead routing"]
  },
  {
    id: "workflow-stalled-deal-alert",
    name: "Workflow Stalled Deal Alert",
    category: "workflows",
    module: "B1-B2",
    layer: "api",
    description: "Generate stalled deal alert workflow",
    prompt:
      "Workflow: Stalled Deal Alert. Object: deal. Trigger: same stage > {days} days. Actions: notify owner + create follow-up task due in 2 days. Deploy disabled.",
    parameters: [{ name: "days", default: "14" }],
    tags: ["workflow", "deals", "alert"]
  },
  {
    id: "bulk-name-standardization",
    name: "Bulk Name Standardization",
    category: "bulk",
    module: "F1",
    layer: "script",
    description: "Standardize names and normalize text fields",
    prompt:
      "Fetch all contacts. Capitalize firstname/lastname, trim whitespace, lowercase emails. Generate script with dry-run and affected count before execution.",
    tags: ["bulk", "standardization", "script"]
  },
  {
    id: "bulk-lifecycle-migration",
    name: "Bulk Lifecycle Migration",
    category: "bulk",
    module: "F2",
    layer: "script",
    description: "Migrate lifecycle stages by activity/deal status",
    prompt:
      "Migrate lifecycle stages: subscriber+recent form=>lead, lead+meeting=>MQL, MQL+open deal=>SQL, any+closedwon=>customer. Generate script, dry-run first, log transitions.",
    tags: ["bulk", "lifecycle", "migration"]
  },
  {
    id: "property-create-lead-scoring",
    name: "Create Lead Scoring Properties",
    category: "properties",
    module: "C2",
    layer: "api",
    description: "Create standard lead scoring properties",
    prompt:
      "Create contact properties in group lead_scoring_custom: lead_segment, lead_source_detail, lead_quality_score, days_since_last_activity. Create group first if missing.",
    tags: ["properties", "lead scoring"]
  },
  {
    id: "list-create-hot-leads",
    name: "Create Hot Leads List",
    category: "lists",
    module: "D1-D2",
    layer: "api",
    description: "Create smart hot-leads list",
    prompt:
      "Create smart list 'Hot Leads - Active MQLs': lifecyclestage=MQL, lead score > {threshold}, last activity within 7 days, has associated company.",
    parameters: [{ name: "threshold", default: "80" }],
    tags: ["lists", "segment", "hot leads"]
  },
  {
    id: "list-create-at-risk",
    name: "Create At Risk Customers List",
    category: "lists",
    module: "D1-D2",
    layer: "api",
    description: "Create at-risk customer segment",
    prompt:
      "Create smart list 'At Risk Customers': lifecycle=Customer, no activity in 60 days, open high-priority ticket.",
    tags: ["lists", "at risk", "customers"]
  }
];

function flattenObject(prefix: string, value: unknown, output: Record<string, string>): void {
  if (value === null || value === undefined) return;
  if (typeof value !== "object") {
    output[prefix] = String(value);
    return;
  }

  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    const next = prefix ? `${prefix}.${key}` : key;
    flattenObject(next, nested, output);
  }
}

class FilePromptLibrary implements PromptLibrary {
  private prompts = new Map<string, PromptEntry>();

  constructor() {
    for (const entry of DEFAULT_PROMPTS) {
      this.prompts.set(entry.id, entry);
    }
  }

  list(category?: string): PromptEntry[] {
    const all = Array.from(this.prompts.values());
    if (!category) return all;
    return all.filter((entry) => entry.category === category);
  }

  get(id: string): PromptEntry {
    const entry = this.prompts.get(id);
    if (!entry) {
      throw new Error(`Prompt ${id} not found`);
    }
    return entry;
  }

  search(query: string): PromptEntry[] {
    const q = query.toLowerCase();
    return Array.from(this.prompts.values()).filter((entry) => {
      const haystack = [entry.id, entry.name, entry.description, entry.category, entry.module, ...entry.tags]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }

  async execute(id: string, parameters?: Record<string, string>, portalId?: string): Promise<void> {
    const activePortal = authManager.getActivePortal(portalId);
    const portalConfig = await portalConfigStore.load(activePortal.id).catch(() => undefined);

    const resolvedPrompt = this.resolveWithParameters(id, portalConfig, parameters);
    const plan = await orchestrator.processPrompt(resolvedPrompt, activePortal.id);

    if (plan.requiresConfirmation) {
      throw new Error(`Prompt requires confirmation. Plan ID: ${plan.planId}`);
    }

    await orchestrator.confirmAndExecute(plan.planId, "yes");
  }
  add(entry: PromptEntry): void {
    this.prompts.set(entry.id, entry);
    this.persist().catch(() => {
      // Ignore persistence failure for in-memory availability.
    });
  }

  remove(id: string): void {
    this.prompts.delete(id);
    this.persist().catch(() => {
      // Ignore persistence failure for in-memory availability.
    });
  }

  resolve(id: string, portalConfig: PortalConfig): string {
    return this.resolveWithParameters(id, portalConfig, {});
  }

  private resolveWithParameters(
    id: string,
    portalConfig?: PortalConfig,
    parameters: Record<string, string> = {}
  ): string {
    const entry = this.get(id);
    let resolved = entry.prompt;

    const portalValues: Record<string, string> = {};
    if (portalConfig) {
      flattenObject("", portalConfig as unknown as Record<string, unknown>, portalValues);
    }

    for (const parameter of entry.parameters ?? []) {
      const raw = parameters[parameter.name] ?? parameter.default ?? "";
      const value = this.resolveToken(raw, portalValues);
      resolved = resolved.replaceAll(`{${parameter.name}}`, value);
    }

    for (const [key, value] of Object.entries(portalValues)) {
      resolved = resolved.replaceAll(`{${key}}`, value);
    }

    return resolved;
  }

  private resolveToken(value: string, portalValues: Record<string, string>): string {
    if (value.startsWith("{") && value.endsWith("}")) {
      const key = value.slice(1, -1);
      return portalValues[key] ?? value;
    }
    return value;
  }

  private async persist(): Promise<void> {
    await mkdir(path.dirname(PROMPTS_FILE), { recursive: true });
    await writeFile(PROMPTS_FILE, JSON.stringify(Array.from(this.prompts.values()), null, 2), "utf8");
  }

  async loadFromFileIfExists(): Promise<void> {
    try {
      const raw = await readFile(PROMPTS_FILE, "utf8");
      const parsed = JSON.parse(raw) as PromptEntry[];
      for (const entry of parsed) {
        this.prompts.set(entry.id, entry);
      }
    } catch {
      // no-op
    }
  }
}

export const promptLibrary = new FilePromptLibrary();
promptLibrary.loadFromFileIfExists().catch(() => {
  // no-op
});
