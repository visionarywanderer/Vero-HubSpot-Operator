import { NextRequest, NextResponse } from "next/server";
import { apiClient } from "@/lib/api-client";
import { authManager } from "@/lib/auth-manager";

/** POST /api/records/batch-upsert — Batch upsert CRM records */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { objectType, records, idProperty, portalId } = body;

  if (!objectType || !records || !Array.isArray(records)) {
    return NextResponse.json({ error: "objectType and records array are required" }, { status: 400 });
  }

  if (records.length > 100) {
    return NextResponse.json({ error: "Maximum 100 records per batch" }, { status: 400 });
  }

  return authManager.withPortal(portalId, async () => {
    const result = await apiClient.crm.batchUpsert(objectType, records, idProperty);
    return NextResponse.json({ ok: true, ...result });
  });
}
