import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/api-auth";
import { authManager } from "@/lib/auth-manager";
import { propertyManager } from "@/lib/property-manager";
import { changeLogger } from "@/lib/change-logger";

export async function POST(req: Request) {
  if (!(await isAuthenticated())) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as {
    objectType?: string;
    properties?: Array<{ name: string; label: string; type: string; fieldType: string; groupName?: string; description?: string; options?: Array<{ label: string; value: string; displayOrder?: number }> }>;
    portalId?: string;
  };
  if (!body.portalId || !body.objectType || !body.properties?.length) {
    return NextResponse.json({ ok: false, error: "portalId, objectType, and properties array are required" }, { status: 400 });
  }

  try {
    const results = await authManager.withPortal(body.portalId, async () => {
      const created: Array<{ name: string; status: "success" | "error"; error?: string }> = [];
      for (const spec of body.properties!) {
        try {
          await propertyManager.create(body.objectType!, spec);
          created.push({ name: spec.name, status: "success" });
        } catch (error) {
          created.push({ name: spec.name, status: "error", error: error instanceof Error ? error.message : "Failed" });
        }
      }
      return created;
    });

    const successCount = results.filter((r) => r.status === "success").length;
    await changeLogger.log({
      portalId: body.portalId,
      layer: "api",
      module: "C2",
      action: "batch_create",
      objectType: body.objectType!,
      recordId: `batch-${body.properties!.length}`,
      description: `Batch created ${successCount}/${body.properties!.length} ${body.objectType} properties`,
      status: successCount === body.properties!.length ? "success" : "error",
      initiatedBy: "VeroDigital",
    });

    return NextResponse.json({ ok: true, results, total: body.properties!.length, created: successCount });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Batch create failed" }, { status: 500 });
  }
}
