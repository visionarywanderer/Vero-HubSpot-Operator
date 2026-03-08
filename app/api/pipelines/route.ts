import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { authManager } from "@/lib/auth-manager";
import { pipelineManager, type PipelineObjectType } from "@/lib/pipeline-manager";

function parseObjectType(value: string | null): PipelineObjectType | null {
  return value === "deals" || value === "tickets" ? value : null;
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const portalId = url.searchParams.get("portalId");
  const objectType = parseObjectType(url.searchParams.get("objectType"));
  if (!portalId || !objectType) {
    return NextResponse.json({ ok: false, error: "portalId and objectType (deals|tickets) are required" }, { status: 400 });
  }

  const pipelines = await authManager.withPortal(portalId, async () => pipelineManager.list(objectType));
  return NextResponse.json({ ok: true, pipelines });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as { portalId?: string; objectType?: PipelineObjectType; spec?: Record<string, unknown> };
  if (!body.portalId || !body.objectType || !body.spec) {
    return NextResponse.json({ ok: false, error: "portalId, objectType and spec are required" }, { status: 400 });
  }

  const pipeline = await authManager.withPortal(body.portalId, async () => pipelineManager.create(body.objectType!, body.spec as never));
  return NextResponse.json({ ok: true, pipeline });
}
