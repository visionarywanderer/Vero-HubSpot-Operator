import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/api-auth";
import { authManager } from "@/lib/auth-manager";
import { workflowEngine } from "@/lib/workflow-engine";

/** POST /api/workflows/clone — Clone a workflow under a new name */
export async function POST(req: Request) {
  if (!(await isAuthenticated())) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as { sourceFlowId?: string; newName?: string; portalId?: string };
  if (!body.sourceFlowId) return NextResponse.json({ ok: false, error: "sourceFlowId is required" }, { status: 400 });
  if (!body.newName) return NextResponse.json({ ok: false, error: "newName is required" }, { status: 400 });
  if (!body.portalId) return NextResponse.json({ ok: false, error: "portalId is required" }, { status: 400 });

  try {
    const result = await authManager.withPortal(body.portalId, async () => {
      // Fetch the source workflow spec
      const source = await workflowEngine.get(body.sourceFlowId!);

      // Strip identity fields and set new name
      const clone: Record<string, unknown> = { ...source };
      delete clone.id;
      delete clone.flowId;
      delete clone.revisionId;
      delete clone.createdAt;
      delete clone.updatedAt;
      delete clone.portalId;
      clone.name = body.newName;
      clone.isEnabled = false;

      // Deploy the clone
      return workflowEngine.deployPartial(clone);
    });
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Clone failed" },
      { status: 500 }
    );
  }
}
