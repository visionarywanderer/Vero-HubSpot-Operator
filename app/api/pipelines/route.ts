import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/api-auth";
import { authManager } from "@/lib/auth-manager";
import { pipelineManager, type PipelineObjectType } from "@/lib/pipeline-manager";
import { resolvePortalId } from "@/lib/active-portal";
import { parseObjectType } from "@/lib/route-helpers";

export async function GET(req: Request) {
  if (!(await isAuthenticated())) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const objectType = parseObjectType(url.searchParams.get("objectType"));
  if (!objectType) return NextResponse.json({ ok: false, error: "objectType (deals|tickets) is required" }, { status: 400 });
  let portalId: string;
  try { portalId = resolvePortalId(url.searchParams.get("portalId")); }
  catch (e) { return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "portalId required" }, { status: 400 }); }

  const pipelines = await authManager.withPortal(portalId, async () => pipelineManager.list(objectType));
  return NextResponse.json({ ok: true, pipelines });
}

export async function POST(req: Request) {
  if (!(await isAuthenticated())) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as { portalId?: string; objectType?: PipelineObjectType; spec?: Record<string, unknown> };
  if (!body.objectType || !body.spec) return NextResponse.json({ ok: false, error: "objectType and spec are required" }, { status: 400 });
  let portalIdPost: string;
  try { portalIdPost = resolvePortalId(body.portalId); }
  catch (e) { return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "portalId required" }, { status: 400 }); }

  const pipeline = await authManager.withPortal(portalIdPost, async () => pipelineManager.create(body.objectType!, body.spec as never));
  return NextResponse.json({ ok: true, pipeline });
}
