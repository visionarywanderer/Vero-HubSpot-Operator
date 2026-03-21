import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/api-auth";
import { authManager } from "@/lib/auth-manager";
import type { RouteContext } from "@/lib/route-helpers";

export async function GET(_req: Request, context: RouteContext<{ portalId: string }>) {
  const params = await context.params;
  if (!(await isAuthenticated())) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const valid = await authManager.validateToken(params.portalId);
    return NextResponse.json({ ok: true, valid });
  } catch {
    return NextResponse.json({ ok: false, valid: false }, { status: 200 });
  }
}
