import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { authManager } from "@/lib/auth-manager";
import { generateScopeUpgradeUrl, getRequiredScopes, getOptionalScopes } from "@/lib/hubspot-scopes";

export async function GET(_req: Request, context: any) {
  const params = await context.params;
  const session = await requireSession();
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const clientId = process.env.HUBSPOT_OAUTH_CLIENT_ID;
  const redirectUri = process.env.HUBSPOT_OAUTH_REDIRECT_URI;
  if (!clientId || !redirectUri) {
    return NextResponse.json({ ok: false, error: "HubSpot OAuth env vars not configured" }, { status: 400 });
  }

  try {
    const portal = authManager.getActivePortal(params.portalId);

    // Determine which scopes are currently missing
    const allDesired = [...getRequiredScopes(), ...getOptionalScopes()];
    const missingScopes = allDesired.filter((s) => !portal.scopes.includes(s));

    // Generate a full re-authorization URL that requests all missing scopes
    const allScopes = new Set([...portal.scopes, ...allDesired]);
    const scopeStr = encodeURIComponent(Array.from(allScopes).join(" "));
    const url = `https://app.hubspot.com/oauth/authorize?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scopeStr}`;

    return NextResponse.json({
      ok: true,
      portalId: portal.hubId,
      currentScopes: portal.scopes,
      missingScopes,
      reauthorizeUrl: url
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to generate reauthorize URL" },
      { status: 400 }
    );
  }
}

/** POST with a specific missing scope to get a targeted upgrade URL */
export async function POST(req: Request, context: any) {
  const params = await context.params;
  const session = await requireSession();
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const clientId = process.env.HUBSPOT_OAUTH_CLIENT_ID;
  const redirectUri = process.env.HUBSPOT_OAUTH_REDIRECT_URI;
  if (!clientId || !redirectUri) {
    return NextResponse.json({ ok: false, error: "HubSpot OAuth env vars not configured" }, { status: 400 });
  }

  try {
    const body = (await req.json()) as { missingScope?: string };
    if (!body.missingScope) {
      return NextResponse.json({ ok: false, error: "missingScope is required" }, { status: 400 });
    }

    const portal = authManager.getActivePortal(params.portalId);
    const url = generateScopeUpgradeUrl(portal.scopes, body.missingScope, clientId, redirectUri);

    return NextResponse.json({
      ok: true,
      portalId: portal.hubId,
      missingScope: body.missingScope,
      reauthorizeUrl: url
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to generate upgrade URL" },
      { status: 400 }
    );
  }
}
