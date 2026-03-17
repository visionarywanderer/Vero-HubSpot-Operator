import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/api-auth";
import { authManager } from "@/lib/auth-manager";
import { propertyManager } from "@/lib/property-manager";

export async function GET(req: Request) {
  if (!(await isAuthenticated())) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const portalId = url.searchParams.get("portalId");
  const objectType = url.searchParams.get("objectType");
  if (!portalId || !objectType) {
    return NextResponse.json({ ok: false, error: "portalId and objectType are required" }, { status: 400 });
  }

  const properties = await authManager.withPortal(portalId, async () => propertyManager.list(objectType));
  return NextResponse.json({ ok: true, properties });
}

export async function POST(req: Request) {
  if (!(await isAuthenticated())) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as { portalId?: string; objectType?: string; spec?: Record<string, unknown> };
  if (!body.portalId || !body.objectType || !body.spec) {
    return NextResponse.json({ ok: false, error: "portalId, objectType and spec are required" }, { status: 400 });
  }

  const property = await authManager.withPortal(body.portalId, async () => propertyManager.create(body.objectType!, body.spec as never));
  return NextResponse.json({ ok: true, property });
}
