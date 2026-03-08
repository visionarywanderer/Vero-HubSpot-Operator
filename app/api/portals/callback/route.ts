import { NextRequest, NextResponse } from "next/server";
import { authManager } from "@/lib/auth-manager";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(new URL("/portals?error=no_code", req.url));
  }

  const clientId = process.env.HUBSPOT_OAUTH_CLIENT_ID;
  const clientSecret = process.env.HUBSPOT_OAUTH_CLIENT_SECRET;
  const redirectUri = process.env.HUBSPOT_OAUTH_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    return NextResponse.redirect(new URL("/portals?error=oauth_env_missing", req.url));
  }

  try {
    const tokenResp = await fetch("https://api.hubapi.com/oauth/v1/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        code
      }),
      cache: "no-store"
    });

    if (!tokenResp.ok) {
      const details = await tokenResp.text();
      return NextResponse.redirect(new URL(`/portals?error=oauth_exchange_failed&details=${encodeURIComponent(details.slice(0, 200))}`, req.url));
    }

    const tokenData = (await tokenResp.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
    };

    const infoResp = await fetch(`https://api.hubapi.com/oauth/v1/access-tokens/${tokenData.access_token}`, { cache: "no-store" });
    if (!infoResp.ok) {
      const details = await infoResp.text();
      return NextResponse.redirect(new URL(`/portals?error=oauth_info_failed&details=${encodeURIComponent(details.slice(0, 200))}`, req.url));
    }

    const info = (await infoResp.json()) as {
      hub_id?: number;
      scopes?: string[];
      user?: string;
    };

    if (!info.hub_id) {
      return NextResponse.redirect(new URL("/portals?error=hub_id_missing", req.url));
    }

    await authManager.handleCallback({
      hubId: String(info.hub_id),
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      expiresIn: tokenData.expires_in,
      scopes: info.scopes,
      installedBy: info.user
    });

    return NextResponse.redirect(new URL(`/portals?connected=${info.hub_id}`, req.url));
  } catch (error) {
    const message = error instanceof Error ? error.message : "oauth_callback_failed";
    return NextResponse.redirect(new URL(`/portals?error=oauth_failed&details=${encodeURIComponent(message)}`, req.url));
  }
}
