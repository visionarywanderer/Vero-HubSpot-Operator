/**
 * HubSpot Dynamic Scope & Capability System
 *
 * SINGLE SOURCE OF TRUTH: public-app.json
 *
 * Scopes are read directly from hubspot-project/src/app/public-app.json,
 * the same file that gets deployed to HubSpot via `hs project upload`.
 * This guarantees the OAuth URL always matches the app's configured scopes.
 *
 * Priority:
 *   1. public-app.json (always in sync with deployed HubSpot app)
 *   2. Environment variables (override for special cases)
 *   3. Hardcoded defaults (safety net)
 *
 * The capability model is derived dynamically from whatever scopes were
 * actually granted by HubSpot during the OAuth flow.
 */

import * as fs from "fs";
import * as path from "path";

// ---------------------------------------------------------------------------
// Scope Configuration — read from public-app.json (single source of truth)
// ---------------------------------------------------------------------------

/** Cached scopes from public-app.json to avoid repeated disk reads */
let _cachedAppConfig: { requiredScopes: string[]; optionalScopes: string[]; conditionallyRequiredScopes: string[] } | null = null;

/**
 * Read scopes from public-app.json — the same file deployed to HubSpot.
 * This guarantees the OAuth URL scopes always match the app's configuration.
 */
function readPublicAppScopes(): { requiredScopes: string[]; optionalScopes: string[]; conditionallyRequiredScopes: string[] } | null {
  if (_cachedAppConfig) return _cachedAppConfig;

  try {
    // Resolve path relative to project root
    const projectRoot = process.cwd();
    const candidates = [
      path.join(projectRoot, "hubspot-project", "src", "app", "public-app.json"),
      path.join(projectRoot, "..", "hubspot-project", "src", "app", "public-app.json"),
    ];

    for (const filePath of candidates) {
      if (fs.existsSync(filePath)) {
        const raw = fs.readFileSync(filePath, "utf-8");
        const config = JSON.parse(raw) as {
          auth?: {
            requiredScopes?: string[];
            optionalScopes?: string[];
            conditionallyRequiredScopes?: string[];
          };
        };

        if (config.auth) {
          _cachedAppConfig = {
            requiredScopes: config.auth.requiredScopes ?? [],
            optionalScopes: config.auth.optionalScopes ?? [],
            conditionallyRequiredScopes: config.auth.conditionallyRequiredScopes ?? [],
          };
          return _cachedAppConfig;
        }
      }
    }
  } catch {
    // Fall through to env vars / defaults
  }

  return null;
}

/** Hardcoded safety-net defaults (only used if public-app.json AND env vars are both unavailable) */
const FALLBACK_REQUIRED_SCOPES = [
  "oauth",
  "crm.objects.contacts.read",
  "crm.objects.contacts.write",
  "crm.objects.companies.read",
  "crm.objects.companies.write",
  "crm.objects.deals.read",
  "crm.objects.deals.write",
  "crm.objects.owners.read",
  "crm.schemas.contacts.read",
  "crm.schemas.contacts.write",
  "crm.schemas.companies.read",
  "crm.schemas.companies.write",
  "crm.schemas.deals.read",
  "crm.schemas.deals.write",
  "crm.lists.read",
  "crm.lists.write",
  "automation",
];

const FALLBACK_OPTIONAL_SCOPES = [
  "tickets",
  "crm.objects.custom.read",
  "crm.objects.custom.write",
  "crm.objects.feedback_submissions.read",
  "crm.objects.goals.read",
];

