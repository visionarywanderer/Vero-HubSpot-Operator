import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/api-auth";
import { authManager } from "@/lib/auth-manager";
import type { RouteContext } from "@/lib/route-helpers";

export async function POST(_req: Request, context: RouteContext<{ portalId: string }>) {
  const params = await context.params;
  if (!(await isAuthenticated())) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const portals = authManager.listPortals();
  const target = portals.find((p) => p.hubId === params.portalId || p.id === params.portalId);
  if (!target) return NextResponse.json({ ok: false, error: "Portal not found" }, { status: 404 });

  try {
    const token = authManager.getToken(target.id);
    await fetch("https://api.hubapi.com/appinstalls/v3/external-install", {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store"
    }).catch(() => undefined);
  } catch {
    // Continue local cleanup even if external uninstall fails.
  }

  await authManager.removePortal(target.id);
  return NextResponse.json({ ok: true });
}
