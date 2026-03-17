import { NextRequest, NextResponse } from "next/server";
import { apiClient } from "@/lib/api-client";
import { authManager } from "@/lib/auth-manager";

/** POST /api/records/associations — Create a single association */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { fromType, fromId, toType, toId, portalId } = body;

  if (!fromType || !fromId || !toType || !toId) {
    return NextResponse.json({ error: "fromType, fromId, toType, and toId are required" }, { status: 400 });
  }

  return authManager.withPortal(portalId, async () => {
    await apiClient.associations.create(fromType, fromId, toType, toId);
    return NextResponse.json({ ok: true, fromType, fromId, toType, toId });
  });
}
