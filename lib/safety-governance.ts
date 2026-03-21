type Layer = "api" | "script" | "template";

const MODULE_SCOPE_MAP: Record<string, string[]> = {
  // CRM operations
  A1: ["crm.objects.contacts.read", "crm.objects.companies.read", "crm.objects.deals.read"],
  A2: ["crm.objects.contacts.write", "crm.objects.companies.write", "crm.objects.deals.write"],
  A3: ["crm.objects.contacts.write", "crm.objects.companies.write", "crm.objects.deals.write"],
  A4: ["crm.objects.users.read"],
  A5: ["crm.objects.contacts.write"],
  A6: ["crm.objects.contacts.write", "crm.objects.companies.write", "crm.objects.deals.write"],
  A7: ["crm.objects.contacts.write", "crm.objects.companies.write", "crm.objects.deals.write"],
  // Workflows
  "B1-B2": ["automation"],
  B2: ["automation"],
  B3: ["automation"],
  B4: ["automation"],
  B5: ["automation"],
  // Properties
  "C1/C5": ["crm.schemas.contacts.read", "crm.schemas.companies.read", "crm.schemas.deals.read"],
  C2: ["crm.schemas.contacts.write", "crm.schemas.companies.write", "crm.schemas.deals.write"],
  // Lists
  "D1-D2": ["lists.read", "lists.write"],
  // Pipelines
  "E1-E2": ["crm.objects.deals.read", "crm.objects.deals.write"],
  // Scripts / Bulk
  "F1-F6": []
};

export function requiredScopesFor(moduleCode: string, _layer: Layer): string[] {
  return MODULE_SCOPE_MAP[moduleCode] ?? [];
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

export function sanitizeSensitiveText(input: string): string {
  return input
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "{email}")
    .replace(/\+?\d[\d\s().-]{7,}\d/g, "{phone}")
    .replace(/(Bearer\s+)[^\s"'`]+/gi, "$1{token}")
    .replace(/\b(?:hapikey|api[_-]?key|access[_-]?token|token)\s*[:=]\s*["']?[a-zA-Z0-9._-]{8,}["']?/gi, "{token}")
    .replace(/\b(?:pat|sk|hs)-[a-zA-Z0-9._-]{8,}\b/g, "{token}");
}
