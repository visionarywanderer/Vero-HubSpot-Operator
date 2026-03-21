import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/api-auth";
import { portalConfigStore } from "@/lib/portal-config-store";
import { authManager } from "@/lib/auth-manager";
import type { RouteContext } from "@/lib/route-helpers";

export async function POST(_req: Request, context: RouteContext<{ portalId: string }>) {
  const params = await context.params;
  if (!(await isAuthenticated())) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const config = await authManager.withPortal(params.portalId, async () => portalConfigStore.discover(params.portalId));
  return NextResponse.json({ ok: true, config });
}
