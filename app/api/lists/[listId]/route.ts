import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { authManager } from "@/lib/auth-manager";
import { listManager } from "@/lib/list-manager";

function portalFromUrl(req: Request): string | null {
  return new URL(req.url).searchParams.get("portalId");
}

export async function GET(req: Request, context: any) {
  const params = await context.params;
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const portalId = portalFromUrl(req);
  if (!portalId) return NextResponse.json({ ok: false, error: "portalId is required" }, { status: 400 });

  const list = await authManager.withPortal(portalId, async () => listManager.get(params.listId));
  return NextResponse.json({ ok: true, list });
}

export async function PUT(req: Request, context: any) {
  const params = await context.params;
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as {
    portalId?: string;
    spec?: {
      name: string;
      objectTypeId: string;
      processingType: "DYNAMIC" | "MANUAL";
      filterBranch?: Record<string, unknown>;
    };
  };

  if (!body.portalId || !body.spec) {
    return NextResponse.json({ ok: false, error: "portalId and spec are required" }, { status: 400 });
  }

  const updated = await authManager.withPortal(body.portalId, async () => listManager.update(params.listId, body.spec as never));
  return NextResponse.json({ ok: true, list: updated });
}

export async function DELETE(req: Request, context: any) {
  const params = await context.params;
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const portalId = portalFromUrl(req);
  if (!portalId) return NextResponse.json({ ok: false, error: "portalId is required" }, { status: 400 });

  await authManager.withPortal(portalId, async () => listManager.delete(params.listId));
  return NextResponse.json({ ok: true });
}