function parseEnvScopes(envVar: string | undefined): string[] | null {
  if (envVar === undefined || envVar === null) return null;
  // Explicit empty string means "none" — not "use defaults"
  if (envVar.trim() === "") return [];
  return envVar
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Get the required scopes for the OAuth URL.
 *
 * Priority:
 *   1. public-app.json (single source of truth)
 *   2. HUBSPOT_REQUIRED_SCOPES env var
 *   3. Hardcoded fallback defaults
 */
export function getRequiredScopes(): string[] {
  // 1. Try public-app.json first
  const appConfig = readPublicAppScopes();
  if (appConfig && appConfig.requiredScopes.length > 0) {
    return appConfig.requiredScopes;
  }

  // 2. Try env var override
  const fromEnv = parseEnvScopes(process.env.HUBSPOT_REQUIRED_SCOPES);
  if (fromEnv !== null) return fromEnv;

  // 3. Hardcoded fallback
  return FALLBACK_REQUIRED_SCOPES;
}

/**
 * Get the optional scopes for the OAuth URL.
 *
 * Priority:
 *   1. public-app.json (single source of truth)
 *   2. HUBSPOT_OPTIONAL_SCOPES env var
 *   3. Empty array (no optional scopes by default)
 */
export function getOptionalScopes(): string[] {
  // 1. Try public-app.json first
  const appConfig = readPublicAppScopes();
  if (appConfig) {
    return appConfig.optionalScopes;
  }

  // 2. Try env var override
  const fromEnv = parseEnvScopes(process.env.HUBSPOT_OPTIONAL_SCOPES);
  if (fromEnv !== null) return fromEnv;

  // 3. Fallback optional scopes
  return FALLBACK_OPTIONAL_SCOPES;
}

/**
 * Get the conditionally required scopes for the OAuth URL.
 */
export function getConditionallyRequiredScopes(): string[] {
  const appConfig = readPublicAppScopes();
  if (appConfig) {
    return appConfig.conditionallyRequiredScopes;
  }
  return [];
}

/**
 * Force re-read of public-app.json (e.g. after deploying new scopes).
 */
export function clearScopeCache(): void {
  _cachedAppConfig = null;
}

// ---------------------------------------------------------------------------
// Capability Model
// ---------------------------------------------------------------------------

export interface PortalCapabilities {
  // Core CRM
  contacts: boolean;
  companies: boolean;
  deals: boolean;
  tickets: boolean;
  lineItems: boolean;
  quotes: boolean;
  orders: boolean;

  // Engagements
  calls: boolean;
  notes: boolean;
  tasks: boolean;
  emails: boolean;
  meetings: boolean;

  // Schema / Properties
  properties: boolean;

  // Pipelines (access comes via object scopes — deals.read grants pipeline read)
  pipelines: boolean;

  // Users
  users: boolean;

  // Hub-specific
  ecommerce: boolean;
  workflows: boolean;
  forms: boolean;
  files: boolean;
  timeline: boolean;
  customObjects: boolean;
  lists: boolean;
  cms: boolean;
  conversations: boolean;

  // Import / Export
  importExport: boolean;

  // Enterprise
  sensitiveData: boolean;
}

/**
 * Map granted scopes into a capabilities object.
 * This works dynamically — whatever scopes HubSpot actually granted,
 * we derive which features are available.
 */
export function buildCapabilities(scopes: string[]): PortalCapabilities {
  const has = (s: string) => scopes.includes(s);
  const hasAny = (...ss: string[]) => ss.some((s) => scopes.includes(s));

  return {
    contacts: has("crm.objects.contacts.write"),
    companies: has("crm.objects.companies.write"),
    deals: has("crm.objects.deals.write"),
    tickets: has("crm.objects.tickets.write"),
    lineItems: has("crm.objects.line_items.write"),
    quotes: has("crm.objects.quotes.write"),
    orders: has("crm.objects.orders.write"),

    calls: has("crm.objects.calls.write"),
    notes: has("crm.objects.notes.write"),
    tasks: has("crm.objects.tasks.write"),
    emails: has("crm.objects.emails.write"),
    meetings: has("crm.objects.meetings.write"),

    properties: hasAny("crm.schemas.contacts.write", "crm.schemas.companies.write", "crm.schemas.deals.write"),
    pipelines: hasAny("crm.objects.deals.read", "crm.objects.tickets.read"),
    users: hasAny("crm.objects.users.read", "settings.users.read"),

    ecommerce: has("e-commerce"),
    workflows: has("automation"),
    forms: has("forms"),
    files: has("files"),
    timeline: has("timeline"),
    customObjects: has("crm.objects.custom.write"),
    lists: hasAny("crm.lists.write", "crm.lists.read"),
    cms: has("content"),
    conversations: hasAny("conversations.write", "conversations.read"),
    importExport: hasAny("crm.import", "crm.export"),
    sensitiveData: hasAny(
      "crm.objects.contacts.sensitive.read",
      "crm.objects.companies.sensitive.read",
      "crm.objects.deals.sensitive.read"
    ),
  };
}

// ---------------------------------------------------------------------------
// Scope Gap Detection
// ---------------------------------------------------------------------------

/**
 * Detect a missing scope from a HubSpot 403 error response.
 * HubSpot typically includes the required scope in the error message.
 */
export function detectMissingScope(error: { response?: { status?: number; data?: { message?: string } }; statusCode?: number; message?: string }): string | null {
  const status = error.response?.status ?? error.statusCode;
  if (status !== 403) return null;

  const message = error.response?.data?.message ?? error.message ?? "";
  const match = message.match(/scope\s+([a-zA-Z0-9._-]+)/i);
  return match ? match[1] : null;
}

/**
 * Generate a reauthorization URL that includes existing scopes + the missing one.
 */
export function generateScopeUpgradeUrl(
  grantedScopes: string[],
  missingScope: string,
  clientId: string,
  redirectUri: string
): string {
  const allScopes = new Set([...grantedScopes, missingScope]);
  const scopeStr = encodeURIComponent(Array.from(allScopes).join(" "));
  return `https://app.hubspot.com/oauth/authorize?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scopeStr}`;
}

// ---------------------------------------------------------------------------
// OAuth URL Builder
// ---------------------------------------------------------------------------

/**
 * Build the full OAuth authorization URL.
 *
 * Reads scopes from public-app.json (single source of truth), which is
 * the same file deployed to HubSpot via `hs project upload`.
 *
 * This guarantees the OAuth URL always matches the app's configured scopes.
 */
/**
 * Generate a cryptographic random state token for CSRF protection.
 */
export function generateOAuthState(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function buildOAuthUrl(clientId: string, redirectUri: string, state?: string): string {
  const requiredScopes = getRequiredScopes();
  const optionalScopes = getOptionalScopes();

  const scope = encodeURIComponent(requiredScopes.join(" "));
  let url = `https://app.hubspot.com/oauth/authorize?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scope}`;

  if (optionalScopes.length > 0) {
    const optionalScope = encodeURIComponent(optionalScopes.join(" "));
    url += `&optional_scope=${optionalScope}`;
  }

  // CSRF protection via state parameter
  if (state) {
    url += `&state=${encodeURIComponent(state)}`;
  }

  return url;
}

// ---------------------------------------------------------------------------
// Feature → Scope mapping (for middleware guards)
// ---------------------------------------------------------------------------

/** Map a capability key to the scope(s) it requires */
export const CAPABILITY_SCOPE_MAP: Record<keyof PortalCapabilities, string> = {
  contacts: "crm.objects.contacts.write",
  companies: "crm.objects.companies.write",
  deals: "crm.objects.deals.write",
  tickets: "crm.objects.tickets.write",
  lineItems: "crm.objects.line_items.write",
  quotes: "crm.objects.quotes.write",
  orders: "crm.objects.orders.write",
  calls: "crm.objects.calls.write",
  notes: "crm.objects.notes.write",
  tasks: "crm.objects.tasks.write",
  emails: "crm.objects.emails.write",
  meetings: "crm.objects.meetings.write",
  properties: "crm.schemas.contacts.write",
  pipelines: "crm.objects.deals.read",
  users: "crm.objects.users.read",
  ecommerce: "e-commerce",
  workflows: "automation",
  forms: "forms",
  files: "files",
  timeline: "timeline",
  customObjects: "crm.objects.custom.write",
  lists: "crm.lists.write",
  cms: "content",
  conversations: "conversations.write",
  importExport: "crm.import",
  sensitiveData: "crm.objects.contacts.sensitive.read",
};
