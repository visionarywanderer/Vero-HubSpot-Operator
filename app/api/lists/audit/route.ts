import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { authManager } from "@/lib/auth-manager";
import { listManager } from "@/lib/list-manager";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const portalId = new URL(req.url).searchParams.get("portalId");
  if (!portalId) return NextResponse.json({ ok: false, error: "portalId is required" }, { status: 400 });

  const audit = await authManager.withPortal(portalId, async () => listManager.audit());
  return NextResponse.json({ ok: true, audit });
}
