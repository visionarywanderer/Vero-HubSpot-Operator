import { NextRequest, NextResponse } from "next/server";
import { apiClient } from "@/lib/api-client";
import { authManager } from "@/lib/auth-manager";

/** POST /api/records/associations/batch — Batch create associations */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { fromType, toType, pairs, portalId } = body;

  if (!fromType || !toType || !pairs || !Array.isArray(pairs)) {
    return NextResponse.json({ error: "fromType, toType, and pairs array are required" }, { status: 400 });
  }

  if (pairs.length > 2000) {
    return NextResponse.json({ error: "Maximum 2000 pairs per batch" }, { status: 400 });
  }

  return authManager.withPortal(portalId, async () => {
    const result = await apiClient.associations.batchCreate(fromType, toType, pairs);
    return NextResponse.json({ ok: true, ...result });
  });
}
