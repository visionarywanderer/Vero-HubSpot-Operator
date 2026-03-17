import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/api-auth";
import { buildOAuthUrl, generateOAuthState } from "@/lib/hubspot-scopes";

export async function GET() {
  if (!(await isAuthenticated())) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const clientId = process.env.HUBSPOT_OAUTH_CLIENT_ID;
  const redirectUri = process.env.HUBSPOT_OAUTH_REDIRECT_URI;
  if (!clientId || !redirectUri) {
    return NextResponse.json({ ok: false, error: "HubSpot OAuth env vars not configured" }, { status: 400 });
  }

  const state = generateOAuthState();
  const url = buildOAuthUrl(clientId, redirectUri, state);
  return NextResponse.json({ ok: true, url });
}
