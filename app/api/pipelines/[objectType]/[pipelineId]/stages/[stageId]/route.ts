import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { authManager } from "@/lib/auth-manager";
import { pipelineManager, type PipelineObjectType } from "@/lib/pipeline-manager";

function parseObjectType(value: string): PipelineObjectType | null {
  return value === "deals" || value === "tickets" ? value : null;
}

export async function PATCH(req: Request, context: any) {
  const params = await context.params;
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

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
