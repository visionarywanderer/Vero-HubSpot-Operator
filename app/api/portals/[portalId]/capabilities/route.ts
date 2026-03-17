import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { authManager } from "@/lib/auth-manager";

export async function GET(_req: Request, context: any) {
  const params = await context.params;
  const session = await requireSession();
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

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
