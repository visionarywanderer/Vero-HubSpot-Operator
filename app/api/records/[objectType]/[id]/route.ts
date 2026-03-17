import { NextRequest, NextResponse } from "next/server";
import { apiClient } from "@/lib/api-client";
import { authManager } from "@/lib/auth-manager";

/** GET /api/records/[objectType]/[id] — Get a CRM record */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ objectType: string; id: string }> }
) {
  const { objectType, id } = await params;
  const portalId = req.nextUrl.searchParams.get("portalId") ?? "";
  const propsParam = req.nextUrl.searchParams.get("properties");
  const properties = propsParam ? propsParam.split(",") : undefined;

  return authManager.withPortal(portalId, async () => {
    const record = await apiClient.crm.get(objectType, id, properties);
    return NextResponse.json({ ok: true, record });
  });
}

/** PATCH /api/records/[objectType]/[id] — Update a CRM record */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ objectType: string; id: string }> }
) {
  const { objectType, id } = await params;
  const body = await req.json();
  const portalId = body.portalId || req.nextUrl.searchParams.get("portalId") || "";
  const properties = body.properties;

  if (!properties) {
    return NextResponse.json({ error: "properties are required" }, { status: 400 });
  }

  return authManager.withPortal(portalId, async () => {
    const record = await apiClient.crm.update(objectType, id, properties);
    return NextResponse.json({ ok: true, record });
  });
}
