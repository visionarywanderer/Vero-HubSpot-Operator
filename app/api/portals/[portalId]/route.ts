import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/api-auth";
import { authManager } from "@/lib/auth-manager";

export async function DELETE(_req: Request, context: any) {
  const params = await context.params;
  if (!(await isAuthenticated())) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  await authManager.removePortal(params.portalId);
  return NextResponse.json({ ok: true });
}
