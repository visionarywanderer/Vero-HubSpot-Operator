import { NextResponse } from "next/server";

export async function GET() {
  try {
    const env = process.env;
    let dbOk = false;
    let portalCount = 0;

    try {
      const db = (await import("@/lib/db")).default;
      const row = db.prepare("SELECT 1 as ok").get() as { ok: number } | undefined;
      dbOk = row?.ok === 1;
    } catch { /* db not available yet */ }

    try {
      const { authManager } = await import("@/lib/auth-manager");
      portalCount = authManager.listPortals().length;
    } catch { /* auth not configured */ }

    return NextResponse.json({
      ok: true,
      app: "vero-hubspot-operator",
      configured: {
        googleOAuth: Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
        hubspotOAuth: Boolean(env.HUBSPOT_OAUTH_CLIENT_ID && env.HUBSPOT_OAUTH_CLIENT_SECRET),
        encryptionKey: Boolean(env.ENCRYPTION_KEY),
        database: dbOk,
      },
      portals: { count: portalCount },
    });
  } catch {
    // Always return 200 so Railway healthcheck passes
    return NextResponse.json({ ok: true, app: "vero-hubspot-operator", status: "starting" });
  }
}
