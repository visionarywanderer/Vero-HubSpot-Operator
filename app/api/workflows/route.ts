import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/api-auth";
import { authManager } from "@/lib/auth-manager";
import { workflowEngine } from "@/lib/workflow-engine";
import { resolvePortalId } from "@/lib/active-portal";

export async function GET(req: Request) {
  if (!(await isAuthenticated())) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  let portalId: string;
  try { portalId = resolvePortalId(new URL(req.url).searchParams.get("portalId")); }
  catch (e) { return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "portalId required" }, { status: 400 }); }

  const workflows = await authManager.withPortal(portalId, async () => workflowEngine.list());
  return NextResponse.json({ ok: true, workflows });
}
