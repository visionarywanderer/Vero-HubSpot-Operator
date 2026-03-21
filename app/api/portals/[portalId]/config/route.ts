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

export async function PUT(req: Request, context: RouteContext<{ portalId: string }>) {
  const params = await context.params;
  if (!(await isAuthenticated())) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as { config?: Record<string, unknown> };
  if (!body.config) return NextResponse.json({ ok: false, error: "config is required" }, { status: 400 });

  await portalConfigStore.save(params.portalId, body.config as never);
  return NextResponse.json({ ok: true });
}
