import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/api-auth";
import { authManager } from "@/lib/auth-manager";
import { hubSpotClient } from "@/lib/api-client";
import { changeLogger } from "@/lib/change-logger";

export async function POST(req: Request) {
  if (!(await isAuthenticated())) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as { objectType?: string; primaryId?: string; secondaryId?: string; portalId?: string };
  if (!body.portalId || !body.objectType || !body.primaryId || !body.secondaryId) {
    return NextResponse.json({ ok: false, error: "portalId, objectType, primaryId, and secondaryId are required" }, { status: 400 });
  }

  try {
    const result = await authManager.withPortal(body.portalId, async () => {
      const response = await hubSpotClient.post(
        `/crm/v3/objects/${body.objectType}/merge`,
        { primaryObjectId: body.primaryId, objectIdToMerge: body.secondaryId }
      );
      return response.data;
    });

    await changeLogger.log({
      portalId: body.portalId,
      layer: "api",
      module: "A6",
      action: "merge",
      objectType: body.objectType!,
      recordId: body.primaryId!,
      description: `Merged ${body.objectType} ${body.secondaryId} into ${body.primaryId}`,
      status: "success",
      initiatedBy: "VeroDigital",
    });

    return NextResponse.json({ ok: true, result });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Merge failed" }, { status: 500 });
  }
}
