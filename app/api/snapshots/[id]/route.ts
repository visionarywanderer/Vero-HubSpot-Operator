import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/api-auth";
import { getSnapshot } from "@/lib/rollback-manager";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAuthenticated())) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const snapshot = getSnapshot(id);
  if (!snapshot) {
    return NextResponse.json({ ok: false, error: "Snapshot not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, snapshot });
}
