import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/api-auth";
import { authManager } from "@/lib/auth-manager";
import type { RouteContext } from "@/lib/route-helpers";

export async function GET(_req: Request, context: RouteContext<{ portalId: string }>) {
  const params = await context.params;
  if (!(await isAuthenticated())) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  try {
    const portal = authManager.getActivePortal(params.portalId);
    return NextResponse.json({
      ok: true,
      portalId: portal.hubId,
      scopes: portal.scopes,
      capabilities: portal.capabilities
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to get capabilities" },
      { status: 400 }
    );
  }
}
