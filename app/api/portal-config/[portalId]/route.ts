import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/api-auth";
import { portalConfigStore } from "@/lib/portal-config-store";
import type { RouteContext } from "@/lib/route-helpers";

export async function GET(_req: Request, context: RouteContext<{ portalId: string }>) {
  const params = await context.params;
  if (!(await isAuthenticated())) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const config = await portalConfigStore.load(params.portalId);
  return NextResponse.json({ ok: true, config });
}

export async function PATCH(req: Request, context: RouteContext<{ portalId: string }>) {
  const params = await context.params;
  if (!(await isAuthenticated())) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as { updates?: Record<string, unknown>; path?: string; value?: unknown };

  if (body.updates && typeof body.updates === "object") {
    for (const [path, value] of Object.entries(body.updates)) {
      await portalConfigStore.update(params.portalId, path, value);
    }
    const config = await portalConfigStore.load(params.portalId);
    return NextResponse.json({ ok: true, config });
  }

  if (body.path && body.value !== undefined) {
    await portalConfigStore.update(params.portalId, body.path, body.value);
    const config = await portalConfigStore.load(params.portalId);
    return NextResponse.json({ ok: true, config });
  }

  return NextResponse.json({ ok: false, error: "Invalid body" }, { status: 400 });
}
