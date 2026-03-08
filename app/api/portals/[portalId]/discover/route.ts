import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { portalConfigStore } from "@/lib/portal-config-store";
import { authManager } from "@/lib/auth-manager";

export async function POST(_req: Request, context: any) {
  const params = await context.params;
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const config = await authManager.withPortal(params.portalId, async () => portalConfigStore.discover(params.portalId));
  return NextResponse.json({ ok: true, config });
}
