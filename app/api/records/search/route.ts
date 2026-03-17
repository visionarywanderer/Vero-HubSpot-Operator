import { NextRequest, NextResponse } from "next/server";
import { apiClient } from "@/lib/api-client";
import { authManager } from "@/lib/auth-manager";

/** POST /api/records/search — Search CRM records */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { objectType, filters, properties, portalId } = body;

  if (!objectType || !filters) {
    return NextResponse.json({ error: "objectType and filters are required" }, { status: 400 });
  }

  return authManager.withPortal(portalId, async () => {
    const allRecords: unknown[] = [];
    for await (const batch of apiClient.crm.search(objectType, filters, properties)) {
      allRecords.push(...batch);
      if (allRecords.length >= 500) break; // Safety limit
    }
    return NextResponse.json({ ok: true, total: allRecords.length, records: allRecords });
  });
}
