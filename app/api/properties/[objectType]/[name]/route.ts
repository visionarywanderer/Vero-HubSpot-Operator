import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/api-auth";
import { authManager } from "@/lib/auth-manager";
import { propertyManager } from "@/lib/property-manager";
import { portalFromUrl, type RouteContext } from "@/lib/route-helpers";

export async function PATCH(req: Request, context: RouteContext<{ objectType: string; name: string }>) {
  const params = await context.params;
  if (!(await isAuthenticated())) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as { portalId?: string; updates?: Record<string, unknown> };
  if (!body.portalId || !body.updates) {
    return NextResponse.json({ ok: false, error: "portalId and updates are required" }, { status: 400 });
  }

  const property = await authManager.withPortal(body.portalId, async () =>
    propertyManager.update(params.objectType, params.name, body.updates as never)
  );
  return NextResponse.json({ ok: true, property });
}

export async function DELETE(req: Request, context: RouteContext<{ objectType: string; name: string }>) {
  const params = await context.params;
  if (!(await isAuthenticated())) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const portalId = portalFromUrl(req);
  if (!portalId) return NextResponse.json({ ok: false, error: "portalId is required" }, { status: 400 });

  await authManager.withPortal(portalId, async () => propertyManager.delete(params.objectType, params.name));
  return NextResponse.json({ ok: true });
}
