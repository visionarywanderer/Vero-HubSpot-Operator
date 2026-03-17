import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { authManager } from "@/lib/auth-manager";
import { propertyManager } from "@/lib/property-manager";

export async function GET(req: Request) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const portalId = url.searchParams.get("portalId");
  const objectType = url.searchParams.get("objectType");
  if (!portalId || !objectType) {
    return NextResponse.json({ ok: false, error: "portalId and objectType are required" }, { status: 400 });
  }

  const groups = await authManager.withPortal(portalId, async () => propertyManager.listGroups(objectType));
  return NextResponse.json({ ok: true, groups });
}

export async function POST(req: Request) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as { portalId?: string; objectType?: string; spec?: { name: string; label: string; displayOrder?: number } };
  if (!body.portalId || !body.objectType || !body.spec) {
    return NextResponse.json({ ok: false, error: "portalId, objectType and spec are required" }, { status: 400 });
  }

  const group = await authManager.withPortal(body.portalId, async () => propertyManager.createGroup(body.objectType!, body.spec!));
  return NextResponse.json({ ok: true, group });
}
