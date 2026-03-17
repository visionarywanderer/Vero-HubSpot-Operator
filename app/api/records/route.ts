import { NextRequest, NextResponse } from "next/server";
import { apiClient } from "@/lib/api-client";
import { authManager } from "@/lib/auth-manager";

/** POST /api/records — Create a CRM record */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { objectType, properties, portalId } = body;

  if (!objectType || !properties) {
    return NextResponse.json({ error: "objectType and properties are required" }, { status: 400 });
  }

  const id = portalId || req.nextUrl.searchParams.get("portalId");
  return authManager.withPortal(id, async () => {
    const record = await apiClient.crm.create(objectType, properties);
    return NextResponse.json({ ok: true, record });
  });
}
