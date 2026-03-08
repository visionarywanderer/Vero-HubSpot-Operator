import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { authManager } from "@/lib/auth-manager";
import { propertyManager } from "@/lib/property-manager";

function portalFromUrl(req: Request): string | null {
  return new URL(req.url).searchParams.get("portalId");
}

export async function PATCH(req: Request, context: any) {
  const params = await context.params;
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as { portalId?: string; updates?: Record<string, unknown> };
  if (!body.portalId || !body.updates) {
    return NextResponse.json({ ok: false, error: "portalId and updates are required" }, { status: 400 });
  }

  const property = await authManager.withPortal(body.portalId, async () =>
    propertyManager.update(params.objectType, params.name, body.updates as never)
  );
  return NextResponse.json({ ok: true, property });
}

export async function DELETE(req: Request, context: any) {
  const params = await context.params;
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const portalId = portalFromUrl(req);
  if (!portalId) return NextResponse.json({ ok: false, error: "portalId is required" }, { status: 400 });

  await authManager.withPortal(portalId, async () => propertyManager.delete(params.objectType, params.name));
  return NextResponse.json({ ok: true });
}
