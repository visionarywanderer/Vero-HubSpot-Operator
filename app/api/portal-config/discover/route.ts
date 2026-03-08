import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { portalConfigStore } from "@/lib/portal-config-store";
import { authManager } from "@/lib/auth-manager";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as { portalId?: string };
  if (!body.portalId) {
    return NextResponse.json({ ok: false, error: "portalId is required" }, { status: 400 });
  }

  const discovered = await authManager.withPortal(body.portalId, async () => portalConfigStore.discover(body.portalId as string));
  return NextResponse.json({ ok: true, discovered });
}
