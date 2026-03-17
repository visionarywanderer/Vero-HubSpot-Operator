import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { listSnapshots } from "@/lib/rollback-manager";

export async function GET(req: Request) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const portalId = searchParams.get("portalId");
  if (!portalId) {
    return NextResponse.json({ ok: false, error: "portalId query param required" }, { status: 400 });
  }

  return NextResponse.json({ ok: true, snapshots: listSnapshots(portalId) });
}
