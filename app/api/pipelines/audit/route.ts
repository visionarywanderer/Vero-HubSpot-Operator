import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/api-auth";
import { authManager } from "@/lib/auth-manager";
import { pipelineManager, type PipelineObjectType } from "@/lib/pipeline-manager";

function parseObjectType(value: string | null): PipelineObjectType | null {
  return value === "deals" || value === "tickets" ? value : null;
}

export async function GET(req: Request) {
  if (!(await isAuthenticated())) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const portalId = url.searchParams.get("portalId");
  const objectType = parseObjectType(url.searchParams.get("objectType"));
  if (!portalId || !objectType) {
    return NextResponse.json({ ok: false, error: "portalId and objectType (deals|tickets) are required" }, { status: 400 });
  }

  const audit = await authManager.withPortal(portalId, async () => pipelineManager.audit(objectType));
  return NextResponse.json({ ok: true, audit });
}
