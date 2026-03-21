import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/api-auth";
import { authManager } from "@/lib/auth-manager";
import { pipelineManager } from "@/lib/pipeline-manager";
import { parseObjectType, type RouteContext } from "@/lib/route-helpers";

export async function PATCH(req: Request, context: RouteContext<{ objectType: string; pipelineId: string; stageId: string }>) {
  const params = await context.params;
  if (!(await isAuthenticated())) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const objectType = parseObjectType(params.objectType);
  const body = (await req.json()) as { portalId?: string; updates?: Record<string, unknown> };
  if (!body.portalId || !objectType || !body.updates) {
    return NextResponse.json({ ok: false, error: "portalId, valid objectType and updates are required" }, { status: 400 });
  }

  const stage = await authManager.withPortal(body.portalId, async () =>
    pipelineManager.updateStage(objectType, params.pipelineId, params.stageId, body.updates as never)
  );
  return NextResponse.json({ ok: true, stage });
}
