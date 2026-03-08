type Layer = "mcp" | "api" | "script";

const MCP_MODULE_SCOPE_MAP: Record<string, string[]> = {
  A1: ["crm.objects.contacts.read", "crm.objects.companies.read", "crm.objects.deals.read", "tickets"],
  A2: ["crm.objects.contacts.write", "crm.objects.companies.write", "crm.objects.deals.write", "tickets"],
  A3: ["crm.objects.contacts.write", "crm.objects.companies.write", "crm.objects.deals.write", "tickets"],
  A4: ["crm.objects.owners.read"],
  A5: ["crm.objects.contacts.write"],
  A6: ["crm.objects.contacts.write", "crm.objects.companies.write", "crm.objects.deals.write"],
  A7: ["crm.objects.contacts.write", "crm.objects.companies.write", "crm.objects.deals.write", "tickets"]
};

const API_MODULE_SCOPE_MAP: Record<string, string[]> = {
  "B1-B2": ["automation"],
  B3: ["automation"],
  B4: ["automation"],
  B5: ["automation"],
  "C1/C5": ["crm.schemas.contacts.read", "crm.schemas.companies.read", "crm.schemas.deals.read"],
  C2: ["crm.schemas.contacts.write", "crm.schemas.companies.write", "crm.schemas.deals.write"],
  "D1-D2": ["crm.lists.read", "crm.lists.write"],
  "E1-E2": ["crm.objects.deals.read", "crm.objects.deals.write"]
};

export function isWriteModule(moduleCode: string): boolean {
  return ["A2", "A3", "A4", "A5", "A6", "A7", "B1-B2", "B4", "B5", "C2", "D1-D2", "E1-E2", "F1-F6"].includes(moduleCode);
}

export function requiredScopesFor(moduleCode: string, layer: Layer): string[] {
  if (layer === "mcp") return MCP_MODULE_SCOPE_MAP[moduleCode] ?? [];
  if (layer === "api") return API_MODULE_SCOPE_MAP[moduleCode] ?? [];
  return [];
}

export function missingScopesFor(moduleCode: string, layer: Layer, availableScopes: string[]): string[] {
  return requiredScopesFor(moduleCode, layer).filter((scope) => !availableScopes.includes(scope));
}

export function canWriteInEnvironment(args: {
  environment: "production" | "sandbox";
  isFirstSession: boolean;
  isWriteOperation: boolean;
}): { allowed: boolean; reason?: string } {
  if (!args.isWriteOperation) return { allowed: true };
  if (args.environment === "sandbox") return { allowed: true };
  if (args.environment === "production" && args.isFirstSession) {
    return {
      allowed: false,
      reason: "Sandbox-first policy: first session on production portal is read-only until sandbox validation is completed."
    };
  }
  return { allowed: true };
}

export function isDeleteOperation(moduleCode: string, prompt: string): boolean {
  const lower = prompt.toLowerCase();
  return moduleCode === "A7" || moduleCode === "B5" || /\b(delete|remove)\b/.test(lower);
}

export function extractExplicitId(prompt: string): string | null {
  const keyMatch = prompt.match(/\b(?:flowId|workflowId|recordId|id)\s*[:=]\s*([a-zA-Z0-9_-]{3,})\b/i);
  if (keyMatch) {
    return keyMatch[1];
  }

  const quoted = prompt.match(/['"]([a-zA-Z0-9_-]{6,})['"]/);
  if (quoted) {
    return quoted[1];
  }

  const numeric = prompt.match(/\b(\d{6,})\b/);
  if (numeric) {
    return numeric[1];
  }

  return null;
}

export function sanitizeSensitiveText(input: string): string {
  return input
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "{email}")
    .replace(/\+?\d[\d\s().-]{7,}\d/g, "{phone}")
    .replace(/(Bearer\s+)[^\s"'`]+/gi, "$1{token}")
    .replace(/\b(?:hapikey|api[_-]?key|access[_-]?token|token)\s*[:=]\s*["']?[a-zA-Z0-9._-]{8,}["']?/gi, "{token}")
    .replace(/\b(?:pat|sk|hs)-[a-zA-Z0-9._-]{8,}\b/g, "{token}");
}
