import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/api-auth";
import { authManager } from "@/lib/auth-manager";
import { pipelineManager, type PipelineObjectType } from "@/lib/pipeline-manager";

function parseObjectType(value: string): PipelineObjectType | null {
  return value === "deals" || value === "tickets" ? value : null;
}

function portalFromUrl(req: Request): string | null {
  return new URL(req.url).searchParams.get("portalId");
}

export async function GET(req: Request, context: any) {
  const params = await context.params;
  if (!(await isAuthenticated())) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const objectType = parseObjectType(params.objectType);
  const portalId = portalFromUrl(req);
  if (!portalId || !objectType) return NextResponse.json({ ok: false, error: "portalId and valid objectType are required" }, { status: 400 });

  const pipeline = await authManager.withPortal(portalId, async () => pipelineManager.get(objectType, params.pipelineId));
  return NextResponse.json({ ok: true, pipeline });
}

export async function PATCH(req: Request, context: any) {
  const params = await context.params;
  if (!(await isAuthenticated())) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const objectType = parseObjectType(params.objectType);
  const body = (await req.json()) as { portalId?: string; updates?: Record<string, unknown> };
  if (!body.portalId || !objectType || !body.updates) {
    return NextResponse.json({ ok: false, error: "portalId, valid objectType and updates are required" }, { status: 400 });
  }

  const pipeline = await authManager.withPortal(body.portalId, async () => pipelineManager.update(objectType, params.pipelineId, body.updates as never));
  return NextResponse.json({ ok: true, pipeline });
}

export async function DELETE(req: Request, context: any) {
  const params = await context.params;
  if (!(await isAuthenticated())) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const objectType = parseObjectType(params.objectType);
  const portalId = portalFromUrl(req);
  if (!portalId || !objectType) return NextResponse.json({ ok: false, error: "portalId and valid objectType are required" }, { status: 400 });

  await authManager.withPortal(portalId, async () => pipelineManager.delete(objectType, params.pipelineId));
  return NextResponse.json({ ok: true });
}
