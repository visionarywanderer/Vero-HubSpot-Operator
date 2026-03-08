import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { authManager } from "@/lib/auth-manager";
import { workflowEngine } from "@/lib/workflow-engine";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as { portalId?: string; spec?: Record<string, unknown> };
  if (!body.portalId || !body.spec) {
    return NextResponse.json({ ok: false, error: "portalId and spec are required" }, { status: 400 });
  }

  const result = await authManager.withPortal(body.portalId, async () => workflowEngine.deploy(body.spec!));
  if (!result.success) {
    return NextResponse.json({ ok: false, errors: result.errors ?? ["Workflow deployment blocked"] }, { status: 409 });
  }

  return NextResponse.json({ ok: true, result });
}
