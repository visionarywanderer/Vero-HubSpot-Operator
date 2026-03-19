import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/api-auth";
import { authManager } from "@/lib/auth-manager";
import { propertyManager } from "@/lib/property-manager";
import { resolvePortalId } from "@/lib/active-portal";

export async function GET(req: Request) {
  if (!(await isAuthenticated())) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const objectType = url.searchParams.get("objectType");
  if (!objectType) return NextResponse.json({ ok: false, error: "objectType is required" }, { status: 400 });
  let portalId: string;
  try { portalId = resolvePortalId(url.searchParams.get("portalId")); }
  catch (e) { return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "portalId required" }, { status: 400 }); }

  const properties = await authManager.withPortal(portalId, async () => propertyManager.list(objectType));
  return NextResponse.json({ ok: true, properties });
}

export async function POST(req: Request) {
  if (!(await isAuthenticated())) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as { portalId?: string; objectType?: string; spec?: Record<string, unknown> };
  if (!body.objectType || !body.spec) {
    return NextResponse.json({ ok: false, error: "objectType and spec are required" }, { status: 400 });
  }
  let portalId: string;
  try { portalId = resolvePortalId(body.portalId); }
  catch (e) { return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "portalId required" }, { status: 400 }); }

  const property = await authManager.withPortal(portalId, async () => propertyManager.create(body.objectType!, body.spec as never));
  return NextResponse.json({ ok: true, property });
}
