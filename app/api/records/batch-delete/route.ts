import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/api-auth";
import { authManager } from "@/lib/auth-manager";
import { hubSpotClient, sanitizePathSegment } from "@/lib/api-client";
import { changeLogger } from "@/lib/change-logger";

/** POST /api/records/batch-delete — Batch archive CRM records */
export async function POST(req: Request) {
  if (!(await isAuthenticated())) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as { objectType?: string; ids?: string[]; portalId?: string };
  if (!body.objectType || !Array.isArray(body.ids) || body.ids.length === 0) {
    return NextResponse.json({ ok: false, error: "objectType and ids array are required" }, { status: 400 });
  }
  if (!body.portalId) return NextResponse.json({ ok: false, error: "portalId is required" }, { status: 400 });
  if (body.ids.length > 100) {
    return NextResponse.json({ ok: false, error: "Maximum 100 records per batch delete" }, { status: 400 });
  }

  try {
    await authManager.withPortal(body.portalId, async () => {
      const inputs = body.ids!.map((id) => ({ id }));
      await hubSpotClient.post(`/crm/v3/objects/${sanitizePathSegment(body.objectType!)}/batch/archive`, { inputs });

      await changeLogger.log({
        portalId: body.portalId!,
        layer: "api",
        module: "A1",
        action: "delete",
        objectType: body.objectType!,
        recordId: body.ids!.join(","),
        description: `Batch deleted ${body.ids!.length} ${body.objectType} record(s)`,
        status: "success",
        initiatedBy: "VeroDigital",
      });
    });

    return NextResponse.json({ ok: true, deleted: body.ids.length });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Batch delete failed" },
      { status: 500 }
    );
  }
}
