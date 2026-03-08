import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { authManager } from "@/lib/auth-manager";
import { listManager } from "@/lib/list-manager";

export async function PUT(req: Request, context: any) {
  const params = await context.params;
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as { portalId?: string; recordIds?: string[] };
  if (!body.portalId || !Array.isArray(body.recordIds) || body.recordIds.length === 0) {
    return NextResponse.json({ ok: false, error: "portalId and recordIds are required" }, { status: 400 });
  }

  await authManager.withPortal(body.portalId, async () => listManager.removeMembers(params.listId, body.recordIds!));
  return NextResponse.json({ ok: true });
}
