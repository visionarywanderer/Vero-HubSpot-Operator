import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { authManager } from "@/lib/auth-manager";
import { workflowEngine } from "@/lib/workflow-engine";

function portalFromUrl(req: Request): string | null {
  return new URL(req.url).searchParams.get("portalId");
}

export async function GET(req: Request, context: any) {
  const params = await context.params;
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const portalId = portalFromUrl(req);
  if (!portalId) return NextResponse.json({ ok: false, error: "portalId is required" }, { status: 400 });

  const spec = await authManager.withPortal(portalId, async () => workflowEngine.get(params.flowId));
  return NextResponse.json({ ok: true, spec });
}

export async function PUT(req: Request, context: any) {
  const params = await context.params;
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as { portalId?: string; spec?: Record<string, unknown> };
  if (!body.portalId || !body.spec) {
    return NextResponse.json({ ok: false, error: "portalId and spec are required" }, { status: 400 });
  }

  const result = await authManager.withPortal(body.portalId, async () => workflowEngine.update(params.flowId, body.spec!));
  return NextResponse.json({ ok: true, result });
}

export async function DELETE(req: Request, context: any) {
  const params = await context.params;
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { portalId?: string; confirmationText?: string };
  if (!body.portalId) return NextResponse.json({ ok: false, error: "portalId is required" }, { status: 400 });

  try {
    await authManager.withPortal(body.portalId, async () => workflowEngine.delete(params.flowId, body.confirmationText || ""));
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Delete failed" },
      { status: 400 }
    );
  }
}
