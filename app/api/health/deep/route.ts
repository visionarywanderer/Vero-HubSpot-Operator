import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/api-auth";
import { authManager } from "@/lib/auth-manager";
import { buildOAuthUrl } from "@/lib/hubspot-scopes";
import db from "@/lib/db";

const HUBSPOT_BASE_URL = "https://api.hubapi.com";

// Known action types and their expected availability
// "expectWorking" = always available; "broken" = universally broken; "scopeDependent" = available if scopes present
const ACTION_TYPES_TO_TEST = [
  { id: "0-1", name: "Delay", expectWorking: true },
  { id: "0-3", name: "Create task", scopeDependent: ["tasks", "crm.objects"] },
  { id: "0-5", name: "Set property", expectWorking: true },
  { id: "0-8", name: "Internal email notification", expectWorking: true },
  { id: "0-9", name: "In-app notification", expectWorking: false, knownIssue: "Returns silent 500 errors" },
  { id: "0-11", name: "Rotate to owner", expectWorking: false, knownIssue: "Returns silent 500 errors with placeholder fields" },
  { id: "0-14", name: "Create record", expectWorking: true },
  { id: "0-63809083", name: "Add to static list", expectWorking: true },
] as const;

interface EndpointCheck {
  endpoint: string;
  status: "ok" | "error" | "degraded";
  statusCode?: number;
  responseTimeMs: number;
  deprecationWarning?: string;
  sunsetHeader?: string;
}

interface DeepHealthResult {
  ok: boolean;
  portalId: string;
  checkedAt: string;
  hubspot_reachable: boolean;
  endpoints: EndpointCheck[];
  api_versions: { crm: string; automation: string; oauth: string };
  scopes_count: number;
  missing_scopes: string[];
  action_types: {
    available: Array<{ id: string; name: string }>;
    broken: Array<{ id: string; name: string; reason: string }>;
  };
  deprecation_warnings: string[];
  token_status: {
    valid: boolean;
    expiresStatus: "valid" | "expiring" | "expired";
  };
  reauth_url?: string;
}

