import { NextResponse } from "next/server";
import { getEnv } from "@/lib/env";
import { authManager } from "@/lib/auth-manager";
import db from "@/lib/db";

export async function GET() {
  try {
    const env = getEnv();
    const dbCheck = db.prepare("SELECT 1 as ok").get() as { ok: number };

    return NextResponse.json({
      ok: true,
      app: "vero-hubspot-operator",
      allowedGoogleDomain: env.ALLOWED_GOOGLE_DOMAIN,
      configured: {
        googleOAuth: Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
        hubspotOAuth: Boolean(env.HUBSPOT_OAUTH_CLIENT_ID && env.HUBSPOT_OAUTH_CLIENT_SECRET && env.HUBSPOT_OAUTH_REDIRECT_URI),
        singlePortalEnvToken: Boolean(env.HUBSPOT_TOKEN),
        encryptionKey: Boolean(env.ENCRYPTION_KEY),
        databasePath: env.DATABASE_PATH || "./data/vero.db"
      },
      database: {
        connected: dbCheck.ok === 1
      },
      portals: {
        count: authManager.listPortals().length
      }
    });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: "Missing or invalid environment configuration"
      },
      { status: 500 }
    );
  }
}
