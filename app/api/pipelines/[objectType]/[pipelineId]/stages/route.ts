import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/api-auth";
import { authManager } from "@/lib/auth-manager";
import { pipelineManager } from "@/lib/pipeline-manager";
import { parseObjectType, portalFromUrl, type RouteContext } from "@/lib/route-helpers";

export async function GET(req: Request, context: RouteContext<{ objectType: string; pipelineId: string }>) {
  const params = await context.params;
  if (!(await isAuthenticated())) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const objectType = parseObjectType(params.objectType);
  const portalId = portalFromUrl(req);
  if (!portalId || !objectType) return NextResponse.json({ ok: false, error: "portalId and valid objectType are required" }, { status: 400 });

  const stages = await authManager.withPortal(portalId, async () => pipelineManager.listStages(objectType, params.pipelineId));
  return NextResponse.json({ ok: true, stages });
}

export async function POST(req: Request, context: RouteContext<{ objectType: string; pipelineId: string }>) {
  const params = await context.params;
  if (!(await isAuthenticated())) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const objectType = parseObjectType(params.objectType);
  const body = (await req.json()) as { portalId?: string; stage?: Record<string, unknown> };
  if (!body.portalId || !objectType || !body.stage) {
    return NextResponse.json({ ok: false, error: "portalId, valid objectType and stage are required" }, { status: 400 });
  }

  const stage = await authManager.withPortal(body.portalId, async () => pipelineManager.addStage(objectType, params.pipelineId, body.stage as never));
  return NextResponse.json({ ok: true, stage });
}