async function checkEndpoint(
  token: string,
  endpoint: string,
  method: "GET" | "POST" = "GET",
  body?: object
): Promise<EndpointCheck> {
  const start = Date.now();
  try {
    const response = await fetch(`${HUBSPOT_BASE_URL}${endpoint}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store",
    });

    const responseTimeMs = Date.now() - start;

    // Check for deprecation headers
    const deprecation = response.headers.get("deprecation") || response.headers.get("x-deprecation");
    const sunset = response.headers.get("sunset");

    const result: EndpointCheck = {
      endpoint,
      status: response.ok ? "ok" : "error",
      statusCode: response.status,
      responseTimeMs,
    };

    if (deprecation) result.deprecationWarning = deprecation;
    if (sunset) result.sunsetHeader = sunset;

    // 429 = rate limited but still reachable
    if (response.status === 429) {
      result.status = "degraded";
    }

    return result;
  } catch (error) {
    return {
      endpoint,
      status: "error",
      responseTimeMs: Date.now() - start,
      deprecationWarning: error instanceof Error ? error.message : "Connection failed",
    };
  }
}

export async function GET(req: Request) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const portalId = url.searchParams.get("portalId");

  if (!portalId) {
    return NextResponse.json(
      { ok: false, error: "portalId query parameter is required" },
      { status: 400 }
    );
  }

  try {
    // Get the portal's token
    const portal = authManager.listPortals().find((p) => p.hubId === portalId);
    if (!portal) {
      return NextResponse.json(
        { ok: false, error: `Portal ${portalId} not found` },
        { status: 404 }
      );
    }

    // Run within portal context to get a valid token
    const result = await authManager.withPortal(portalId, async () => {
      const token = authManager.getToken();
      const currentScopes = portal.scopes || [];

      // --- 1. Check key endpoints ---
      const endpointChecks = await Promise.all([
        checkEndpoint(token, "/crm/v3/objects/contacts?limit=1"),
        checkEndpoint(token, "/crm/v3/objects/deals?limit=1"),
        checkEndpoint(token, "/crm/v3/properties/contacts"),
        checkEndpoint(token, "/crm/v3/pipelines/deals"),
        checkEndpoint(token, "/automation/v4/flows?limit=1"),
        checkEndpoint(token, "/crm/v3/lists/?limit=1"),
      ]);

      const hubspotReachable = endpointChecks.some((c) => c.status === "ok");

      // --- 2. Collect deprecation warnings ---
      const deprecationWarnings: string[] = [];
      for (const check of endpointChecks) {
        if (check.deprecationWarning) {
          deprecationWarnings.push(`${check.endpoint}: ${check.deprecationWarning}`);
        }
        if (check.sunsetHeader) {
          deprecationWarnings.push(`${check.endpoint}: Sunset date: ${check.sunsetHeader}`);
        }
      }

      // --- 3. Check known scopes ---
      const requiredScopes = [
        "crm.objects.contacts.read",
        "crm.objects.contacts.write",
        "crm.objects.deals.read",
        "crm.objects.deals.write",
        "crm.schemas.contacts.read",
        "crm.objects.owners.read",
        "automation",
        "crm.lists.read",
        "crm.lists.write",
      ];

      const missingScopes = requiredScopes.filter(
        (s) => !currentScopes.some((cs) => cs.includes(s))
      );

      // --- 4. Action type availability (dynamic scope-based detection) ---
      const availableActions: Array<{ id: string; name: string }> = [];
      const brokenActions: Array<{ id: string; name: string; reason: string }> = [];

      for (const action of ACTION_TYPES_TO_TEST) {
        if ("scopeDependent" in action && action.scopeDependent) {
          // Check if portal has any of the required scope prefixes
          const hasScope = action.scopeDependent.some((prefix: string) =>
            currentScopes.some((s) => s.includes(prefix))
          );
          if (hasScope) {
            availableActions.push({ id: action.id, name: action.name });
          } else {
            brokenActions.push({
              id: action.id,
              name: action.name,
              reason: `Requires scope matching: ${action.scopeDependent.join(" or ")} — re-authorize to add`,
            });
          }
        } else if ("expectWorking" in action && action.expectWorking) {
          availableActions.push({ id: action.id, name: action.name });
        } else {
          brokenActions.push({
            id: action.id,
            name: action.name,
            reason: ("knownIssue" in action && action.knownIssue) || "Known to fail",
          });
        }
      }

      // --- 5. Token health ---
      let tokenValid = true;
      let expiresIn: number | undefined;
      try {
        const tokenInfo = await fetch(
          `${HUBSPOT_BASE_URL}/oauth/v1/access-tokens/${token}`,
          { cache: "no-store" }
        );
        if (tokenInfo.ok) {
          const info = (await tokenInfo.json()) as { expires_in?: number };
          expiresIn = info.expires_in;
        } else {
          tokenValid = false;
        }
      } catch {
        tokenValid = false;
      }

      // --- Build result ---
      const expiresStatus: "valid" | "expiring" | "expired" =
        expiresIn === undefined ? (tokenValid ? "valid" : "expired")
        : expiresIn > 3600 ? "valid"
        : expiresIn > 0 ? "expiring"
        : "expired";

      const healthResult: DeepHealthResult = {
        ok: hubspotReachable && tokenValid,
        portalId,
        checkedAt: new Date().toISOString(),
        hubspot_reachable: hubspotReachable,
        endpoints: endpointChecks,
        api_versions: { crm: "v3", automation: "v4", oauth: "v1" },
        scopes_count: currentScopes.length,
        missing_scopes: missingScopes,
        action_types: {
          available: availableActions,
          broken: brokenActions,
        },
        deprecation_warnings: deprecationWarnings,
        token_status: {
          valid: tokenValid,
          expiresStatus,
        },
      };

      // --- Re-auth nudge if scopes are missing ---
      if (missingScopes.length > 0 || brokenActions.some((a) => a.reason.includes("re-authorize"))) {
        const clientId = process.env.HUBSPOT_CLIENT_ID;
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || "http://localhost:3000";
        if (clientId) {
          healthResult.reauth_url = buildOAuthUrl(clientId, `${appUrl}/api/portals/callback`);
        }
      }

      // --- Persist to app_settings for history ---
      try {
        db.prepare(
          `INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)`
        ).run(
          `health_deep_${portalId}`,
          JSON.stringify({
            ...healthResult,
            _savedAt: new Date().toISOString(),
          })
        );
      } catch {
        // Don't fail health check if we can't save
      }

      return healthResult;
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Health check failed",
        portalId,
        checkedAt: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
